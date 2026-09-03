import { colors, radius, spacing } from "@/constants/design-system";
import {
    formatDueTime,
    formatWorkDate,
    isAssignmentOverdue,
} from "@/features/work/work-service";
import type {
    WorkAssignment,
    WorkAssignmentPriority,
    WorkAssignmentStatus,
} from "@/types/work";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface WorkAssignmentCardProps {
  assignment: WorkAssignment;
  onPress: () => void;
  showEmployeeName?: boolean;
}

const priorityStyles: Record<
  WorkAssignmentPriority,
  { label: string; bg: string; text: string }
> = {
  urgent: { label: "Urgent", bg: "#FEE4E2", text: "#B42318" },
  high: { label: "High", bg: "#FEF3EB", text: "#B54708" },
  medium: { label: "Medium", bg: "#EFF8FF", text: "#175CD3" },
  low: { label: "Low", bg: "#F2F4F7", text: "#475467" },
};

const statusStyles: Record<
  WorkAssignmentStatus,
  { label: string; bg: string; text: string }
> = {
  assigned: { label: "Assigned", bg: "#F2F4F7", text: "#475467" },
  in_progress: { label: "In Progress", bg: "#EFF8FF", text: "#175CD3" },
  blocked: { label: "Blocked", bg: "#FEE4E2", text: "#B42318" },
  completed: { label: "Completed", bg: "#ECFDF3", text: "#027A48" },
  cancelled: { label: "Cancelled", bg: "#F2F4F7", text: "#98A2B3" },
};

export function WorkAssignmentCard({
  assignment,
  onPress,
  showEmployeeName = false,
}: WorkAssignmentCardProps) {
  const isOverdue = isAssignmentOverdue(assignment);
  const priorityInfo =
    priorityStyles[assignment.priority] ?? priorityStyles.medium;
  const statusInfo = statusStyles[assignment.status] ?? statusStyles.assigned;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Top badges row */}
      <View style={styles.topRow}>
        <View style={styles.badgeGroup}>
          <View style={[styles.badge, { backgroundColor: priorityInfo.bg }]}>
            <Text style={[styles.badgeText, { color: priorityInfo.text }]}>
              {priorityInfo.label}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.badgeText, { color: statusInfo.text }]}>
              {statusInfo.label}
            </Text>
          </View>
          {isOverdue && (
            <View style={[styles.badge, styles.overdueBadge]}>
              <Text style={styles.overdueText}>Overdue</Text>
            </View>
          )}
        </View>

        <Text style={styles.progressPercentText}>
          {assignment.progress_percent}%
        </Text>
      </View>

      {/* Task title */}
      <Text numberOfLines={2} style={styles.title}>
        {assignment.title}
      </Text>

      {/* Task short description */}
      {Boolean(assignment.description) && (
        <Text numberOfLines={2} style={styles.description}>
          {assignment.description}
        </Text>
      )}

      {/* Employee name (if team/HR view) */}
      {showEmployeeName && Boolean(assignment.employee_name) && (
        <View style={styles.employeeRow}>
          <Text style={styles.employeeLabel}>Assignee:</Text>
          <Text style={styles.employeeName}>
            {assignment.employee_name}
            {assignment.employee_code ? ` (${assignment.employee_code})` : ""}
          </Text>
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(Math.max(assignment.progress_percent, 0), 100)}%`,
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

      {/* Bottom meta row: Date & Due time */}
      <View style={styles.bottomRow}>
        <Text style={styles.dateText}>
          📅 {formatWorkDate(assignment.work_date)}
          {assignment.due_time
            ? ` · Due ${formatDueTime(assignment.due_time)}`
            : ""}
        </Text>
        {Boolean(assignment.assigned_by_name) && !showEmployeeName && (
          <Text style={styles.assignedByText}>
            By {assignment.assigned_by_name}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    gap: spacing.sm,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  badgeGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  overdueBadge: {
    backgroundColor: "#FEE4E2",
    borderColor: "#B42318",
    borderWidth: 1,
  },
  overdueText: {
    color: "#B42318",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  progressPercentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  description: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  employeeLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  employeeName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    height: 6,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    borderRadius: radius.pill,
    height: "100%",
  },
  bottomRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  dateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  assignedByText: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
  },
});
