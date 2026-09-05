import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import type { AdminDashboardSummary } from "@/types/admin";

interface AdminDashboardOverviewProps {
  summary: AdminDashboardSummary;
  onNavigateTab: (
    tab: "employees" | "structure" | "roles",
    subSection?: string,
  ) => void;
}

export function AdminDashboardOverview({
  summary,
  onNavigateTab,
}: AdminDashboardOverviewProps) {
  return (
    <View style={styles.container}>
      {/* Organization Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerIconBox}>
          <Text style={styles.bannerIcon}>🏢</Text>
        </View>
        <View style={styles.bannerInfo}>
          <Text style={styles.orgLabel}>ORGANIZATION</Text>
          <Text style={styles.orgName}>{summary.organization_name}</Text>
          <Text style={styles.orgMeta}>
            System Administration Hub · {summary.total_users} Active User
            Profiles
          </Text>
        </View>
      </View>

      {/* 1. Permanent Workforce Headcount */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Workforce Headcount</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("employees")}
            style={styles.viewLink}
          >
            <Text style={styles.viewLinkText}>All Employees ↗</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total</Text>
            <Text style={styles.kpiValue}>{summary.total_employees}</Text>
            <Text style={styles.kpiNote}>Enrolled records</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Active</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {summary.active_employees}
            </Text>
            <Text style={styles.kpiNote}>Operational</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Inactive</Text>
            <Text style={[styles.kpiValue, { color: colors.muted }]}>
              {summary.inactive_employees}
            </Text>
            <Text style={styles.kpiNote}>Paused accounts</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Terminated</Text>
            <Text style={[styles.kpiValue, { color: "#DC2626" }]}>
              {summary.terminated_employees}
            </Text>
            <Text style={styles.kpiNote}>Offboarded</Text>
          </View>
        </View>
      </View>

      {/* 2. Organization Structure Overview */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Structure & Locations</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure")}
            style={styles.viewLink}
          >
            <Text style={styles.viewLinkText}>Manage Structure ↗</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "departments")}
            style={styles.kpiBoxInteractive}
          >
            <Text style={styles.kpiLabel}>Departments</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {summary.total_departments}
            </Text>
            <Text style={styles.kpiNote}>Functional divisions ›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "teams")}
            style={styles.kpiBoxInteractive}
          >
            <Text style={styles.kpiLabel}>Teams</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {summary.total_teams}
            </Text>
            <Text style={styles.kpiNote}>Operational units ›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "designations")}
            style={styles.kpiBoxInteractive}
          >
            <Text style={styles.kpiLabel}>Designations</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {summary.total_designations}
            </Text>
            <Text style={styles.kpiNote}>Job titles ›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "locations")}
            style={styles.kpiBoxInteractive}
          >
            <Text style={styles.kpiLabel}>Locations</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {summary.total_locations}
            </Text>
            <Text style={styles.kpiNote}>Work offices ›</Text>
          </Pressable>
        </View>
      </View>

      {/* 3. Role & Access Distribution */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Application Roles & Access</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("roles")}
            style={styles.viewLink}
          >
            <Text style={styles.viewLinkText}>Manage Roles ↗</Text>
          </Pressable>
        </View>

        <View style={styles.roleGrid}>
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>Admins</Text>
            <Text style={[styles.roleCount, { color: "#7C3AED" }]}>
              {summary.roles_breakdown.admin}
            </Text>
            <Text style={styles.roleSub}>System authority</Text>
          </View>
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>HR Operations</Text>
            <Text style={[styles.roleCount, { color: "#2563EB" }]}>
              {summary.roles_breakdown.hr}
            </Text>
            <Text style={styles.roleSub}>Workforce lifecycle</Text>
          </View>
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>Managers</Text>
            <Text style={[styles.roleCount, { color: "#059669" }]}>
              {summary.roles_breakdown.manager}
            </Text>
            <Text style={styles.roleSub}>Team oversight</Text>
          </View>
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>Employees</Text>
            <Text style={[styles.roleCount, { color: colors.ink }]}>
              {summary.roles_breakdown.employee}
            </Text>
            <Text style={styles.roleSub}>Standard members</Text>
          </View>
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>Recruiters</Text>
            <Text style={[styles.roleCount, { color: "#D97706" }]}>
              {summary.roles_breakdown.recruiter}
            </Text>
            <Text style={styles.roleSub}>Talent viewer</Text>
          </View>
        </View>
      </View>

      {/* 4. Quick Administrative Actions */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Administrative Action Center</Text>

        <View style={styles.actionList}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("employees")}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Manage Employees</Text>
              <Text style={styles.actionSubtitle}>
                View directory and assign department, team, designation,
                location, manager
              </Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "departments")}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Department Management</Text>
              <Text style={styles.actionSubtitle}>
                Create, edit, or configure organization departments
              </Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "teams")}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Team Management</Text>
              <Text style={styles.actionSubtitle}>
                Structure operational teams and assign department linkages
              </Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "designations")}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Designation Management</Text>
              <Text style={styles.actionSubtitle}>
                Define job titles and corporate career designations
              </Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "locations")}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Office Locations</Text>
              <Text style={styles.actionSubtitle}>
                Manage branches, corporate offices, and work locations
              </Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("roles")}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Role & Access Control</Text>
              <Text style={styles.actionSubtitle}>
                Assign or revoke system privileges (Employee, Manager, HR,
                Admin, Recruiter)
              </Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigateTab("structure", "tree")}
            style={styles.actionRow}
          >
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>
                Organization Hierarchy Tree
              </Text>
              <Text style={styles.actionSubtitle}>
                Inspect corporate structure: Org → Departments → Teams →
                Managers → Employees
              </Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.md,
  },
  bannerCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  bannerIconBox: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: radius.sm,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  bannerIcon: {
    fontSize: 24,
  },
  bannerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  orgLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  orgName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  orgMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  viewLink: {
    paddingVertical: 2,
  },
  viewLinkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
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
    minWidth: 70,
    padding: spacing.sm,
  },
  kpiBoxInteractive: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minWidth: 70,
    padding: spacing.sm,
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  kpiValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    marginVertical: 2,
  },
  kpiNote: {
    color: colors.muted,
    fontSize: 10,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flex: 1,
    minWidth: 90,
    padding: spacing.sm,
  },
  roleTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  roleCount: {
    fontSize: 18,
    fontWeight: "800",
    marginVertical: 2,
  },
  roleSub: {
    color: colors.muted,
    fontSize: 9,
  },
  actionList: {
    gap: spacing.xs,
    marginTop: spacing.sm,
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
    paddingRight: spacing.sm,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  arrowText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "700",
  },
});
