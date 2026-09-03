import { useRef, useState } from "react";
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

import { StatusIndicator } from "@/components/ui/status-indicator";
import { colors, radius, spacing, typography } from "@/constants/design-system";
import {
    formatLeaveDate,
    formatLeaveDays,
    reviewLeaveRequest,
} from "@/features/leave/leave-service";
import type { LeaveRequest } from "@/types/leave";

type Props = {
  request: LeaveRequest | null;
  visible: boolean;
  onClose: () => void;
  onReviewed: () => void;
};

export function LeaveReviewModal({
  request,
  visible,
  onClose,
  onReviewed,
}: Props) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionLock = useRef(false);

  function handleClose() {
    setNotes("");
    setError(null);
    actionLock.current = false;
    onClose();
  }

  async function doReview(action: "approve" | "reject") {
    if (!request || actionLock.current) return;
    actionLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await reviewLeaveRequest(request.id, action, notes);
      setNotes("");
      onReviewed();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : `Could not ${action} request.`;
      setError(msg);
      actionLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  function confirmAction(action: "approve" | "reject") {
    const label = action === "approve" ? "Approve" : "Reject";
    Alert.alert(
      `${label} Leave Request`,
      `Are you sure you want to ${label.toLowerCase()} this request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label,
          style: action === "reject" ? "destructive" : "default",
          onPress: () => void doReview(action),
        },
      ],
    );
  }

  if (!request) return null;

  const employeeName = request.employees
    ? (request.employees.profiles?.display_name ??
      `${request.employees.first_name} ${request.employees.last_name}`)
    : "Employee";
  const typeName = request.leave_types?.name ?? "Leave";

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Review Request</Text>
            <Pressable
              accessibilityLabel="Close"
              onPress={handleClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Request summary */}
            <View style={styles.summary}>
              <Text style={styles.employeeName}>{employeeName}</Text>
              <Text style={styles.typeName}>{typeName}</Text>
              <Text style={styles.dates}>
                {formatLeaveDate(request.start_date)}
                {request.start_date !== request.end_date
                  ? ` – ${formatLeaveDate(request.end_date)}`
                  : ""}
                {request.is_half_day ? " (½ day)" : ""}
              </Text>
              <Text style={styles.duration}>
                {formatLeaveDays(request.requested_days)}
              </Text>
              <StatusIndicator
                style={{ marginTop: spacing.xs }}
                variant={
                  request.status === "approved"
                    ? "approved"
                    : request.status === "rejected"
                      ? "rejected"
                      : "pending"
                }
              >
                {request.status.charAt(0).toUpperCase() +
                  request.status.slice(1)}
              </StatusIndicator>
            </View>

            <View style={styles.reasonBox}>
              <Text style={styles.fieldLabel}>{"Employee's Reason"}</Text>
              <Text style={styles.reasonText}>{request.reason}</Text>
            </View>

            {/* Reviewer notes */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Reviewer Note (Optional)</Text>
              <TextInput
                maxLength={1000}
                multiline
                numberOfLines={3}
                onChangeText={setNotes}
                placeholder="Add a note for the employee…"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textarea]}
                textAlignVertical="top"
                value={notes}
              />
            </View>

            {Boolean(error) && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {request.status === "pending" && (
              <View style={styles.actions}>
                <Pressable
                  disabled={submitting}
                  onPress={() => confirmAction("reject")}
                  style={({ pressed }) => [
                    styles.rejectBtn,
                    pressed && styles.rejectBtnPressed,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#B42318" size="small" />
                  ) : (
                    <Text style={styles.rejectText}>Reject</Text>
                  )}
                </Pressable>
                <Pressable
                  disabled={submitting}
                  onPress={() => confirmAction("approve")}
                  style={({ pressed }) => [
                    styles.approveBtn,
                    pressed && styles.approveBtnPressed,
                    styles.flex1,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.approveText}>Approve</Text>
                  )}
                </Pressable>
              </View>
            )}

            {request.status !== "pending" && (
              <View style={styles.alreadyReviewed}>
                <Text style={styles.alreadyReviewedText}>
                  This request has already been {request.status}.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(23,34,53,0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#EEF1F6",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  closeBtn: { padding: spacing.xs },
  closeTxt: { color: colors.muted, fontSize: 18 },
  body: { gap: spacing.md, padding: spacing.lg },
  summary: { gap: 4 },
  employeeName: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  typeName: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  dates: { color: colors.ink, fontSize: 15 },
  duration: { color: colors.muted, fontSize: 14 },
  reasonBox: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    gap: 4,
    padding: spacing.md,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  reasonText: { color: colors.ink, fontSize: 15 },
  field: { gap: spacing.xs },
  flex1: { flex: 1 },
  input: {
    backgroundColor: colors.canvas,
    borderColor: "#DEE4EF",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  textarea: { height: 80, paddingTop: 12 },
  errorBox: {
    backgroundColor: "#FEE4E2",
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: { color: "#B42318", fontSize: 14 },
  actions: { flexDirection: "row", gap: spacing.md },
  rejectBtn: {
    alignItems: "center",
    backgroundColor: "#FEE4E2",
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  rejectBtnPressed: { backgroundColor: "#FECDCA" },
  rejectText: { color: "#B42318", ...typography.button },
  approveBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  approveBtnPressed: { backgroundColor: colors.primaryPressed },
  approveText: { color: colors.white, ...typography.button },
  alreadyReviewed: { alignItems: "center", padding: spacing.md },
  alreadyReviewedText: { color: colors.muted, fontSize: 14 },
});
