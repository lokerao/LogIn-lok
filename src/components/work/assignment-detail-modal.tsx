import { colors, radius, spacing } from "@/constants/design-system";
import {
    fetchAssignmentDetails,
    formatDueTime,
    formatWorkDate,
    isAssignmentOverdue,
    managerManageWorkAssignment,
    submitWorkProgress,
} from "@/features/work/work-service";
import type { WorkAssignment, WorkAssignmentUpdate } from "@/types/work";
import { useCallback, useEffect, useState } from "react";
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
} from "react-native";

interface AssignmentDetailModalProps {
  visible: boolean;
  assignmentId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  isEmployee: boolean;
  isManager: boolean;
}

export function AssignmentDetailModal({
  visible,
  assignmentId,
  onClose,
  onUpdated,
  isEmployee,
  isManager,
}: AssignmentDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<WorkAssignment | null>(null);
  const [updates, setUpdates] = useState<WorkAssignmentUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Update progress form state (for Employee)
  const [selectedStatus, setSelectedStatus] = useState<
    "in_progress" | "blocked" | "completed"
  >("in_progress");
  const [progressPercent, setProgressPercent] = useState<number>(50);
  const [updateText, setUpdateText] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manager action state
  const [managerActionNotes, setManagerActionNotes] = useState<string>("");
  const [isManaging, setIsManaging] = useState<boolean>(false);

  const loadDetails = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAssignmentDetails(id);
      setAssignment(data.assignment);
      setUpdates(data.updates);
      // Initialize form with current assignment values
      if (
        data.assignment.status === "in_progress" ||
        data.assignment.status === "blocked"
      ) {
        setSelectedStatus(data.assignment.status);
      } else {
        setSelectedStatus("in_progress");
      }
      setProgressPercent(data.assignment.progress_percent || 50);
    } catch (err: any) {
      setError(err.message || "Unable to load assignment details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && assignmentId) {
      const timer = setTimeout(() => {
        void loadDetails(assignmentId);
      }, 0);
      return () => clearTimeout(timer);
    } else if (!visible) {
      const timer = setTimeout(() => {
        setAssignment(null);
        setUpdates([]);
        setError(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [visible, assignmentId, loadDetails]);

  async function handleProgressSubmit() {
    if (!assignment) return;
    if (!updateText.trim() || updateText.trim().length < 2) {
      Alert.alert(
        "Required Note",
        "Please enter a progress update note (at least 2 characters).",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await submitWorkProgress({
        assignmentId: assignment.id,
        status: selectedStatus,
        progressPercent: selectedStatus === "completed" ? 100 : progressPercent,
        updateText: updateText.trim(),
      });
      setUpdateText("");
      Alert.alert("Success", "Progress update recorded successfully.");
      onUpdated();
      void loadDetails(assignment.id);
    } catch (err: any) {
      Alert.alert(
        "Update Failed",
        err.message || "Unable to submit progress update.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManagerAction(action: "cancel" | "reopen") {
    if (!assignment) return;
    const actionLabel =
      action === "cancel" ? "Cancel Assignment" : "Reopen Assignment";

    Alert.alert(
      actionLabel,
      `Are you sure you want to ${action} this assignment?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: action === "cancel" ? "destructive" : "default",
          onPress: async () => {
            try {
              setIsManaging(true);
              await managerManageWorkAssignment({
                assignmentId: assignment.id,
                action,
                notes: managerActionNotes.trim() || undefined,
              });
              setManagerActionNotes("");
              Alert.alert(
                "Success",
                `Assignment ${action === "cancel" ? "cancelled" : "reopened"} successfully.`,
              );
              onUpdated();
              void loadDetails(assignment.id);
            } catch (err: any) {
              Alert.alert(
                "Action Failed",
                err.message || `Unable to ${action} assignment.`,
              );
            } finally {
              setIsManaging(false);
            }
          },
        },
      ],
    );
  }

  const isOverdue = assignment ? isAssignmentOverdue(assignment) : false;
  const canEmployeeUpdate =
    isEmployee &&
    assignment &&
    assignment.status !== "completed" &&
    assignment.status !== "cancelled";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
      visible={visible}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Assignment Details</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading details...</Text>
            </View>
          ) : error || !assignment ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>
                {error ?? "Assignment not found"}
              </Text>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Badges */}
              <View style={styles.badgeRow}>
                <View style={[styles.badge, styles.priorityBadge]}>
                  <Text style={styles.priorityBadgeText}>
                    Priority: {assignment.priority.toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.badge, styles.statusBadge]}>
                  <Text style={styles.statusBadgeText}>
                    {assignment.status.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
                {isOverdue && (
                  <View style={[styles.badge, styles.overdueBadge]}>
                    <Text style={styles.overdueBadgeText}>OVERDUE</Text>
                  </View>
                )}
              </View>

              {/* Title & Description */}
              <Text style={styles.taskTitle}>{assignment.title}</Text>
              {Boolean(assignment.description) && (
                <Text style={styles.taskDescription}>
                  {assignment.description}
                </Text>
              )}

              {/* Expected outcome */}
              {Boolean(assignment.expected_outcome) && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxLabel}>Expected Deliverable:</Text>
                  <Text style={styles.infoBoxContent}>
                    {assignment.expected_outcome}
                  </Text>
                </View>
              )}

              {/* Meta information */}
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Assignee:</Text>
                  <Text style={styles.metaValue}>
                    {assignment.employee_name || "Assigned Employee"}
                    {assignment.employee_code
                      ? ` (${assignment.employee_code})`
                      : ""}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Assigned By:</Text>
                  <Text style={styles.metaValue}>
                    {assignment.assigned_by_name || "Manager"}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Work Date:</Text>
                  <Text style={styles.metaValue}>
                    {formatWorkDate(assignment.work_date)}
                  </Text>
                </View>
                {Boolean(assignment.due_time) && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Due Time:</Text>
                    <Text style={styles.metaValue}>
                      {formatDueTime(assignment.due_time)}
                    </Text>
                  </View>
                )}
                {assignment.completed_at && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Completed At:</Text>
                    <Text style={styles.metaValue}>
                      {new Date(assignment.completed_at).toLocaleString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </Text>
                  </View>
                )}
              </View>

              {/* Current Progress bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Current Progress</Text>
                  <Text style={styles.progressValue}>
                    {assignment.progress_percent}%
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${assignment.progress_percent}%`,
                        backgroundColor:
                          assignment.status === "completed"
                            ? colors.success
                            : assignment.status === "blocked"
                              ? "#B42318"
                              : colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Employee: Update Progress Section */}
              {canEmployeeUpdate && (
                <View style={styles.actionCard}>
                  <Text style={styles.actionCardTitle}>Update Progress</Text>

                  {/* Status selection */}
                  <Text style={styles.inputLabel}>Select Status</Text>
                  <View style={styles.statusChipsRow}>
                    {(["in_progress", "blocked", "completed"] as const).map(
                      (st) => (
                        <Pressable
                          key={st}
                          onPress={() => {
                            setSelectedStatus(st);
                            if (st === "completed") {
                              setProgressPercent(100);
                            }
                          }}
                          style={[
                            styles.statusChip,
                            selectedStatus === st && styles.statusChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              selectedStatus === st &&
                                styles.statusChipTextActive,
                            ]}
                          >
                            {st === "in_progress"
                              ? "In Progress"
                              : st === "blocked"
                                ? "Blocked"
                                : "Completed"}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>

                  {/* Progress percentage selection */}
                  {selectedStatus !== "completed" && (
                    <View style={styles.percentSection}>
                      <Text style={styles.inputLabel}>
                        Progress: {progressPercent}%
                      </Text>
                      <View style={styles.percentChipsRow}>
                        {[0, 25, 50, 75, 90].map((p) => (
                          <Pressable
                            key={p}
                            onPress={() => setProgressPercent(p)}
                            style={[
                              styles.percentChip,
                              progressPercent === p && styles.percentChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.percentChipText,
                                progressPercent === p &&
                                  styles.percentChipTextActive,
                              ]}
                            >
                              {p}%
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Update Note text */}
                  <Text style={styles.inputLabel}>
                    Update Note / Deliverable
                  </Text>
                  <TextInput
                    multiline
                    numberOfLines={3}
                    onChangeText={setUpdateText}
                    placeholder="e.g. Completed login screen layout. Testing form validation."
                    placeholderTextColor={colors.muted}
                    style={styles.textArea}
                    value={updateText}
                  />

                  {/* Submit Button */}
                  <Pressable
                    disabled={isSubmitting}
                    onPress={handleProgressSubmit}
                    style={[
                      styles.submitBtn,
                      isSubmitting && styles.submitBtnDisabled,
                    ]}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {selectedStatus === "completed"
                          ? "Mark Completed (100%)"
                          : "Submit Progress Update"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}

              {/* Manager: Reopen / Cancel actions */}
              {isManager && (
                <View style={styles.managerActionCard}>
                  <Text style={styles.actionCardTitle}>Manager Actions</Text>
                  <TextInput
                    onChangeText={setManagerActionNotes}
                    placeholder="Optional manager note"
                    placeholderTextColor={colors.muted}
                    style={styles.managerInput}
                    value={managerActionNotes}
                  />
                  <View style={styles.managerBtnsRow}>
                    {assignment.status !== "cancelled" && (
                      <Pressable
                        disabled={isManaging}
                        onPress={() => void handleManagerAction("cancel")}
                        style={[styles.managerBtn, styles.cancelTaskBtn]}
                      >
                        <Text style={styles.cancelTaskBtnText}>
                          Cancel Assignment
                        </Text>
                      </Pressable>
                    )}
                    {assignment.status === "completed" && (
                      <Pressable
                        disabled={isManaging}
                        onPress={() => void handleManagerAction("reopen")}
                        style={[styles.managerBtn, styles.reopenTaskBtn]}
                      >
                        <Text style={styles.reopenTaskBtnText}>
                          Reopen Assignment
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {/* Progress Update History Timeline */}
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Update History</Text>
                {updates.length === 0 ? (
                  <Text style={styles.noHistoryText}>
                    No progress updates recorded yet.
                  </Text>
                ) : (
                  updates.map((upd, idx) => (
                    <View key={upd.id} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      {idx < updates.length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                      <View style={styles.timelineContent}>
                        <View style={styles.timelineHeader}>
                          <Text style={styles.timelineStatus}>
                            {upd.status_at_update
                              .replace("_", " ")
                              .toUpperCase()}{" "}
                            · {upd.progress_percent}%
                          </Text>
                          <Text style={styles.timelineDate}>
                            {new Date(upd.created_at).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <Text style={styles.timelineText}>
                          {upd.update_text}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    maxHeight: "92%",
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.canvas,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "700",
  },
  centerContainer: {
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorText: {
    color: "#B42318",
    fontSize: 14,
    textAlign: "center",
  },
  scrollContent: {
    gap: spacing.md,
    padding: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priorityBadge: {
    backgroundColor: "#EFF8FF",
  },
  priorityBadgeText: {
    color: "#175CD3",
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadge: {
    backgroundColor: "#F2F4F7",
  },
  statusBadgeText: {
    color: "#344054",
    fontSize: 11,
    fontWeight: "700",
  },
  overdueBadge: {
    backgroundColor: "#FEE4E2",
    borderColor: "#B42318",
    borderWidth: 1,
  },
  overdueBadgeText: {
    color: "#B42318",
    fontSize: 11,
    fontWeight: "800",
  },
  taskTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  taskDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: "#F9FAFB",
    borderColor: "#EAECF0",
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: spacing.sm,
  },
  infoBoxLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoBoxContent: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  metaCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    gap: 6,
    padding: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  metaValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  progressSection: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  progressValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  progressBarTrack: {
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    height: 8,
    overflow: "hidden",
    width: "100%",
  },
  progressBarFill: {
    borderRadius: radius.pill,
    height: "100%",
  },
  actionCard: {
    backgroundColor: "#F9FAFB",
    borderColor: "#EAECF0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  actionCardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  statusChipsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statusChip: {
    backgroundColor: colors.white,
    borderColor: "#D0D5DD",
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  statusChipTextActive: {
    color: colors.white,
  },
  percentSection: {
    gap: 4,
  },
  percentChipsRow: {
    flexDirection: "row",
    gap: 6,
  },
  percentChip: {
    backgroundColor: colors.white,
    borderColor: "#D0D5DD",
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
  },
  percentChipActive: {
    backgroundColor: "#EFF8FF",
    borderColor: colors.primary,
  },
  percentChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  percentChipTextActive: {
    color: colors.primary,
  },
  textArea: {
    backgroundColor: colors.white,
    borderColor: "#D0D5DD",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    minHeight: 68,
    padding: spacing.sm,
    textAlignVertical: "top",
  },
  submitBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    marginTop: 6,
    paddingVertical: 12,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  managerActionCard: {
    backgroundColor: "#FEF3EB",
    borderColor: "#FEDF89",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  managerInput: {
    backgroundColor: colors.white,
    borderColor: "#D0D5DD",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 13,
    padding: spacing.sm,
  },
  managerBtnsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  managerBtn: {
    borderRadius: radius.sm,
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelTaskBtn: {
    backgroundColor: "#FEE4E2",
    borderColor: "#B42318",
    borderWidth: 1,
  },
  cancelTaskBtnText: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "700",
  },
  reopenTaskBtn: {
    backgroundColor: colors.primary,
  },
  reopenTaskBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  historySection: {
    gap: spacing.sm,
    marginTop: 6,
  },
  historyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  noHistoryText: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic",
  },
  timelineItem: {
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 50,
    position: "relative",
  },
  timelineDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 10,
    marginTop: 4,
    width: 10,
    zIndex: 2,
  },
  timelineLine: {
    backgroundColor: "#D0D5DD",
    bottom: -10,
    left: 4,
    position: "absolute",
    top: 14,
    width: 2,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
    paddingBottom: spacing.sm,
  },
  timelineHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timelineStatus: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  timelineDate: {
    color: colors.muted,
    fontSize: 11,
  },
  timelineText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cancelBtn: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
});
