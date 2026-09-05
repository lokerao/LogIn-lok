import { useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyModule } from "@/components/employee-screen";
import { HRDashboardOverview } from "@/components/hr/hr-dashboard-overview";
import { HREmployeeCard } from "@/components/hr/hr-employee-card";
import { HREmployeeDetailsModal } from "@/components/hr/hr-employee-details-modal";
import { HROrgStructureView } from "@/components/hr/hr-org-structure-view";
import { HRTalentReviewModal } from "@/components/hr/hr-talent-review-modal";
import { colors, radius, spacing } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import {
    fetchHRDashboardSummary,
    fetchHREmployeeDirectory,
    fetchHROrganizationStructure,
    fetchHRPendingTalentReviews,
} from "@/features/hr/hr-service";
import type {
    HRDashboardSummary,
    HRDepartmentStructure,
    HREmployeeListItem,
    HRPendingTalentReview,
} from "@/types/hr";

type HRTab = "dashboard" | "directory" | "org_structure" | "talent_queue";

export default function HRScreen() {
  const router = useRouter();
  const { identity, session } = useAuth();

  const [activeTab, setActiveTab] = useState<HRTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<HRDashboardSummary | null>(null);
  const [directory, setDirectory] = useState<HREmployeeListItem[]>([]);
  const [orgStructure, setOrgStructure] = useState<HRDepartmentStructure[]>([]);
  const [talentReviews, setTalentReviews] = useState<HRPendingTalentReview[]>(
    [],
  );

  // Directory filter & search
  const [searchQuery, setSearchQuery] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState<
    "all" | "active" | "inactive" | "terminated"
  >("all");
  const [operationalFilter, setOperationalFilter] = useState<
    "all" | "checked_in" | "checked_out" | "not_checked_in" | "on_leave"
  >("all");

  // Inspection modals
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTalentReview, setSelectedTalentReview] =
    useState<HRPendingTalentReview | null>(null);
  const [talentModalVisible, setTalentModalVisible] = useState(false);

  const roles = identity?.roles ?? [];
  const isHR = roles.includes("hr");
  const isAdmin = roles.includes("admin") && !isHR;
  const isRecruiter = roles.includes("recruiter") && !isHR;

  // Authorization check
  const isAuthorizedHR = Boolean(session && isHR && !isAdmin && !isRecruiter);

  const loadAllHRData = useCallback(
    async (isRefresh = false) => {
      if (!isAuthorizedHR) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [sumData, dirData, orgData, talentData] = await Promise.all([
          fetchHRDashboardSummary(),
          fetchHREmployeeDirectory(),
          fetchHROrganizationStructure(),
          fetchHRPendingTalentReviews(),
        ]);

        setSummary(sumData);
        setDirectory(dirData);
        setOrgStructure(orgData);
        setTalentReviews(talentData);
      } catch (err: any) {
        setError(err.message || "Failed to load HR data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthorizedHR],
  );

  // Client-side canonical filtering: perfectly orthogonal & zero-latency
  const filteredDirectory = useMemo(() => {
    return directory.filter((emp) => {
      // 1. Permanent Employment Status filter (HR lifecycle)
      if (
        employmentFilter !== "all" &&
        emp.employment_status !== employmentFilter
      ) {
        return false;
      }

      // 2. Today's Operational Attendance / Leave filter
      if (operationalFilter !== "all") {
        if (operationalFilter === "checked_in") {
          if (emp.today_attendance_status !== "checked_in") return false;
        } else if (operationalFilter === "checked_out") {
          if (emp.today_attendance_status !== "checked_out") return false;
        } else if (operationalFilter === "not_checked_in") {
          const isNotCheckedIn =
            emp.today_attendance_status === "not_checked_in" ||
            emp.today_attendance_status === "not_clocked_in" ||
            !emp.today_attendance_status;
          if (!isNotCheckedIn) return false;
        } else if (operationalFilter === "on_leave") {
          const isOnLeave =
            emp.today_leave_status === "on_leave" ||
            Boolean(emp.has_approved_leave_today);
          if (!isOnLeave) return false;
        }
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName =
          `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.toLowerCase();
        const code = (emp.employee_code ?? "").toLowerCase();
        const email = (emp.work_email ?? "").toLowerCase();
        const dept = (emp.department_name ?? "").toLowerCase();
        const desig = (emp.designation_name ?? "").toLowerCase();
        if (
          !fullName.includes(q) &&
          !code.includes(q) &&
          !email.includes(q) &&
          !dept.includes(q) &&
          !desig.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [directory, employmentFilter, operationalFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => void loadAllHRData(), 0);
    return () => clearTimeout(timer);
  }, [loadAllHRData]);

  const handleOpenEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setDetailsModalVisible(true);
  };

  const handleOpenTalentReview = (review: HRPendingTalentReview) => {
    setSelectedTalentReview(review);
    setTalentModalVisible(true);
  };

  if (!isAuthorizedHR) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topNav}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>‹ Back</Text>
          </Pressable>
        </View>
        <EmptyModule
          message="The HR operational hub is reserved exclusively for authorized HR personnel."
          title="Access Restricted"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topNav}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>‹ Back</Text>
        </Pressable>
        <View style={styles.titleCol}>
          <Text style={styles.pageTitle}>HR & Organization Hub</Text>
          <Text style={styles.pageSubtitle}>Workforce Administration</Text>
        </View>
      </View>

      {/* Segmented Navigation Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab("dashboard")}
          style={[
            styles.segmentBtn,
            activeTab === "dashboard" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === "dashboard" && styles.segmentTextActive,
            ]}
          >
            Dashboard
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("directory")}
          style={[
            styles.segmentBtn,
            activeTab === "directory" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === "directory" && styles.segmentTextActive,
            ]}
          >
            Directory ({directory.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("org_structure")}
          style={[
            styles.segmentBtn,
            activeTab === "org_structure" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === "org_structure" && styles.segmentTextActive,
            ]}
          >
            Structure
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("talent_queue")}
          style={[
            styles.segmentBtn,
            activeTab === "talent_queue" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === "talent_queue" && styles.segmentTextActive,
            ]}
          >
            Talent ({talentReviews.length})
          </Text>
        </Pressable>
      </View>

      {/* Main Body */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading HR management hub...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => loadAllHRData()}
            style={styles.retryBtn}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => loadAllHRData(true)}
              refreshing={refreshing}
            />
          }
        >
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && summary && (
            <HRDashboardOverview
              onNavigateTab={(tab) => setActiveTab(tab)}
              summary={summary}
            />
          )}

          {/* TAB 2: DIRECTORY */}
          {activeTab === "directory" && (
            <View style={styles.tabBody}>
              {/* Search input */}
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  clearButtonMode="while-editing"
                  onChangeText={setSearchQuery}
                  placeholder="Search by name, code, or email..."
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  value={searchQuery}
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <Text style={styles.clearSearch}>✕</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Directory Filter Chips */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>EMPLOYMENT STATUS</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                >
                  <View style={styles.chipRow}>
                    {(
                      [
                        { id: "all", label: "All Headcount" },
                        { id: "active", label: "Active" },
                        { id: "inactive", label: "Inactive" },
                        { id: "terminated", label: "Terminated" },
                      ] as const
                    ).map((item) => {
                      const isSelected = employmentFilter === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setEmploymentFilter(item.id)}
                          style={[
                            styles.filterChip,
                            isSelected && styles.filterChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isSelected && styles.filterChipTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>
                  TODAY&apos;S OPERATIONS
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                >
                  <View style={styles.chipRow}>
                    {(
                      [
                        { id: "all", label: "All Operations" },
                        { id: "checked_in", label: "Working Now" },
                        { id: "checked_out", label: "Checked Out" },
                        { id: "not_checked_in", label: "Not Checked In" },
                        { id: "on_leave", label: "On Leave" },
                      ] as const
                    ).map((item) => {
                      const isSelected = operationalFilter === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() =>
                            setOperationalFilter(
                              isSelected && item.id !== "all" ? "all" : item.id,
                            )
                          }
                          style={[
                            styles.filterChip,
                            isSelected && styles.filterChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isSelected && styles.filterChipTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Directory List */}
              {filteredDirectory.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>
                    No matching employees found
                  </Text>
                  <Text style={styles.emptySub}>
                    Try adjusting your search criteria or status filter.
                  </Text>
                </View>
              ) : (
                <View style={styles.employeeList}>
                  {filteredDirectory.map((emp) => (
                    <HREmployeeCard
                      key={emp.id}
                      employee={emp}
                      onPress={() => handleOpenEmployee(emp.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: ORGANIZATION STRUCTURE */}
          {activeTab === "org_structure" && (
            <HROrgStructureView
              departments={orgStructure}
              onSelectEmployee={handleOpenEmployee}
            />
          )}

          {/* TAB 4: TALENT REVIEW QUEUE */}
          {activeTab === "talent_queue" && (
            <View style={styles.tabBody}>
              <View style={styles.queueHeader}>
                <Text style={styles.queueTitle}>
                  Pending Talent Profile Reviews
                </Text>
                <Text style={styles.queueSub}>
                  Review employee professional credentials before publication
                </Text>
              </View>

              {talentReviews.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>
                    All Talent Profiles Reviewed
                  </Text>
                  <Text style={styles.emptySub}>
                    There are no pending professional profiles waiting for
                    verification.
                  </Text>
                </View>
              ) : (
                talentReviews.map((rev) => (
                  <View key={rev.employee_id} style={styles.talentCard}>
                    <View style={styles.talentHeader}>
                      <View style={styles.talentAvatar}>
                        <Text style={styles.talentAvatarText}>
                          {rev.employee_name?.[0]?.toUpperCase() ?? "T"}
                        </Text>
                      </View>
                      <View style={styles.talentMetaCol}>
                        <Text style={styles.talentEmpName}>
                          {rev.employee_name}
                        </Text>
                        <Text style={styles.talentEmpCode}>
                          {rev.employee_code} · {rev.designation ?? "Employee"}
                        </Text>
                        <Text style={styles.talentDept}>
                          {rev.department ?? "General"}
                        </Text>
                      </View>
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    </View>

                    <View style={styles.talentBody}>
                      <Text style={styles.talentTitleRow}>
                        <Text style={styles.talentLabel}>Title: </Text>
                        <Text style={styles.talentVal}>
                          {rev.professional_title ?? "Not specified"}
                        </Text>
                      </Text>
                      <Text style={styles.talentTitleRow}>
                        <Text style={styles.talentLabel}>Talent ID: </Text>
                        <Text style={styles.talentVal}>{rev.talent_id}</Text>
                      </Text>
                      <Text style={styles.talentSubCounts}>
                        {rev.pending_skills_count} skills ·{" "}
                        {rev.pending_experiences_count} exp ·{" "}
                        {rev.pending_projects_count} projects ·{" "}
                        {rev.pending_certifications_count} certs
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleOpenTalentReview(rev)}
                      style={styles.reviewBtn}
                    >
                      <Text style={styles.reviewBtnText}>Inspect & Decide</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Employee Full Inspection Modal */}
      <HREmployeeDetailsModal
        employeeId={selectedEmployeeId}
        onClose={() => {
          setSelectedEmployeeId(null);
          setDetailsModalVisible(false);
        }}
        onStatusChanged={() => loadAllHRData()}
        visible={detailsModalVisible}
      />

      {/* Talent Review Decision Modal */}
      <HRTalentReviewModal
        onClose={() => {
          setSelectedTalentReview(null);
          setTalentModalVisible(false);
        }}
        onSuccess={() => loadAllHRData()}
        review={selectedTalentReview}
        visible={talentModalVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  topNav: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 6,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  titleCol: {
    flex: 1,
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  pageSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  tabContainer: {
    backgroundColor: colors.white,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  segmentBtn: {
    alignItems: "center",
    borderRadius: radius.pill,
    flex: 1,
    paddingVertical: 8,
  },
  segmentBtnActive: {
    backgroundColor: "#F0F5FF",
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  tabBody: {
    gap: spacing.md,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  clearSearch: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  filterGroup: {
    gap: 4,
  },
  filterGroupLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  filterScroll: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs + 2,
  },
  filterChip: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  employeeList: {
    gap: spacing.sm,
  },
  emptyBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  emptySub: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  queueHeader: {
    gap: 2,
    marginBottom: 4,
  },
  queueTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  queueSub: {
    color: colors.muted,
    fontSize: 12,
  },
  talentCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  talentHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  talentAvatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  talentAvatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  talentMetaCol: {
    flex: 1,
    gap: 2,
  },
  talentEmpName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  talentEmpCode: {
    color: colors.muted,
    fontSize: 12,
  },
  talentDept: {
    color: colors.muted,
    fontSize: 11,
  },
  pendingBadge: {
    backgroundColor: "#FEF08A",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    color: "#854D0E",
    fontSize: 11,
    fontWeight: "700",
  },
  talentBody: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  talentTitleRow: {
    fontSize: 13,
  },
  talentLabel: {
    color: colors.muted,
    fontWeight: "600",
  },
  talentVal: {
    color: colors.ink,
    fontWeight: "700",
  },
  talentSubCounts: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  reviewBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
  },
  reviewBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
});
