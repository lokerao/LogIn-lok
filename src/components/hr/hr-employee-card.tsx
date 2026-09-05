import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import type { HREmployeeListItem } from "@/types/hr";

interface HREmployeeCardProps {
  employee: HREmployeeListItem;
  onPress: () => void;
}

export function HREmployeeCard({ employee, onPress }: HREmployeeCardProps) {
  const fullName =
    `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
    "Employee";
  const initials =
    `${employee.first_name?.[0] ?? ""}${employee.last_name?.[0] ?? ""}`.toUpperCase() ||
    fullName[0]?.toUpperCase() ||
    "E";

  const permStatus = employee.employment_status;
  const isPermActive = permStatus === "active";
  const isPermInactive = permStatus === "inactive";
  const isPermTerminated = permStatus === "terminated";

  const isOnLeave =
    Boolean(employee.has_approved_leave_today) ||
    employee.today_leave_status === "on_leave";
  const isWorkingOnLeave = Boolean(employee.working_on_leave);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Top row: Avatar, Info, Status Badges */}
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || "E"}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.code}>{employee.employee_code}</Text>
          <Text style={styles.designation}>
            {employee.designation_name ?? "Employee"}
            {employee.department_name ? ` · ${employee.department_name}` : ""}
          </Text>
          {employee.team_name ? (
            <Text style={styles.team}>Team: {employee.team_name}</Text>
          ) : null}
          {employee.manager_name ? (
            <Text style={styles.manager}>
              Reports to: {employee.manager_name}
            </Text>
          ) : null}
        </View>

        <View style={styles.badgeColumn}>
          {/* Permanent Employment Status */}
          <View
            style={[
              styles.statusBadge,
              isPermActive
                ? styles.badgeActive
                : isPermTerminated
                  ? styles.badgeTerminated
                  : styles.badgeInactive,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isPermActive
                  ? styles.textActive
                  : isPermTerminated
                    ? styles.textTerminated
                    : styles.textInactive,
              ]}
            >
              {permStatus.toUpperCase()}
            </Text>
          </View>

          {/* Operational Leave Indicators */}
          {isWorkingOnLeave ? (
            <View style={[styles.statusBadge, styles.badgeWarning]}>
              <Text style={[styles.statusText, styles.textWarning]}>
                ⚡ Working on Leave
              </Text>
            </View>
          ) : isOnLeave ? (
            <View style={[styles.statusBadge, styles.badgeOnLeave]}>
              <Text style={[styles.statusText, styles.textOnLeave]}>
                🏖 On Leave
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Bottom meta row: Attendance & Pending Indicators */}
      <View style={styles.metaRow}>
        {/* Attendance Today Badge */}
        <View
          style={[
            styles.indicatorBadge,
            isPermInactive || isPermTerminated
              ? styles.indicatorMuted
              : employee.today_attendance_status === "checked_in"
                ? styles.indicatorSuccess
                : employee.today_attendance_status === "checked_out"
                  ? styles.indicatorMuted
                  : styles.indicatorNeutral,
          ]}
        >
          <Text
            style={[
              styles.indicatorText,
              isPermInactive || isPermTerminated
                ? styles.indicatorTextNeutral
                : employee.today_attendance_status === "checked_in"
                  ? styles.indicatorTextSuccess
                  : styles.indicatorTextNeutral,
            ]}
          >
            {isPermInactive || isPermTerminated
              ? "Check-in Blocked"
              : employee.today_attendance_status === "checked_in"
                ? employee.today_check_in_time
                  ? `Working (${employee.today_check_in_time})`
                  : "Working"
                : employee.today_attendance_status === "checked_out"
                  ? employee.today_check_out_time
                    ? `Checked Out (${employee.today_check_out_time})`
                    : "Checked Out"
                  : "Not Checked In"}
          </Text>
        </View>

        {/* Pending Leaves Badge */}
        {employee.pending_leaves_count > 0 && (
          <View style={[styles.indicatorBadge, styles.indicatorWarning]}>
            <Text style={[styles.indicatorText, styles.indicatorTextWarning]}>
              {employee.pending_leaves_count} Leave req
            </Text>
          </View>
        )}

        {/* Active Tasks Badge */}
        {employee.active_tasks_count > 0 && (
          <View style={[styles.indicatorBadge, styles.indicatorInfo]}>
            <Text style={[styles.indicatorText, styles.indicatorTextInfo]}>
              {employee.active_tasks_count} tasks
            </Text>
          </View>
        )}

        {/* Working on Leave Badge */}
        {employee.working_on_leave && (
          <View style={[styles.indicatorBadge, styles.indicatorWarning]}>
            <Text style={[styles.indicatorText, styles.indicatorTextWarning]}>
              ⚡ Working on Leave
            </Text>
          </View>
        )}

        {/* Pending Talent Badge */}
        {employee.talent_review_status === "pending" && (
          <View style={[styles.indicatorBadge, styles.indicatorAlert]}>
            <Text style={[styles.indicatorText, styles.indicatorTextAlert]}>
              Talent pending
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  code: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  designation: {
    color: colors.ink,
    fontSize: 13,
    marginTop: 2,
  },
  team: {
    color: colors.muted,
    fontSize: 12,
  },
  manager: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
  },
  badgeColumn: {
    alignItems: "flex-end",
    gap: 4,
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
  badgeWarning: {
    backgroundColor: "#FEF3C7",
  },
  textWarning: {
    color: "#D97706",
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
  permStatusLabel: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    paddingTop: spacing.xs + 4,
  },
  indicatorBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  indicatorSuccess: {
    backgroundColor: colors.accent,
  },
  indicatorTextSuccess: {
    color: colors.success,
  },
  indicatorMuted: {
    backgroundColor: colors.canvas,
  },
  indicatorNeutral: {
    backgroundColor: "#F1F5F9",
  },
  indicatorTextNeutral: {
    color: colors.muted,
  },
  indicatorWarning: {
    backgroundColor: "#FEF08A",
  },
  indicatorTextWarning: {
    color: "#854D0E",
  },
  indicatorInfo: {
    backgroundColor: "#E0EAFF",
  },
  indicatorTextInfo: {
    color: colors.primary,
  },
  indicatorAlert: {
    backgroundColor: "#FEE2E2",
  },
  indicatorTextAlert: {
    color: "#DC2626",
  },
  indicatorText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
