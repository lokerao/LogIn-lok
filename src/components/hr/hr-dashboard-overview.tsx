import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import type { HRDashboardSummary } from "@/types/hr";

interface HRDashboardOverviewProps {
  summary: HRDashboardSummary;
  onNavigateTab: (tab: "directory" | "org_structure" | "talent_queue") => void;
}

export function HRDashboardOverview({
  summary,
  onNavigateTab,
}: HRDashboardOverviewProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* 1. Permanent Workforce Headcount Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Workforce Headcount</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("directory")}
            style={styles.viewLink}
          >
            <Text style={styles.viewLinkText}>Directory ↗</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total</Text>
            <Text style={styles.kpiValue}>{summary.total_employees}</Text>
            <Text style={styles.kpiNote}>Enrolled workforce</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Active</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {summary.active_employees}
            </Text>
            <Text style={styles.kpiNote}>Permanent active</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Inactive</Text>
            <Text style={[styles.kpiValue, { color: colors.muted }]}>
              {summary.inactive_employees}
            </Text>
            <Text style={styles.kpiNote}>HR paused / Inactive</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Terminated</Text>
            <Text style={[styles.kpiValue, { color: "#DC2626" }]}>
              {summary.terminated_employees ?? 0}
            </Text>
            <Text style={styles.kpiNote}>Offboarded</Text>
          </View>
        </View>
      </View>

      {/* 2. Today's Attendance & Operations Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Today&apos;s Attendance & Leave
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Working Now</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {summary.working_today_count}
            </Text>
            <Text style={styles.kpiNote}>Checked in</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Checked Out</Text>
            <Text style={[styles.kpiValue, { color: colors.ink }]}>
              {summary.today_checked_out_count ?? 0}
            </Text>
            <Text style={styles.kpiNote}>Shift completed</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Not Checked In</Text>
            <Text style={[styles.kpiValue, { color: colors.muted }]}>
              {summary.today_not_checked_in_count ??
                Math.max(
                  0,
                  summary.active_employees -
                    summary.working_today_count -
                    (summary.today_checked_out_count ?? 0) -
                    summary.on_leave_employees,
                )}
            </Text>
            <Text style={styles.kpiNote}>Pending arrival</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>On Leave</Text>
            <Text style={[styles.kpiValue, { color: "#CA8A04" }]}>
              {summary.on_leave_employees}
            </Text>
            <Text style={styles.kpiNote}>Approved leave</Text>
          </View>
        </View>
      </View>

      {/* 2. Operational Action Queues */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Operational Action Queues</Text>
        <View style={styles.actionList}>
          {/* Attendance Review Queue */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/attendance" as any)}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Attendance Verification</Text>
              <Text style={styles.actionSubtitle}>
                Live check-in and check-out photo audits
              </Text>
            </View>
            <View style={styles.badgeRow}>
              {summary.pending_attendance_count > 0 ? (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>
                    {summary.pending_attendance_count} Pending
                  </Text>
                </View>
              ) : (
                <View style={styles.cleanBadge}>
                  <Text style={styles.cleanBadgeText}>Up to date</Text>
                </View>
              )}
              <Text style={styles.arrowText}>›</Text>
            </View>
          </Pressable>

          {/* Leave Review Queue */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/leave" as any)}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Leave Approvals</Text>
              <Text style={styles.actionSubtitle}>
                Employee time-off requests requiring decision
              </Text>
            </View>
            <View style={styles.badgeRow}>
              {summary.pending_leaves_count > 0 ? (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>
                    {summary.pending_leaves_count} Pending
                  </Text>
                </View>
              ) : (
                <View style={styles.cleanBadge}>
                  <Text style={styles.cleanBadgeText}>All reviewed</Text>
                </View>
              )}
              <Text style={styles.arrowText}>›</Text>
            </View>
          </Pressable>

          {/* Talent Profile Queue */}
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("talent_queue")}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Talent Profile Reviews</Text>
              <Text style={styles.actionSubtitle}>
                Professional profiles, skills, and credential submissions
              </Text>
            </View>
            <View style={styles.badgeRow}>
              {summary.pending_talent_reviews_count > 0 ? (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>
                    {summary.pending_talent_reviews_count} Pending
                  </Text>
                </View>
              ) : (
                <View style={styles.cleanBadge}>
                  <Text style={styles.cleanBadgeText}>All verified</Text>
                </View>
              )}
              <Text style={styles.arrowText}>›</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* 3. Organization & Shift Status */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Organization & Daily Status</Text>
        <View style={styles.grid}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("org_structure")}
            style={[styles.kpiBox, styles.clickableBox]}
          >
            <Text style={styles.kpiLabel}>Departments</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {summary.departments_count}
            </Text>
            <Text style={styles.kpiNote}>View structure ↗</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("org_structure")}
            style={[styles.kpiBox, styles.clickableBox]}
          >
            <Text style={styles.kpiLabel}>Teams</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {summary.teams_count}
            </Text>
            <Text style={styles.kpiNote}>View teams ↗</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/attendance" as any)}
            style={[styles.kpiBox, styles.clickableBox]}
          >
            <Text style={styles.kpiLabel}>Working Today</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {summary.working_today_count}
            </Text>
            <Text style={styles.kpiNote}>Clocked in now ↗</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(app)/(tabs)/work" as any)}
            style={[styles.kpiBox, styles.clickableBox]}
          >
            <Text style={styles.kpiLabel}>Today&apos;s Work</Text>
            <Text style={[styles.kpiValue, { color: colors.ink }]}>
              {summary.work_summary.today_total}
            </Text>
            <Text style={styles.kpiNote}>
              {summary.work_summary.completed} done ·{" "}
              {summary.work_summary.overdue} overdue ↗
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  viewLink: {
    paddingVertical: 2,
  },
  viewLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  kpiBox: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flex: 1,
    minWidth: "46%",
    padding: spacing.sm + 2,
    gap: 3,
  },
  clickableBox: {
    borderColor: "#E2E8F0",
    borderWidth: 1,
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  kpiValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  kpiNote: {
    color: colors.muted,
    fontSize: 11,
  },
  actionList: {
    gap: spacing.xs + 2,
    marginTop: 2,
  },
  actionRow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  actionInfo: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  alertBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alertBadgeText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "700",
  },
  cleanBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cleanBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "700",
  },
  arrowText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "700",
  },
});
