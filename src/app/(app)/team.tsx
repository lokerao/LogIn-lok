import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import {
  EmployeeScreen,
  EmptyModule,
  employeeStyles,
} from "@/components/employee-screen";
import { DirectReportCard } from "@/components/manager/direct-report-card";
import { DirectReportProfileModal } from "@/components/manager/direct-report-profile-modal";
import { TeamSummaryCard } from "@/components/manager/team-summary-card";
import { CreateAssignmentModal } from "@/components/work/create-assignment-modal";
import { colors, radius, spacing } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import {
  fetchManagerDashboardSummary,
  fetchMyDirectReports,
} from "@/features/manager/manager-service";
import type {
  DirectReportSummary,
  ManagerDashboardSummary,
} from "@/types/manager";

type TeamViewSegment = "dashboard" | "team";

export default function ManagerTeamScreen() {
  const router = useRouter();
  const { identity } = useAuth();

  const roles = useMemo(() => identity?.roles ?? [], [identity?.roles]);
  const isManager = roles.includes("manager");

  const [activeSegment, setActiveSegment] = useState<TeamViewSegment>("dashboard");
  const [summary, setSummary] = useState<ManagerDashboardSummary | null>(null);
  const [directReports, setDirectReports] = useState<DirectReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [assignWorkModalVisible, setAssignWorkModalVisible] = useState(false);
  const [assignWorkEmployeeId, setAssignWorkEmployeeId] = useState<string | undefined>(undefined);

  const loadData = useCallback(async () => {
    if (!isManager) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const [sumData, repData] = await Promise.all([
        fetchManagerDashboardSummary(),
        fetchMyDirectReports(),
      ]);
      setSummary(sumData);
      setDirectReports(repData);
    } catch (err: any) {
      setError(err.message || "Failed to load manager team data.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [isManager]);

  useEffect(() => {
    if (isManager) {
      const timer = setTimeout(() => {
        void loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isManager, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const handleOpenAssignWork = useCallback((empId?: string) => {
    setAssignWorkEmployeeId(empId);
    setAssignWorkModalVisible(true);
  }, []);

  const handleCloseAssignWork = useCallback(() => {
    setAssignWorkModalVisible(false);
    setAssignWorkEmployeeId(undefined);
  }, []);

  // Filter direct reports by search
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return directReports;
    const q = searchQuery.toLowerCase().trim();
    return directReports.filter(
      (r) =>
        r.first_name.toLowerCase().includes(q) ||
        r.last_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q) ||
        (r.designation && r.designation.toLowerCase().includes(q)) ||
        (r.team && r.team.toLowerCase().includes(q)),
    );
  }, [directReports, searchQuery]);

  if (!isManager) {
    return (
      <EmployeeScreen title="My Team">
        <EmptyModule
          message="Manager role is required to access organization team hierarchy and dashboards."
          title="Access Restricted"
        />
      </EmployeeScreen>
    );
  }

  return (
    <EmployeeScreen title="My Team">
      {/* Top Header Actions */}
      <View style={styles.topActionsRow}>
        <View style={styles.segmentContainer}>
          <Pressable
            accessibilityRole="tab"
            onPress={() => setActiveSegment("dashboard")}
            style={[
              styles.segmentButton,
              activeSegment === "dashboard" && styles.segmentButtonActive,
            ]}
          >
            <Text
              style={[
                styles.segmentButtonText,
                activeSegment === "dashboard" && styles.segmentButtonTextActive,
              ]}
            >
              Dashboard
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            onPress={() => setActiveSegment("team")}
            style={[
              styles.segmentButton,
              activeSegment === "team" && styles.segmentButtonActive,
            ]}
          >
            <Text
              style={[
                styles.segmentButtonText,
                activeSegment === "team" && styles.segmentButtonTextActive,
              ]}
            >
              Direct Reports ({directReports.length})
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => handleOpenAssignWork()}
          style={styles.primaryActionBtn}
        >
          <Text style={styles.primaryActionBtnText}>+ Assign</Text>
        </Pressable>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading && !refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loaderText}>Loading team hierarchy...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsLoading(true);
                void loadData();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : activeSegment === "dashboard" ? (
          /* ================= DASHBOARD TAB ================= */
          <View style={styles.tabContent}>
            {summary && <TeamSummaryCard summary={summary} onRefresh={onRefresh} />}

            {/* Quick Actions Card */}
            <View style={employeeStyles.card}>
              <Text style={employeeStyles.label}>Manager Workflows</Text>
              <View style={styles.workflowLinks}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/leave" as any)}
                  style={styles.workflowRow}
                >
                  <View style={styles.workflowInfo}>
                    <Text style={styles.workflowTitle}>Leave Approvals</Text>
                    <Text style={styles.workflowSubtitle}>
                      {summary?.pending_leaves_count ?? 0} team leave requests pending
                    </Text>
                  </View>
                  <Text style={styles.workflowArrow}>›</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/(app)/(tabs)/work" as any)}
                  style={styles.workflowRow}
                >
                  <View style={styles.workflowInfo}>
                    <Text style={styles.workflowTitle}>Daily Work Hub</Text>
                    <Text style={styles.workflowSubtitle}>
                      Create tasks, monitor progress, and review deliverables
                    </Text>
                  </View>
                  <Text style={styles.workflowArrow}>›</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/attendance" as any)}
                  style={styles.workflowRow}
                >
                  <View style={styles.workflowInfo}>
                    <Text style={styles.workflowTitle}>Attendance Clock</Text>
                    <Text style={styles.workflowSubtitle}>
                      My shift check-in, check-out, and attendance history
                    </Text>
                  </View>
                  <Text style={styles.workflowArrow}>›</Text>
                </Pressable>
              </View>
            </View>

            {/* Direct Reports Quick Preview */}
            <View style={employeeStyles.card}>
              <View style={styles.previewHeader}>
                <Text style={employeeStyles.label}>Direct Reports</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveSegment("team")}
                >
                  <Text style={styles.viewAllLink}>View All ({directReports.length}) ›</Text>
                </Pressable>
              </View>

              {directReports.length === 0 ? (
                <Text style={styles.emptyText}>
                  No active direct reports assigned to you.
                </Text>
              ) : (
                <View style={styles.previewList}>
                  {directReports.slice(0, 3).map((report) => (
                    <DirectReportCard
                      key={report.id}
                      onPress={(r) => setSelectedReportId(r.id)}
                      report={report}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          /* ================= DIRECT REPORTS TAB ================= */
          <View style={styles.tabContent}>
            {/* Search Box */}
            <View style={styles.searchBox}>
              <TextInput
                clearButtonMode="while-editing"
                onChangeText={setSearchQuery}
                placeholder="Search direct reports..."
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            {filteredReports.length === 0 ? (
              <View style={employeeStyles.card}>
                <Text style={styles.emptyText}>
                  {searchQuery.trim()
                    ? "No direct reports match your search filter."
                    : "No active direct reports found for your account."}
                </Text>
              </View>
            ) : (
              <View style={styles.reportList}>
                {filteredReports.map((report) => (
                  <DirectReportCard
                    key={report.id}
                    onPress={(r) => setSelectedReportId(r.id)}
                    report={report}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Direct Report Profile Deep-Dive Modal */}
      <DirectReportProfileModal
        employeeId={selectedReportId}
        onAssignWork={(empId) => handleOpenAssignWork(empId)}
        onClose={() => setSelectedReportId(null)}
        visible={selectedReportId !== null}
      />

      {/* Phase 7 Create Assignment Modal (Seamless Integration) */}
      <CreateAssignmentModal
        initialEmployeeId={assignWorkEmployeeId}
        onClose={handleCloseAssignWork}
        onCreated={() => {
          handleCloseAssignWork();
          void loadData();
        }}
        visible={assignWorkModalVisible}
      />
    </EmployeeScreen>
  );
}

const styles = StyleSheet.create({
  topActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  segmentContainer: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
    flex: 1,
  },
  segmentButton: {
    borderRadius: radius.pill,
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentButtonTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  primaryActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  primaryActionBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  loaderText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  tabContent: {
    gap: spacing.md,
  },
  workflowLinks: {
    gap: spacing.xs,
    marginTop: 4,
  },
  workflowRow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  workflowInfo: {
    flex: 1,
    gap: 2,
  },
  workflowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  workflowSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  workflowArrow: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "700",
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewAllLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  previewList: {
    gap: spacing.sm,
    marginTop: 4,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  searchBox: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  searchInput: {
    color: colors.ink,
    fontSize: 14,
  },
  reportList: {
    gap: spacing.sm,
  },
});
