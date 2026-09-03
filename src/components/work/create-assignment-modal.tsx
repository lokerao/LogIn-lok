import { colors, radius, spacing } from "@/constants/design-system";
import {
    createWorkAssignment,
    fetchDirectReports,
    getTodayDateString,
} from "@/features/work/work-service";
import type { DirectReport, WorkAssignmentPriority } from "@/types/work";
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

interface CreateAssignmentModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialEmployeeId?: string;
}

export function CreateAssignmentModal({
  visible,
  onClose,
  onCreated,
  initialEmployeeId,
}: CreateAssignmentModalProps) {
  const [loadingReports, setLoadingReports] = useState(false);
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [workDate, setWorkDate] = useState<string>(getTodayDateString());
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [expectedOutcome, setExpectedOutcome] = useState<string>("");
  const [priority, setPriority] = useState<WorkAssignmentPriority>("medium");
  const [dueTime, setDueTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadReportsAndReset = useCallback(async () => {
    setWorkDate(getTodayDateString());
    setTitle("");
    setDescription("");
    setExpectedOutcome("");
    setPriority("medium");
    setDueTime("");

    try {
      setLoadingReports(true);
      const reports = await fetchDirectReports();
      setDirectReports(reports);
      if (
        initialEmployeeId &&
        reports.some((r) => r.id === initialEmployeeId)
      ) {
        setSelectedEmployeeId(initialEmployeeId);
      } else if (reports.length > 0) {
        setSelectedEmployeeId(reports[0].id);
      }
    } catch {
      Alert.alert("Error", "Unable to load direct reports.");
    } finally {
      setLoadingReports(false);
    }
  }, [initialEmployeeId]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        void loadReportsAndReset();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [visible, loadReportsAndReset]);

  async function handleSubmit() {
    if (!selectedEmployeeId) {
      Alert.alert(
        "Employee Required",
        "Please select an employee for this assignment.",
      );
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      Alert.alert(
        "Title Required",
        "Task title must be at least 3 characters.",
      );
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate.trim())) {
      Alert.alert(
        "Invalid Date",
        "Please enter a valid work date in YYYY-MM-DD format.",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await createWorkAssignment({
        employeeId: selectedEmployeeId,
        workDate: workDate.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        expectedOutcome: expectedOutcome.trim() || undefined,
        dueTime: dueTime.trim() || undefined,
      });

      Alert.alert(
        "Assignment Created",
        "Daily work assignment has been successfully created.",
      );
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Creation Failed",
        err.message || "Unable to create work assignment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
      visible={visible}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Work Assignment</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Direct Report Picker */}
            <Text style={styles.inputLabel}>Assign To Direct Report *</Text>
            {loadingReports ? (
              <ActivityIndicator color={colors.primary} />
            ) : directReports.length === 0 ? (
              <Text style={styles.noReportsText}>
                No active direct reports found in your team.
              </Text>
            ) : (
              <View style={styles.chipsWrap}>
                {directReports.map((emp) => (
                  <Pressable
                    key={emp.id}
                    onPress={() => setSelectedEmployeeId(emp.id)}
                    style={[
                      styles.empChip,
                      selectedEmployeeId === emp.id && styles.empChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.empChipText,
                        selectedEmployeeId === emp.id &&
                          styles.empChipTextActive,
                      ]}
                    >
                      {emp.first_name} {emp.last_name} ({emp.employee_code})
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Work Date */}
            <Text style={styles.inputLabel}>Work Date (YYYY-MM-DD) *</Text>
            <TextInput
              onChangeText={setWorkDate}
              placeholder="e.g. 2026-09-04"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={workDate}
            />

            {/* Task Title */}
            <Text style={styles.inputLabel}>Task Title *</Text>
            <TextInput
              onChangeText={setTitle}
              placeholder="e.g. Complete attendance module testing"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={title}
            />

            {/* Priority Picker */}
            <Text style={styles.inputLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {(["low", "medium", "high", "urgent"] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.priorityChip,
                    priority === p && styles.priorityChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      priority === p && styles.priorityChipTextActive,
                    ]}
                  >
                    {p.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Due Time (Optional) */}
            <Text style={styles.inputLabel}>Due Time (Optional, HH:MM)</Text>
            <TextInput
              onChangeText={setDueTime}
              placeholder="e.g. 17:30"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={dueTime}
            />

            {/* Description */}
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              multiline
              numberOfLines={3}
              onChangeText={setDescription}
              placeholder="Detailed instructions or context for this assignment"
              placeholderTextColor={colors.muted}
              style={styles.textArea}
              value={description}
            />

            {/* Expected Outcome */}
            <Text style={styles.inputLabel}>
              Expected Deliverable (Optional)
            </Text>
            <TextInput
              multiline
              numberOfLines={2}
              onChangeText={setExpectedOutcome}
              placeholder="e.g. PR submitted with test cases passing"
              placeholderTextColor={colors.muted}
              style={styles.textArea}
              value={expectedOutcome}
            />

            {/* Submit Button */}
            <Pressable
              disabled={isSubmitting || directReports.length === 0}
              onPress={handleSubmit}
              style={[
                styles.submitBtn,
                (isSubmitting || directReports.length === 0) &&
                  styles.submitBtnDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Create Assignment</Text>
              )}
            </Pressable>
          </ScrollView>
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
  scrollContent: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  noReportsText: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  empChip: {
    backgroundColor: colors.canvas,
    borderColor: "#D0D5DD",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  empChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  empChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  empChipTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.white,
    borderColor: "#D0D5DD",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    padding: spacing.sm,
  },
  textArea: {
    backgroundColor: colors.white,
    borderColor: "#D0D5DD",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    minHeight: 60,
    padding: spacing.sm,
    textAlignVertical: "top",
  },
  priorityRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  priorityChip: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: "#D0D5DD",
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  priorityChipActive: {
    backgroundColor: "#EFF8FF",
    borderColor: colors.primary,
  },
  priorityChipText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  priorityChipTextActive: {
    color: colors.primary,
  },
  submitBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    paddingVertical: 14,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
