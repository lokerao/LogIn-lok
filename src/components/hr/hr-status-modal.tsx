import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import { updateEmployeeStatus } from "@/features/hr/hr-service";
import type {
    CurrentWorkforceStatus,
    EmploymentStatus,
    PermanentEmploymentStatus,
} from "@/types/hr";

interface HRStatusModalProps {
  visible: boolean;
  employeeId: string | null;
  employeeCode: string;
  employeeName: string;
  currentStatus: PermanentEmploymentStatus | EmploymentStatus;
  currentWorkforceStatus?: CurrentWorkforceStatus;
  hasApprovedLeaveToday?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LIFECYCLE_ACTIONS: {
  label: string;
  value: "active" | "inactive" | "terminated";
  description: string;
  actionText: string;
}[] = [
  {
    label: "Reactivate / Active",
    value: "active",
    description: "Employee is in good standing with standard system access.",
    actionText: "Reactivate Employee",
  },
  {
    label: "Mark Inactive",
    value: "inactive",
    description: "Temporarily suspended or paused from operations.",
    actionText: "Mark Inactive",
  },
  {
    label: "Mark Terminated",
    value: "terminated",
    description: "Employment completed or offboarded. Revokes check-in access.",
    actionText: "Mark Terminated",
  },
];

export function HRStatusModal({
  visible,
  employeeId,
  employeeCode,
  employeeName,
  currentStatus,
  currentWorkforceStatus = "inactive",
  hasApprovedLeaveToday = false,
  onClose,
  onSuccess,
}: HRStatusModalProps) {
  // Normalize permanent status (exclude legacy on_leave from permanent)
  const initialPermStatus: PermanentEmploymentStatus =
    currentStatus === "on_leave"
      ? "active"
      : (currentStatus as PermanentEmploymentStatus);

  const [selectedAction, setSelectedAction] =
    useState<PermanentEmploymentStatus>(initialPermStatus);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleUpdate = () => {
    if (!employeeId) return;

    if (selectedAction === initialPermStatus) {
      Alert.alert(
        "No Change",
        "Please select a different HR lifecycle action.",
      );
      return;
    }

    const actionItem = LIFECYCLE_ACTIONS.find(
      (a) => a.value === selectedAction,
    );
    const actionLabel = actionItem?.actionText ?? selectedAction;

    Alert.alert(
      "Confirm HR Lifecycle Action",
      `Are you sure you want to ${actionLabel.toLowerCase()} for ${employeeName} (${employeeCode})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: selectedAction === "terminated" ? "destructive" : "default",
          onPress: async () => {
            try {
              setSubmitting(true);
              await updateEmployeeStatus(employeeId, selectedAction, notes);
              Alert.alert(
                "Lifecycle Updated",
                `Employee ${employeeCode} permanent status is now set to ${selectedAction.toUpperCase()}.`,
              );
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert(
                "Update Failed",
                err.message || "Could not update employee lifecycle status.",
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Manage Employee Lifecycle</Text>
              <Text style={styles.subtitle}>
                {employeeName} · {employeeCode}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* 1. Permanent Employment Status Overview */}
          <View style={styles.derivedStatusCard}>
            <View style={styles.derivedHeader}>
              <Text style={styles.derivedLabel}>Current Employment Status</Text>
              <View
                style={[
                  styles.statusBadge,
                  initialPermStatus === "active"
                    ? styles.badgeActive
                    : initialPermStatus === "terminated"
                      ? styles.badgeTerminated
                      : styles.badgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    initialPermStatus === "active"
                      ? styles.textActive
                      : initialPermStatus === "terminated"
                        ? styles.textTerminated
                        : styles.textInactive,
                  ]}
                >
                  {initialPermStatus.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.derivedDescription}>
              {initialPermStatus === "active"
                ? "Employee is in good organizational standing with active credentials."
                : initialPermStatus === "inactive"
                  ? "Employee is paused/inactive. Daily check-in is blocked until reactivated."
                  : "Employee is permanently terminated and barred from check-in."}
            </Text>
            <Text style={styles.derivedNote}>
              ℹ️ Permanent status is controlled only by HR lifecycle actions
              below. Daily check-in, check-out, and approved leave never mutate
              permanent status.
            </Text>
          </View>

          {/* 2. Permanent HR Lifecycle Actions */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionHeaderTitle}>HR Lifecycle Actions</Text>
            <Text style={styles.sectionHeaderSub}>
              Permanent employment status:{" "}
              <Text style={styles.permStatusHighlight}>
                {initialPermStatus.toUpperCase()}
              </Text>
            </Text>
          </View>

          <View style={styles.optionsList}>
            {LIFECYCLE_ACTIONS.map((opt) => {
              const isSelected = selectedAction === opt.value;
              const isCurrent = initialPermStatus === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setSelectedAction(opt.value)}
                  style={[
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                  ]}
                >
                  <View style={styles.optionRadio}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.optionContent}>
                    <View style={styles.optionTitleRow}>
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.optionDescription}>
                      {opt.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Notes Input */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>
              Administrative Notes (Optional)
            </Text>
            <TextInput
              maxLength={200}
              multiline
              numberOfLines={2}
              onChangeText={setNotes}
              placeholder="Reason for lifecycle status change..."
              placeholderTextColor={colors.muted}
              style={styles.notesInput}
              value={notes}
            />
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={onClose}
              style={[styles.btn, styles.cancelBtn]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={submitting || selectedAction === initialPermStatus}
              onPress={handleUpdate}
              style={[
                styles.btn,
                styles.submitBtn,
                (submitting || selectedAction === initialPermStatus) &&
                  styles.submitBtnDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Confirm Action</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "700",
  },
  derivedStatusCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm + 2,
    gap: spacing.xs,
  },
  derivedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  derivedLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  derivedDescription: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  derivedNote: {
    color: colors.muted,
    fontSize: 11,
    fontStyle: "italic",
    lineHeight: 16,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeActive: {
    backgroundColor: colors.accent,
  },
  textActive: {
    color: colors.success,
  },
  badgeOnLeave: {
    backgroundColor: "#FEF08A",
  },
  textOnLeave: {
    color: "#854D0E",
  },
  badgeInactive: {
    backgroundColor: "#F1F5F9",
  },
  textInactive: {
    color: colors.muted,
  },
  badgeTerminated: {
    backgroundColor: "#FEE2E2",
  },
  textTerminated: {
    color: "#DC2626",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sectionDivider: {
    borderTopColor: "#E2E8F0",
    borderTopWidth: 1,
    paddingTop: spacing.xs + 2,
    gap: 2,
  },
  sectionHeaderTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  sectionHeaderSub: {
    color: colors.muted,
    fontSize: 12,
  },
  permStatusHighlight: {
    color: colors.primary,
    fontWeight: "700",
  },
  optionsList: {
    gap: spacing.xs + 2,
  },
  optionRow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    padding: spacing.sm + 2,
    gap: spacing.sm,
  },
  optionRowSelected: {
    backgroundColor: "#F0F5FF",
    borderColor: colors.primary,
  },
  optionRadio: {
    alignItems: "center",
    borderColor: colors.muted,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioInner: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
  optionContent: {
    flex: 1,
    gap: 2,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  optionLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  currentBadge: {
    backgroundColor: "#E2E8F0",
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  currentBadgeText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  optionDescription: {
    color: colors.muted,
    fontSize: 12,
  },
  inputBlock: {
    gap: 4,
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  notesInput: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 13,
    minHeight: 60,
    padding: spacing.sm,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    alignItems: "center",
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  cancelBtn: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderWidth: 1,
  },
  cancelBtnText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: colors.primary,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
