import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { StatusIndicator } from "@/components/ui/status-indicator";
import { colors, radius, spacing } from "@/constants/design-system";
import {
    cancelLeaveRequest,
    formatLeaveDate,
    formatLeaveDays,
} from "@/features/leave/leave-service";
import type { LeaveRequest, LeaveRequestStatus } from "@/types/leave";

function statusVariant(
  s: LeaveRequestStatus,
): "approved" | "pending" | "rejected" | "default" {
  if (s === "approved") return "approved";
  if (s === "pending") return "pending";
  if (s === "rejected") return "rejected";
  return "default";
}

function statusLabel(s: LeaveRequestStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function LeaveRequestCard({
  request,
  onCancelled,
  showEmployee = false,
}: {
  request: LeaveRequest;
  onCancelled?: () => void;
  showEmployee?: boolean;
}) {
  const [cancelling, setCancelling] = useState(false);
  const typeName = request.leave_types?.name ?? "Leave";
  const employeeName =
    showEmployee && request.employees
      ? (request.employees.profiles?.display_name ??
        `${request.employees.first_name} ${request.employees.last_name}`)
      : null;

  function confirmCancel() {
    Alert.alert(
      "Cancel Leave Request",
      "Are you sure you want to cancel this leave request? This cannot be undone.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: () => void doCancel(),
        },
      ],
    );
  }

  async function doCancel() {
    setCancelling(true);
    try {
      await cancelLeaveRequest(request.id);
      onCancelled?.();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not cancel request.";
      Alert.alert("Cancellation Failed", msg);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          {employeeName && (
            <Text style={styles.employeeName}>{employeeName}</Text>
          )}
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
        </View>
        <StatusIndicator variant={statusVariant(request.status)}>
          {statusLabel(request.status)}
        </StatusIndicator>
      </View>

      {Boolean(request.reason) && (
        <Text style={styles.reason} numberOfLines={2}>
          {request.reason}
        </Text>
      )}

      {Boolean(request.reviewer_notes) && (
        <View style={styles.reviewerNote}>
          <Text style={styles.reviewerNoteLabel}>Reviewer note</Text>
          <Text style={styles.reviewerNoteText}>{request.reviewer_notes}</Text>
        </View>
      )}

      {request.status === "pending" && !showEmployee && (
        <Pressable
          disabled={cancelling}
          onPress={confirmCancel}
          style={({ pressed }) => [
            styles.cancelBtn,
            pressed && styles.cancelBtnPressed,
          ]}
        >
          {cancelling ? (
            <ActivityIndicator color="#B42318" size="small" />
          ) : (
            <Text style={styles.cancelText}>Cancel Request</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    gap: spacing.sm,
    padding: spacing.md,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleBlock: { flex: 1, gap: 2, paddingRight: spacing.sm },
  employeeName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  typeName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  dates: { color: colors.ink, fontSize: 14 },
  duration: { color: colors.muted, fontSize: 13 },
  reason: { color: colors.muted, fontSize: 14 },
  reviewerNote: {
    backgroundColor: "#F6F8FC",
    borderRadius: radius.sm,
    gap: 2,
    padding: spacing.sm,
  },
  reviewerNoteLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  reviewerNoteText: { color: colors.ink, fontSize: 14 },
  cancelBtn: {
    alignItems: "center",
    backgroundColor: "#FEE4E2",
    borderRadius: radius.sm,
    paddingVertical: 10,
  },
  cancelBtnPressed: { backgroundColor: "#FECDCA" },
  cancelText: { color: "#B42318", fontSize: 14, fontWeight: "700" },
});
