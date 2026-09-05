import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { employeeStyles } from '@/components/employee-screen';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { colors, radius, spacing, typography } from '@/constants/design-system';
import {
  formatDate,
  formatDuration,
  formatTime,
  submitHRVerification,
} from '@/features/attendance/attendance-service';
import type { AttendanceRecord } from '@/types/attendance';
import { getVerificationStatusInfo } from './employee-attendance-card';
import { PhotoViewModal } from './photo-view-modal';

type Props = {
  records: AttendanceRecord[];
  onUpdated: () => void;
};

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

export function HRAttendanceReview({ records, onUpdated }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewPhotoPath, setViewPhotoPath] = useState<string | null>(null);
  const [photoTitle, setPhotoTitle] = useState<string>('');

  // Rejection modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [targetRecord, setTargetRecord] = useState<AttendanceRecord | null>(null);
  const [targetEvent, setTargetEvent] = useState<'check_in' | 'check_out'>('check_in');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredRecords = records.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'pending') {
      return (
        r.check_in_verification_status === 'pending' ||
        r.check_out_verification_status === 'pending'
      );
    }
    if (filter === 'approved') {
      return (
        r.check_in_verification_status === 'approved' &&
        (!r.check_out_at || r.check_out_verification_status === 'approved')
      );
    }
    if (filter === 'rejected') {
      return (
        r.check_in_verification_status === 'rejected' ||
        r.check_out_verification_status === 'rejected'
      );
    }
    return true;
  });

  async function handleApprove(record: AttendanceRecord, event: 'check_in' | 'check_out') {
    setIsProcessing(true);
    try {
      await submitHRVerification(record.id, event, 'approved');
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not approve photo.';
      Alert.alert('Approval Error', msg);
    } finally {
      setIsProcessing(false);
    }
  }

  function openRejectModal(record: AttendanceRecord, event: 'check_in' | 'check_out') {
    setTargetRecord(record);
    setTargetEvent(event);
    setRejectionNotes('');
    setRejectModalVisible(true);
  }

  async function handleConfirmReject() {
    if (!targetRecord) return;
    setIsProcessing(true);
    try {
      await submitHRVerification(
        targetRecord.id,
        targetEvent,
        'rejected',
        rejectionNotes.trim() || undefined,
      );
      setRejectModalVisible(false);
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not reject photo.';
      Alert.alert('Rejection Error', msg);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <View style={employeeStyles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={employeeStyles.label}>HR Verification Queue</Text>
          <Text style={styles.subtitle}>Review employee attendance photos</Text>
        </View>
        <Text style={styles.countBadge}>{filteredRecords.length} records</Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'approved', 'rejected'] as FilterType[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setFilter(tab)}
            style={[styles.filterChip, filter === tab && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === tab && styles.filterChipTextActive,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {filteredRecords.length === 0 ? (
        <Text style={employeeStyles.muted}>
          No attendance records found for this filter.
        </Text>
      ) : (
        <View style={styles.recordList}>
          {filteredRecords.map((record) => {
            const emp = record.employees;
            const canonicalName = emp
              ? `${emp.first_name} ${emp.last_name}`.trim()
              : '';
            const empName =
              canonicalName ||
              emp?.profiles?.display_name ||
              'Employee';
            const empCode = emp?.employee_code || '';

            const checkInStatus = getVerificationStatusInfo(record.check_in_verification_status);
            const checkOutStatus = record.check_out_verification_status
              ? getVerificationStatusInfo(record.check_out_verification_status)
              : null;

            return (
              <View key={record.id} style={styles.reviewCard}>
                {/* Employee Info Header */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.empName}>{empName}</Text>
                    <Text style={styles.empMeta}>
                      ID: {empCode} · {formatDate(record.attendance_date)}
                    </Text>
                  </View>
                  <Text style={styles.duration}>
                    {formatDuration(record.check_in_at, record.check_out_at ?? null)}
                  </Text>
                </View>

                {/* Check-In Review Section */}
                <View style={styles.eventSection}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTitle}>
                      Check-In: {formatTime(record.check_in_at)}
                    </Text>
                    <StatusIndicator variant={checkInStatus.variant}>
                      {checkInStatus.label}
                    </StatusIndicator>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setPhotoTitle(`${empName} — Check-In Photo`);
                        setViewPhotoPath(record.check_in_photo_path);
                      }}
                      style={styles.viewPhotoBtn}
                    >
                      <Text style={styles.viewPhotoText}>View Photo ↗</Text>
                    </Pressable>

                    <View style={styles.decisionBtns}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isProcessing}
                        onPress={() => void handleApprove(record, 'check_in')}
                        style={[styles.approveBtn, record.check_in_verification_status === 'approved' && styles.activeDecision]}
                      >
                        <Text style={styles.approveText}>Approve</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        disabled={isProcessing}
                        onPress={() => openRejectModal(record, 'check_in')}
                        style={[styles.rejectBtn, record.check_in_verification_status === 'rejected' && styles.activeDecision]}
                      >
                        <Text style={styles.rejectText}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>

                  {Boolean(record.check_in_review_notes) && (
                    <Text style={styles.notesText}>Note: {record.check_in_review_notes}</Text>
                  )}
                </View>

                {/* Check-Out Review Section (if present) */}
                {Boolean(record.check_out_at && record.check_out_photo_path) && (
                  <View style={styles.eventSection}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>
                        Check-Out: {formatTime(record.check_out_at ?? null)}
                      </Text>
                      {checkOutStatus && (
                        <StatusIndicator variant={checkOutStatus.variant}>
                          {checkOutStatus.label}
                        </StatusIndicator>
                      )}
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setPhotoTitle(`${empName} — Check-Out Photo`);
                          setViewPhotoPath(record.check_out_photo_path ?? null);
                        }}
                        style={styles.viewPhotoBtn}
                      >
                        <Text style={styles.viewPhotoText}>View Photo ↗</Text>
                      </Pressable>

                      <View style={styles.decisionBtns}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={isProcessing}
                          onPress={() => void handleApprove(record, 'check_out')}
                          style={[styles.approveBtn, record.check_out_verification_status === 'approved' && styles.activeDecision]}
                        >
                          <Text style={styles.approveText}>Approve</Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          disabled={isProcessing}
                          onPress={() => openRejectModal(record, 'check_out')}
                          style={[styles.rejectBtn, record.check_out_verification_status === 'rejected' && styles.activeDecision]}
                        >
                          <Text style={styles.rejectText}>Reject</Text>
                        </Pressable>
                      </View>
                    </View>

                    {Boolean(record.check_out_review_notes) && (
                      <Text style={styles.notesText}>Note: {record.check_out_review_notes}</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Reject Modal */}
      <Modal animationType="slide" visible={rejectModalVisible}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Attendance Photo</Text>
            <Text style={styles.modalSubtitle}>
              Provide a reason for rejecting the photo evidence (e.g., face unclear, poor lighting, not identifiable).
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Rejection Note / Feedback</Text>
              <TextInput
                maxLength={1000}
                multiline
                numberOfLines={3}
                onChangeText={setRejectionNotes}
                placeholder="e.g. Photo too dark, face partially obscured..."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={rejectionNotes}
              />
            </View>

            <View style={styles.modalActions}>
              {isProcessing ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Button accessibilityLabel="Confirm Rejection" onPress={() => void handleConfirmReject()}>
                  Confirm Rejection
                </Button>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={isProcessing}
                onPress={() => setRejectModalVisible(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#EEF2F6',
    borderRadius: radius.pill,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  filterChip: {
    backgroundColor: colors.white,
    borderColor: '#D5DDEA',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.white,
  },
  recordList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reviewCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  empName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  empMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  duration: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  eventSection: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  viewPhotoBtn: {
    paddingVertical: 2,
  },
  viewPhotoText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  decisionBtns: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  approveBtn: {
    backgroundColor: '#DFF7E9',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  approveText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: '#FEE4E2',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rejectText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '700',
  },
  activeDecision: {
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  notesText: {
    color: '#B42318',
    fontSize: 11,
    fontStyle: 'italic',
  },
  modalSafe: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  modalContent: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.ink,
    ...typography.title,
    fontSize: 22,
  },
  modalSubtitle: {
    color: colors.muted,
    ...typography.body,
    fontSize: 14,
  },
  formGroup: {
    gap: spacing.xs,
  },
  formLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.white,
    borderColor: '#D5DDEA',
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    padding: spacing.md,
  },
  textArea: {
    height: 100,
  },
  modalActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
  },
});
