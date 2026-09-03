import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import { fetchDirectReportDetails } from "@/features/manager/manager-service";
import type { DirectReportFullDetails } from "@/types/manager";

interface DirectReportProfileModalProps {
  visible: boolean;
  employeeId: string | null;
  onClose: () => void;
  onAssignWork: (employeeId: string) => void;
}

export function DirectReportProfileModal({
  visible,
  employeeId,
  onClose,
  onAssignWork,
}: DirectReportProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<DirectReportFullDetails | null>(null);

  const loadDetails = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDirectReportDetails(id);
      setDetails(data);
    } catch (err: any) {
      setError(err.message || "Unable to load direct report details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && employeeId) {
      const timer = setTimeout(() => {
        void loadDetails(employeeId);
      }, 0);
      return () => clearTimeout(timer);
    } else if (!visible) {
      const timer = setTimeout(() => {
        setDetails(null);
        setError(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [visible, employeeId, loadDetails]);

  const emp = details?.employee;
  const fullName = emp ? `${emp.first_name} ${emp.last_name}` : "";
  const initial = emp ? emp.first_name.slice(0, 1).toUpperCase() : "";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Employee Profile</Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading direct report profile...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => employeeId && void loadDetails(employeeId)}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : emp ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Profile Card */}
              <View style={styles.heroCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.heroInfo}>
                  <Text style={styles.heroName}>{fullName}</Text>
                  <Text style={styles.heroCode}>
                    {emp.employee_code} · {emp.employment_status.toUpperCase()}
                  </Text>
                  <Text style={styles.heroDesignation}>
                    {emp.designation ?? "Employee"}
                  </Text>
                  <Text style={styles.heroTeam}>
                    {emp.team ?? "No Team"}
                    {emp.department ? ` (${emp.department})` : ""}
                  </Text>
                </View>
              </View>

              {/* Action: Assign Work */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  onAssignWork(emp.id);
                }}
                style={styles.assignWorkButton}
              >
                <Text style={styles.assignWorkButtonText}>+ Assign Work to {emp.first_name}</Text>
              </Pressable>

              {/* Section 1: Contact Details */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Contact & Employment</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{emp.work_email}</Text>
                </View>
                {emp.phone && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{emp.phone}</Text>
                  </View>
                )}
                {emp.joining_date && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Joining Date</Text>
                    <Text style={styles.detailValue}>{emp.joining_date}</Text>
                  </View>
                )}
                {emp.location && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailValue}>{emp.location}</Text>
                  </View>
                )}
              </View>

              {/* Section 2: Active & Today's Work */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Recent Tasks (Phase 7)</Text>
                {details?.work_assignments.length === 0 ? (
                  <Text style={styles.emptyNote}>No recent tasks assigned.</Text>
                ) : (
                  details?.work_assignments.map((task) => (
                    <View key={task.id} style={styles.itemRow}>
                      <View style={styles.itemHeader}>
                        <Text numberOfLines={1} style={styles.itemTitle}>
                          {task.title}
                        </Text>
                        <Text style={styles.itemProgress}>
                          {task.progress_percent}%
                        </Text>
                      </View>
                      <Text style={styles.itemSubtitle}>
                        {task.work_date} · {task.status.replace("_", " ")}
                        {task.due_time ? ` · Due ${task.due_time.slice(0, 5)}` : ""}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              {/* Section 3: Leave Balances & Requests */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Leave Balances</Text>
                {details?.leave_balances.length === 0 ? (
                  <Text style={styles.emptyNote}>No leave balances configured.</Text>
                ) : (
                  <View style={styles.balanceGrid}>
                    {details?.leave_balances.map((b) => (
                      <View key={b.leave_type_name} style={styles.balancePill}>
                        <Text style={styles.balanceName}>{b.leave_type_name}</Text>
                        <Text style={styles.balanceValue}>
                          {b.available_days} / {b.allocated_days} days
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {details?.leave_requests.length ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={styles.subSectionTitle}>Recent Requests</Text>
                    {details.leave_requests.map((lr) => (
                      <View key={lr.id} style={styles.itemRow}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemTitle}>
                            {lr.leave_type_name} ({lr.requested_days}d)
                          </Text>
                          <Text
                            style={[
                              styles.statusChip,
                              lr.status === "approved"
                                ? styles.statusApproved
                                : lr.status === "pending"
                                ? styles.statusPending
                                : styles.statusNeutral,
                            ]}
                          >
                            {lr.status.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.itemSubtitle}>
                          {lr.start_date} to {lr.end_date}
                          {lr.reason ? ` · ${lr.reason}` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Section 4: Recent Attendance (Timestamps Only) */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Recent Attendance</Text>
                {details?.attendance_history.length === 0 ? (
                  <Text style={styles.emptyNote}>No attendance records found.</Text>
                ) : (
                  details?.attendance_history.map((att) => (
                    <View key={att.id} style={styles.itemRow}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{att.work_date}</Text>
                        <Text style={styles.itemSubtitle}>
                          {att.status.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.itemSubtitle}>
                        In: {att.check_in_time ? att.check_in_time.slice(11, 16) : "--:--"}
                        {"  ·  "}
                        Out: {att.check_out_time ? att.check_out_time.slice(11, 16) : "Active"}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    maxHeight: "88%",
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    alignItems: "center",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeButtonText: {
    color: colors.muted,
    fontSize: 20,
    fontWeight: "600",
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  avatarText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
  },
  heroInfo: {
    flex: 1,
    gap: 2,
  },
  heroName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  heroCode: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  heroDesignation: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  heroTeam: {
    color: colors.muted,
    fontSize: 12,
  },
  assignWorkButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  assignWorkButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  subSectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  detailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyNote: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic",
  },
  itemRow: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    gap: 3,
    padding: spacing.sm,
    marginBottom: 4,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  itemProgress: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  itemSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  balancePill: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
    minWidth: "45%",
    gap: 2,
  },
  balanceName: {
    color: colors.muted,
    fontSize: 12,
  },
  balanceValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  statusChip: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusApproved: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  statusPending: {
    backgroundColor: "#FEF9C3",
    color: "#854D0E",
  },
  statusNeutral: {
    backgroundColor: colors.canvas,
    color: colors.muted,
  },
});
