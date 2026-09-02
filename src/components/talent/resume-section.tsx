import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { employeeStyles } from "@/components/employee-screen";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing } from "@/constants/design-system";
import { getSupabase } from "@/lib/supabase";
import type { Resume } from "@/types/talent";

type Props = {
  employeeId: string;
  resume: Resume | null;
  onUpdated: () => void;
};

const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB limit

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sanitizeFileName(fileName: string): string {
  const clean = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

export function ResumeSection({ employeeId, resume, onUpdated }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  async function handlePickAndUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const fileSize = file.size ?? 0;

      if (fileSize > MAX_RESUME_BYTES) {
        Alert.alert("File Too Large", "Resume PDF cannot exceed 5 MB.");
        return;
      }

      setIsUploading(true);

      const response = await fetch(file.uri);
      const blob = await response.blob();

      const safeName = sanitizeFileName(file.name || "resume.pdf");
      const storageObjectKey = `${employeeId}/${safeName}`;
      const dbStoragePath = `resumes/${storageObjectKey}`;

      const { error: uploadError } = await getSupabase()
        .storage.from("resumes")
        .upload(storageObjectKey, blob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        Alert.alert(
          "Upload Failed",
          uploadError.message || "Could not upload PDF to storage.",
        );
        setIsUploading(false);
        return;
      }

      const { error: dbError } = await getSupabase()
        .from("resumes")
        .upsert(
          {
            employee_id: employeeId,
            storage_path: dbStoragePath,
            file_name: file.name,
            size_bytes: fileSize || blob.size,
            mime_type: "application/pdf",
          },
          { onConflict: "employee_id" },
        );

      if (dbError) {
        Alert.alert(
          "Save Failed",
          dbError.message || "Could not record resume metadata.",
        );
      } else {
        Alert.alert(
          "Resume Uploaded",
          "Your PDF resume has been securely stored.",
        );
        onUpdated();
      }
    } catch {
      Alert.alert(
        "Error",
        "An unexpected error occurred during resume upload.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleOpenResume() {
    if (!resume) return;

    setIsOpening(true);
    try {
      // storage_path format: resumes/[employeeId]/[filename.pdf]
      const relativePath = resume.storage_path.replace(/^resumes\//, "");

      const { data, error } = await getSupabase()
        .storage.from("resumes")
        .createSignedUrl(relativePath, 60);

      if (error || !data?.signedUrl) {
        Alert.alert(
          "Access Error",
          error?.message || "Could not generate secure view link.",
        );
      } else {
        await Linking.openURL(data.signedUrl);
      }
    } catch {
      Alert.alert("Error", "Could not open resume.");
    } finally {
      setIsOpening(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Remove Resume",
      "Are you sure you want to delete your uploaded resume?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void handleDelete(),
        },
      ],
    );
  }

  async function handleDelete() {
    if (!resume) return;

    setIsDeleting(true);
    try {
      const relativePath = resume.storage_path.replace(/^resumes\//, "");

      await getSupabase().storage.from("resumes").remove([relativePath]);
      const { error } = await getSupabase()
        .from("resumes")
        .delete()
        .eq("id", resume.id);

      if (error) {
        Alert.alert(
          "Delete Failed",
          error.message || "Could not delete resume record.",
        );
      } else {
        onUpdated();
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <View style={employeeStyles.card}>
      <View style={styles.headerRow}>
        <Text style={employeeStyles.label}>Resume & Documents</Text>
        <View style={styles.privacyBadge}>
          <Text style={styles.privacyText}>Private Storage</Text>
        </View>
      </View>

      {resume ? (
        <View style={styles.resumeCard}>
          <View style={styles.fileIconBox}>
            <Text style={styles.fileIconText}>PDF</Text>
          </View>

          <View style={styles.fileDetails}>
            <Text numberOfLines={1} style={styles.fileName}>
              {resume.file_name}
            </Text>
            <Text style={styles.fileMeta}>
              {formatBytes(resume.size_bytes)} · Uploaded{" "}
              {new Date(resume.created_at).toLocaleDateString()}
            </Text>

            <View style={styles.actionButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={isOpening}
                onPress={() => void handleOpenResume()}
                style={styles.viewButton}
              >
                {isOpening ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.viewText}>View PDF ↗</Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={isUploading}
                onPress={() => void handlePickAndUpload()}
                style={styles.replaceButton}
              >
                <Text style={styles.replaceText}>Replace</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={isDeleting}
                onPress={confirmDelete}
                style={styles.deleteButton}
              >
                {isDeleting ? (
                  <ActivityIndicator color={colors.muted} size="small" />
                ) : (
                  <Text style={styles.deleteText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={employeeStyles.muted}>
            No resume uploaded yet. Upload a PDF resume (max 5 MB) stored
            privately in your secure talent vault.
          </Text>
          {isUploading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Button
              accessibilityLabel="Upload PDF Resume"
              onPress={() => void handlePickAndUpload()}
            >
              Upload PDF Resume
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  privacyBadge: {
    backgroundColor: "#EEF2F6",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  privacyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  resumeCard: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
    padding: spacing.md,
  },
  fileIconBox: {
    alignItems: "center",
    backgroundColor: "#FEE4E2",
    borderRadius: radius.sm,
    height: 48,
    justifyContent: "center",
    width: 44,
  },
  fileIconText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "800",
  },
  fileDetails: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  fileMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: 6,
  },
  viewButton: {
    paddingVertical: 2,
  },
  viewText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  replaceButton: {
    paddingVertical: 2,
  },
  replaceText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  deleteButton: {
    paddingVertical: 2,
  },
  deleteText: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyWrap: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  loader: {
    paddingVertical: spacing.md,
  },
});
