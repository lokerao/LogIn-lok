import { decode } from 'base64-arraybuffer';
import * as Crypto from 'expo-crypto';
import { File as ExpoFile, UploadType } from 'expo-file-system';

import { getSupabase } from '@/lib/supabase';
import type {
  AttendanceRecord,
  AttendanceVerificationStatus,
} from '@/types/attendance';

/**
 * Upload a local photo to Supabase Storage using expo-file-system's native
 * File.upload() — this performs the HTTP request entirely in the native layer
 * (Java on Android, ObjC on iOS), completely bypassing React Native's broken
 * JS fetch/Blob/ArrayBuffer serialisation.
 *
 * Previous approaches that failed on Android Hermes:
 *  • fetch(uri).arrayBuffer() → stringified to "[object Array]" (14 bytes)
 *  • fetch(uri).blob() + Blob.slice() → FormData.append serialised incorrectly
 *  • FileSystem.readAsStringAsync (legacy) → throws in SDK 57
 *  • decode(base64) → ArrayBuffer passed through supabase upload → storage-js
 *    wraps non-Blob/non-FormData in fetch() body → RN stringifies again
 *
 * File.upload() streams the real file bytes from the native filesystem over
 * HTTP without ever touching JS Blob/ArrayBuffer serialisation.
 */
async function uploadPhotoToStorage(
  photoUri: string,
  storageObjectKey: string,
  label: string,
): Promise<void> {
  const supabase = getSupabase();

  // STAGE 1: Verify local file via native File class
  const localFile = new ExpoFile(photoUri);
  console.log(`[AttendanceService] ${label} local file:`, {
    uri: photoUri.substring(0, 80),
    exists: localFile.exists,
    sizeBytes: localFile.size,
    mimeType: localFile.type,
  });

  if (!localFile.exists) {
    throw new Error('Captured photo file does not exist on device.');
  }
  if (localFile.size < 1000) {
    console.warn(
      `[AttendanceService] WARNING: ${label} file is suspiciously small:`,
      localFile.size,
      'bytes',
    );
  }

  // STAGE 2: Verify JPEG magic bytes via native base64 read
  const base64Head = localFile.base64Sync().substring(0, 12);
  const headBuffer = decode(base64Head);
  const header = new Uint8Array(headBuffer);
  const isJpeg = header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
  console.log(`[AttendanceService] ${label} JPEG check:`, {
    firstBytes: `${header[0]?.toString(16)} ${header[1]?.toString(16)} ${header[2]?.toString(16)}`,
    isValidJpeg: isJpeg,
  });
  if (!isJpeg) {
    console.warn(`[AttendanceService] WARNING: ${label} does not have JPEG magic bytes!`);
  }

  // STAGE 3: Get auth token for Storage API
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('No authenticated session — cannot upload photo.');
  }

  // STAGE 4: Native upload to Supabase Storage REST API
  // POST /storage/v1/object/{bucket}/{path}
  const supabaseUrl = (supabase as unknown as { storageUrl?: string }).storageUrl
    ?? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1`;
  const uploadUrl = `${supabaseUrl}/object/attendance/${storageObjectKey}`;

  console.log(`[AttendanceService] ${label} native upload starting:`, {
    storageObjectKey,
    localFileSize: localFile.size,
  });

  const result = await localFile.upload(uploadUrl, {
    httpMethod: 'POST',
    uploadType: UploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
      apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    },
    mimeType: 'image/jpeg',
  });

  console.log(`[AttendanceService] ${label} native upload result:`, {
    status: result.status,
    bodyLength: result.body?.length,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `Photo upload failed (HTTP ${result.status}): ${result.body ?? 'unknown error'}`,
    );
  }
}

export function formatTime(isoString: string | null): string {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "---";
  const date = new Date(dateString);
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(
  startIso: string,
  endIso: string | null = null,
): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export async function fetchActiveOrTodayAttendance(
  employeeId: string,
): Promise<AttendanceRecord | null> {
  const supabase = getSupabase();
  const today = getTodayDateString();

  // First check for an open active session
  const { data: activeSession, error: activeError } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("employee_id", employeeId)
    .is("check_out_at", null)
    .maybeSingle();

  if (activeError) throw activeError;
  if (activeSession) return activeSession as AttendanceRecord;

  // Otherwise check today's completed session
  const { data: todaySession, error: todayError } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("attendance_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (todayError) throw todayError;
  return (todaySession as AttendanceRecord) ?? null;
}

export async function fetchAttendanceHistory(
  employeeId: string,
  limit = 30,
): Promise<AttendanceRecord[]> {
  const { data, error } = await getSupabase()
    .from("attendance_records")
    .select("*")
    .eq("employee_id", employeeId)
    .order("attendance_date", { ascending: false })
    .order("check_in_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as AttendanceRecord[]) ?? [];
}

export async function submitCheckIn(
  employeeId: string,
  photoUri: string,
): Promise<string> {
  const supabase = getSupabase();
  const attendanceId = Crypto.randomUUID();
  const storageObjectKey = `${employeeId}/${attendanceId}/check-in.jpg`;
  const dbPhotoPath = `attendance/${storageObjectKey}`;

  try {
    // Upload photo via native HTTP (bypasses JS fetch entirely)
    await uploadPhotoToStorage(photoUri, storageObjectKey, 'Check-in');

    // Record check-in via RPC
    const { data: recordId, error: rpcError } = await supabase.rpc(
      'record_attendance_check_in',
      { p_photo_path: dbPhotoPath },
    );

    if (rpcError) {
      console.error('[AttendanceService] Check-in RPC error:', rpcError);
      await supabase.storage
        .from('attendance')
        .remove([storageObjectKey])
        .catch(() => {});
      throw new Error(rpcError.message || 'Could not record check-in.');
    }

    return (recordId as string) || attendanceId;
  } catch (err) {
    console.error('[AttendanceService] submitCheckIn exception:', err);
    throw err;
  }
}

export async function submitCheckOut(
  employeeId: string,
  attendanceId: string,
  photoUri: string,
): Promise<void> {
  const supabase = getSupabase();
  const storageObjectKey = `${employeeId}/${attendanceId}/check-out.jpg`;
  const dbPhotoPath = `attendance/${storageObjectKey}`;

  try {
    // STAGE 1: Verify local file exists
    const fileInfo = await FileSystem.getInfoAsync(photoUri);
    console.log("[AttendanceService] Check-out local file info:", {
      exists: fileInfo.exists,
      uri: photoUri.substring(0, 80),
      size: fileInfo.exists
        ? (fileInfo as FileSystem.FileInfo & { size?: number }).size
        : "N/A",
    });

    if (!fileInfo.exists) {
      throw new Error("Captured photo file does not exist on device.");
    }

    // STAGE 2: Read actual bytes from filesystem via Base64
    const { arrayBuffer, byteLength } =
      await readLocalFileAsArrayBuffer(photoUri);

    // STAGE 3: Verify JPEG magic bytes
    const header = new Uint8Array(arrayBuffer, 0, Math.min(4, byteLength));
    const isJpeg =
      header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    console.log("[AttendanceService] Check-out binary payload:", {
      storageObjectKey,
      byteLength,
      jpegMagic: `${header[0]?.toString(16)} ${header[1]?.toString(16)} ${header[2]?.toString(16)}`,
      isValidJpeg: isJpeg,
    });

    // STAGE 4: Upload real binary to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("attendance")
      .upload(storageObjectKey, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error(
        "[AttendanceService] Check-out storage upload error:",
        uploadError,
      );
      throw new Error(`Photo upload failed: ${uploadError.message}`);
    }

    console.log("[AttendanceService] Check-out photo uploaded successfully:", {
      storageObjectKey,
      uploadedBytes: byteLength,
    });

    // STAGE 5: Call RPC to record check-out
    const { error: rpcError } = await supabase.rpc(
      "record_attendance_check_out",
      {
        p_attendance_id: attendanceId,
        p_photo_path: dbPhotoPath,
      },
    );

    if (rpcError) {
      console.error("[AttendanceService] Check-out RPC error:", rpcError);
      throw new Error(rpcError.message || "Could not record check-out.");
    }
  } catch (err) {
    console.error("[AttendanceService] submitCheckOut exception:", err);
    throw err;
  }
}

export async function fetchHRAttendanceRecords(
  limit = 50,
): Promise<AttendanceRecord[]> {
  const { data, error } = await getSupabase()
    .from("attendance_records")
    .select(
      `
      *,
      employees!inner (
        id,
        employee_code,
        first_name,
        last_name,
        profiles (
          display_name
        )
      )
    `,
    )
    .order("attendance_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as AttendanceRecord[]) ?? [];
}

export async function fetchManagerAttendanceRecords(
  limit = 50,
): Promise<AttendanceRecord[]> {
  const { data, error } = await getSupabase()
    .from("attendance_records")
    .select(
      `
      *,
      employees!inner (
        id,
        employee_code,
        first_name,
        last_name,
        profiles (
          display_name
        )
      )
    `,
    )
    .order("attendance_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as AttendanceRecord[]) ?? [];
}

export async function submitHRVerification(
  attendanceId: string,
  eventType: "check_in" | "check_out",
  status: AttendanceVerificationStatus,
  notes?: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("review_attendance_photo", {
    p_attendance_id: attendanceId,
    p_event_type: eventType,
    p_status: status,
    p_notes: notes || null,
  });

  if (error) {
    throw new Error(error.message || "Failed to update verification status.");
  }
}

export async function getSignedPhotoUrl(
  photoPath: string,
): Promise<string | null> {
  const relativePath = photoPath.replace(/^attendance\//, "");
  console.log(
    "[AttendanceService] getSignedPhotoUrl input photoPath:",
    photoPath,
  );
  console.log(
    "[AttendanceService] getSignedPhotoUrl resolved relativePath:",
    relativePath,
  );

  try {
    const { data, error } = await getSupabase()
      .storage.from("attendance")
      .createSignedUrl(relativePath, 300);

    if (error) {
      console.error(
        "[AttendanceService] createSignedUrl error for path:",
        relativePath,
        "message:",
        error.message,
      );
      return null;
    }

    if (!data?.signedUrl) {
      console.error(
        "[AttendanceService] createSignedUrl returned empty URL for path:",
        relativePath,
      );
      return null;
    }

    console.log(
      "[AttendanceService] createSignedUrl SUCCESS for path:",
      relativePath,
    );
    return data.signedUrl;
  } catch (err) {
    console.error("[AttendanceService] getSignedPhotoUrl exception:", err);
    return null;
  }
}
