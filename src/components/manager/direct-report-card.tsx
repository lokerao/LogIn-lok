import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import type { DirectReportSummary } from "@/types/manager";

interface DirectReportCardProps {
  report: DirectReportSummary;
  onPress: (report: DirectReportSummary) => void;
}

export function DirectReportCard({ report, onPress }: DirectReportCardProps) {
  const fullName = `${report.first_name} ${report.last_name}`;
  const initial = report.first_name.slice(0, 1).toUpperCase();

  const isCheckedIn = report.today_attendance_status === "checked_in";
  const isCheckedOut = report.today_attendance_status === "checked_out";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(report)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {fullName}
            </Text>
            <Text style={styles.empCode}>{report.employee_code}</Text>
          </View>

          <Text numberOfLines={1} style={styles.designation}>
            {report.designation ?? "Employee"}
            {report.team ? ` · ${report.team}` : ""}
          </Text>
        </View>
      </View>

      {/* Badges Row */}
      <View style={styles.badgesRow}>
        {/* Attendance Status */}
        <View
          style={[
            styles.badge,
            isCheckedIn
              ? styles.badgeSuccess
              : isCheckedOut
              ? styles.badgeNeutral
              : styles.badgeWarning,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              isCheckedIn
                ? styles.dotSuccess
                : isCheckedOut
                ? styles.dotNeutral
                : styles.dotWarning,
            ]}
          />
          <Text
            style={[
              styles.badgeText,
              isCheckedIn
                ? styles.textSuccess
                : isCheckedOut
                ? styles.textNeutral
                : styles.textWarning,
            ]}
          >
            {isCheckedIn
              ? `In ${report.today_check_in_time ?? ""}`
              : isCheckedOut
              ? `Out ${report.today_check_out_time ?? ""}`
              : "Not clocked in"}
          </Text>
        </View>

        {/* Active Work Tasks */}
        <View style={[styles.badge, styles.badgeNeutral]}>
          <Text style={[styles.badgeText, styles.textNeutral]}>
            {report.active_tasks_count > 0
              ? `${report.active_tasks_count} active task${
                  report.active_tasks_count === 1 ? "" : "s"
                }`
              : report.completed_tasks_count > 0
              ? `${report.completed_tasks_count} completed`
              : "No tasks today"}
          </Text>
        </View>

        {/* Pending Leaves if any */}
        {report.pending_leaves_count > 0 && (
          <View style={[styles.badge, styles.badgeAlert]}>
            <Text style={[styles.badgeText, styles.textAlert]}>
              {report.pending_leaves_count} pending leave
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
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  infoBlock: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: spacing.xs,
  },
  empCode: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  designation: {
    color: colors.muted,
    fontSize: 13,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  statusDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  badgeSuccess: {
    backgroundColor: "#DCFCE7",
  },
  dotSuccess: {
    backgroundColor: colors.success,
  },
  textSuccess: {
    color: "#166534",
  },
  badgeNeutral: {
    backgroundColor: colors.canvas,
  },
  dotNeutral: {
    backgroundColor: colors.muted,
  },
  textNeutral: {
    color: colors.ink,
  },
  badgeWarning: {
    backgroundColor: "#FEF9C3",
  },
  dotWarning: {
    backgroundColor: "#CA8A04",
  },
  textWarning: {
    color: "#854D0E",
  },
  badgeAlert: {
    backgroundColor: "#FEE2E2",
  },
  textAlert: {
    color: "#DC2626",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
