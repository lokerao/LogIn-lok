import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { employeeStyles } from '@/components/employee-screen';
import { Button } from '@/components/ui/button';
import { StatusIndicator, type StatusVariant } from '@/components/ui/status-indicator';
import { colors, radius, spacing, typography } from '@/constants/design-system';
import {
  formatDate,
  formatDuration,
  formatTime,
  getTodayDateString,
} from '@/features/attendance/attendance-service';
import type { AttendanceRecord, AttendanceVerificationStatus } from '@/types/attendance';
import { PhotoViewModal } from './photo-view-modal';

type Props = {
  attendance: AttendanceRecord | null;
  onCheckInPress: () => void;
  onCheckOutPress: () => void;
};

export function getVerificationStatusInfo(status: AttendanceVerificationStatus | null | undefined): {
  label: string;
  variant: StatusVariant;
} {
  switch (status) {
    case 'approved':
      return { label: 'Approved', variant: 'approved' };
    case 'rejected':
      return { label: 'Rejected', variant: 'rejected' };
    case 'pending':
    default:
      return { label: 'Pending Review', variant: 'pending' };
  }
}

export function EmployeeAttendanceCard({
  attendance,
  onCheckInPress,
  onCheckOutPress,
}: Props) {
  const [elapsedDuration, setElapsedDuration] = useState<string>('');
  const [viewPhotoPath, setViewPhotoPath] = useState<string | null>(null);
  const [photoTitle, setPhotoTitle] = useState<string>('');

  const isCheckedIn = Boolean(attendance && !attendance.check_out_at);
  const isCheckedOut = Boolean(attendance && attendance.check_out_at);

  // Live timer ticker for active check-in
  useEffect(() => {
    if (!isCheckedIn || !attendance?.check_in_at) return;

    function updateTimer() {
      setElapsedDuration(formatDuration(attendance!.check_in_at));
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isCheckedIn, attendance]);

  return (
    <View style={employeeStyles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={employeeStyles.label}>Today&apos;s Attendance</Text>
          <Text style={styles.todayDate}>{formatDate(attendance?.attendance_date || getTodayDateString())}</Text>
        </View>

        {isCheckedIn ? (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Working: {elapsedDuration || '0m'}</Text>
          </View>
        ) : isCheckedOut ? (
          <View style={styles.completedPill}>
            <Text style={styles.completedText}>Shift Completed</Text>
          </View>
        ) : null}
      </View>

      {/* STATE 1: NOT CHECKED IN */}
      {!attendance && (
        <View style={styles.actionState}>
          <Text style={styles.promptText}>
            Capture a live camera photo to check in. Your working hours start immediately upon check-in.
          </Text>
          <Button accessibilityLabel="Check in with camera" onPress={onCheckInPress}>
            Check In
          </Button>
        </View>
      )}

      {/* STATE 2: CHECKED IN (ACTIVE SESSION) */}
      {isCheckedIn && attendance && (
        <View style={styles.activeState}>
          <View style={styles.timeGrid}>
            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>Check-In Time</Text>
              <Text style={styles.timeValue}>{formatTime(attendance.check_in_at)}</Text>
            </View>

            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>Photo Verification</Text>
              <View style={styles.statusWrap}>
                <StatusIndicator
                  variant={getVerificationStatusInfo(attendance.check_in_verification_status).variant}
                >
                  {getVerificationStatusInfo(attendance.check_in_verification_status).label}
                </StatusIndicator>
              </View>
            </View>
          </View>

          <View style={styles.photoLinkRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPhotoTitle('Check-In Photo');
                setViewPhotoPath(attendance.check_in_photo_path);
              }}
              style={styles.photoLink}
            >
              <Text style={styles.photoLinkText}>View Check-In Photo ↗</Text>
            </Pressable>
          </View>

          {attendance.check_in_verification_status === 'rejected' && (
            <View style={styles.rejectionNotice}>
              <Text style={styles.rejectionTitle}>HR Review Note</Text>
              <Text style={styles.rejectionText}>
                {attendance.check_in_review_notes || 'Photo rejected by HR. Working clock remains recorded.'}
              </Text>
            </View>
          )}

          <View style={styles.checkOutWrap}>
            <Button accessibilityLabel="Check out with camera" onPress={onCheckOutPress}>
              Check Out
            </Button>
          </View>
        </View>
      )}

      {/* STATE 3: CHECKED OUT (COMPLETED SESSION) */}
      {isCheckedOut && attendance && (
        <View style={styles.completedState}>
          <View style={styles.timeGrid}>
            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>Check In</Text>
              <Text style={styles.timeValue}>{formatTime(attendance.check_in_at)}</Text>
              <StatusIndicator
                style={styles.cellStatus}
                variant={getVerificationStatusInfo(attendance.check_in_verification_status).variant}
              >
                {getVerificationStatusInfo(attendance.check_in_verification_status).label}
              </StatusIndicator>
            </View>

            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>Check Out</Text>
              <Text style={styles.timeValue}>{formatTime(attendance.check_out_at ?? null)}</Text>
              <StatusIndicator
                style={styles.cellStatus}
                variant={getVerificationStatusInfo(attendance.check_out_verification_status).variant}
              >
                {getVerificationStatusInfo(attendance.check_out_verification_status).label}
              </StatusIndicator>
            </View>
          </View>

          <View style={styles.durationSummaryRow}>
            <Text style={styles.durationLabel}>Total Working Duration</Text>
            <Text style={styles.durationValue}>
              {formatDuration(attendance.check_in_at, attendance.check_out_at ?? null)}
            </Text>
          </View>

          <View style={styles.photoLinksRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPhotoTitle('Check-In Photo');
                setViewPhotoPath(attendance.check_in_photo_path);
              }}
              style={styles.photoLink}
            >
              <Text style={styles.photoLinkText}>Check-In Photo ↗</Text>
            </Pressable>

            {Boolean(attendance.check_out_photo_path) && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPhotoTitle('Check-Out Photo');
                  setViewPhotoPath(attendance.check_out_photo_path ?? null);
                }}
                style={styles.photoLink}
              >
                <Text style={styles.photoLinkText}>Check-Out Photo ↗</Text>
              </Pressable>
            )}
          </View>

          {(attendance.check_in_review_notes || attendance.check_out_review_notes) && (
            <View style={styles.rejectionNotice}>
              <Text style={styles.rejectionTitle}>HR Review Notes</Text>
              {Boolean(attendance.check_in_review_notes) && (
                <Text style={styles.rejectionText}>
                  Check-In: {attendance.check_in_review_notes}
                </Text>
              )}
              {Boolean(attendance.check_out_review_notes) && (
                <Text style={styles.rejectionText}>
                  Check-Out: {attendance.check_out_review_notes}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Photo Viewer Modal */}
      <PhotoViewModal
        onClose={() => setViewPhotoPath(null)}
        photoPath={viewPhotoPath}
        title={photoTitle}
        visible={Boolean(viewPhotoPath)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayDate: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  livePill: {
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: {
    backgroundColor: '#0284C7',
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  liveText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
  },
  completedPill: {
    backgroundColor: '#DFF7E9',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  completedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  actionState: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  promptText: {
    color: colors.muted,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  activeState: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  timeGrid: {
    borderTopColor: '#EEF1F6',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  timeCell: {
    flex: 1,
    gap: 4,
  },
  timeLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  timeValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  statusWrap: {
    marginTop: 2,
  },
  cellStatus: {
    marginTop: 4,
  },
  photoLinkRow: {
    flexDirection: 'row',
  },
  photoLinksRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  photoLink: {
    paddingVertical: 2,
  },
  photoLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  rejectionNotice: {
    backgroundColor: '#FEF3EB',
    borderColor: '#FDBA74',
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 2,
    padding: spacing.sm,
  },
  rejectionTitle: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '700',
  },
  rejectionText: {
    color: '#C2410C',
    fontSize: 13,
  },
  checkOutWrap: {
    marginTop: spacing.xs,
  },
  completedState: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  durationSummaryRow: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  durationLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  durationValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
});
