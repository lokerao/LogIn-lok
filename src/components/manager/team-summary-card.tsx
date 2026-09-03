import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "@/constants/design-system";
import type { ManagerDashboardSummary } from "@/types/manager";

interface TeamSummaryCardProps {
  summary: ManagerDashboardSummary;
  onRefresh?: () => void;
}

export function TeamSummaryCard({ summary }: TeamSummaryCardProps) {
  const router = useRouter();

  const totalReports = summary.direct_reports_count;
  const att = summary.attendance;
  const work = summary.work;

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Team Overview</Text>
        <Text style={styles.subtitle}>
          {summary.team_name ? summary.team_name : "General Team"}
          {summary.department_name ? ` · ${summary.department_name}` : ""}
        </Text>
      </View>

      {/* KPI Grid */}
      <View style={styles.grid}>
        {/* KPI 1: Direct Reports */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Direct Reports</Text>
          <Text style={styles.kpiValue}>{totalReports}</Text>
          <Text style={styles.kpiNote}>Active employees</Text>
        </View>

        {/* KPI 2: Attendance Today */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/attendance" as any)}
          style={[styles.kpiCard, styles.clickableCard]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.kpiLabel}>Working Today</Text>
            <Text style={styles.arrowIcon}>↗</Text>
          </View>
          <Text style={[styles.kpiValue, { color: colors.success }]}>
            {att.checked_in}
          </Text>
          <Text style={styles.kpiNote}>
            {att.checked_out} out · {att.not_clocked_in} not in
          </Text>
        </Pressable>

        {/* KPI 3: Pending Leaves */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/leave" as any)}
          style={[styles.kpiCard, styles.clickableCard]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.kpiLabel}>Pending Leaves</Text>
            <Text style={styles.arrowIcon}>↗</Text>
          </View>
          <Text
            style={[
              styles.kpiValue,
              summary.pending_leaves_count > 0 ? { color: "#CA8A04" } : {},
            ]}
          >
            {summary.pending_leaves_count}
          </Text>
          <Text style={styles.kpiNote}>
            {summary.pending_leaves_count > 0 ? "Action required" : "All reviewed"}
          </Text>
        </Pressable>

        {/* KPI 4: Work Progress */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/(tabs)/work" as any)}
          style={[styles.kpiCard, styles.clickableCard]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.kpiLabel}>Today&apos;s Work</Text>
            <Text style={styles.arrowIcon}>↗</Text>
          </View>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {work.today_total}
          </Text>
          <Text style={styles.kpiNote}>
            {work.in_progress} active · {work.completed} done
            {work.overdue > 0 ? ` · ${work.overdue} overdue` : ""}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  headerBlock: {
    gap: 2,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  kpiCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flex: 1,
    minWidth: "46%",
    padding: spacing.sm + 2,
    gap: 4,
  },
  clickableCard: {
    borderColor: "#E2E8F0",
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  arrowIcon: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  kpiValue: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  kpiNote: {
    color: colors.muted,
    fontSize: 11,
  },
});
