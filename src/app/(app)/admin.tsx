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

import { AdminDashboardOverview } from "@/components/admin/admin-dashboard-overview";
import { AdminDepartmentsView } from "@/components/admin/admin-departments-view";
import { AdminDesignationsView } from "@/components/admin/admin-designations-view";
import { AdminEmployeeCard } from "@/components/admin/admin-employee-card";
import { AdminEmployeeEditModal } from "@/components/admin/admin-employee-edit-modal";
import { AdminLocationsView } from "@/components/admin/admin-locations-view";
import { AdminOrgStructureView } from "@/components/admin/admin-org-structure-view";
import { AdminRolesView } from "@/components/admin/admin-roles-view";
import { AdminTeamsView } from "@/components/admin/admin-teams-view";
import { EmptyModule } from "@/components/employee-screen";
import { TalentViewerRequestsReviewModal } from "@/components/talent-network/talent-viewer-requests-review-modal";
import { colors, radius, spacing } from "@/constants/design-system";
import {
  fetchAdminDashboardSummary,
  fetchAdminDepartments,
  fetchAdminEmployees,
} from "@/features/admin/admin-service";
import { useAuth } from "@/features/auth/auth-provider";
import type {
  AdminDashboardSummary,
  AdminDepartment,
  AdminEmployeeListItem,
} from "@/types/admin";
import type { AppRole } from "@/types/roles";

type AdminTab = "dashboard" | "employees" | "structure" | "roles";
type StructureSubTab =
  "departments" | "teams" | "designations" | "locations" | "tree";

export default function AdminScreen() {
  const router = useRouter();
  const { identity, session } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [structureSubTab, setStructureSubTab] =
    useState<StructureSubTab>("departments");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [employees, setEmployees] = useState<AdminEmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);

  // Directory filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState<
    "all" | "active" | "inactive" | "terminated"
  >("all");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Selected employee for editing organizational assignments
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [viewerRequestsVisible, setViewerRequestsVisible] = useState(false);

  const roles = identity?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isAuthorizedAdmin = Boolean(session && isAdmin);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!isAuthorizedAdmin) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [sumData, empData, deptData] = await Promise.all([
          fetchAdminDashboardSummary(),
          fetchAdminEmployees(),
          fetchAdminDepartments(),
        ]);

        setSummary(sumData);
        setEmployees(empData);
        setDepartments(deptData);
      } catch (err: any) {
        setError(err.message || "Failed to load admin management data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthorizedAdmin],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Client-side employee filtering
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Exclude external Talent Viewers and legacy test accounts
      if (
        emp.roles?.includes("talent_viewer") ||
        (emp.first_name === "Talent" && emp.last_name === "Viewer") ||
        (emp.first_name?.toLowerCase() === "test" &&
          emp.last_name?.toLowerCase() === "recruiter")
      ) {
        return false;
      }

      // 1. Employment status filter
      if (
        employmentFilter !== "all" &&
        emp.employment_status !== employmentFilter
      ) {
        return false;
      }

      // 2. Role filter
      if (roleFilter !== "all" && !emp.roles.includes(roleFilter)) {
        return false;
      }

      // 3. Department filter
      if (deptFilter !== "all" && emp.department_id !== deptFilter) {
        return false;
      }

      // 4. Search query
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
  }, [employees, employmentFilter, roleFilter, deptFilter, searchQuery]);

  function handleOpenEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    setEditModalVisible(true);
  }

  function handleNavigateFromDashboard(
    tab: "employees" | "structure" | "roles",
    subSection?: string,
  ) {
    setActiveTab(tab);
    if (tab === "structure" && subSection) {
      setStructureSubTab(subSection as StructureSubTab);
    }
  }

  if (!isAuthorizedAdmin) {
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
          message="The Administration hub is reserved exclusively for authorized System Administrators."
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
          <Text style={styles.pageTitle}>System Administration</Text>
          <Text style={styles.pageSubtitle}>
            {summary?.organization_name ?? "Organization"} · Governance Hub
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setViewerRequestsVisible(true)}
          style={styles.headerViewerBtn}
        >
          <Text style={styles.headerViewerBtnText}>Viewer Access</Text>
        </Pressable>
      </View>

      {/* Main Tabs Navigation */}
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
          onPress={() => setActiveTab("employees")}
          style={[
            styles.segmentBtn,
            activeTab === "employees" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === "employees" && styles.segmentTextActive,
            ]}
          >
            Employees ({employees.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("structure")}
          style={[
            styles.segmentBtn,
            activeTab === "structure" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === "structure" && styles.segmentTextActive,
            ]}
          >
            Structure
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("roles")}
          style={[
            styles.segmentBtn,
            activeTab === "roles" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === "roles" && styles.segmentTextActive,
            ]}
          >
            Roles & Access
          </Text>
        </Pressable>
      </View>

      {/* Main Tab Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading administration hub...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => loadData()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadData(true)}
              refreshing={refreshing}
            />
          }
        >
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && summary && (
            <AdminDashboardOverview
              onNavigateTab={handleNavigateFromDashboard}
              summary={summary}
            />
          )}

          {/* TAB 2: EMPLOYEES */}
          {activeTab === "employees" && (
            <View style={styles.tabBody}>
              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  clearButtonMode="while-editing"
                  onChangeText={setSearchQuery}
                  placeholder="Search by name, code, email, designation..."
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

              {/* Filter Group 1: Permanent Employment Status */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>EMPLOYMENT STATUS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {(
                      [
                        { id: "all", label: "All Statuses" },
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

              {/* Filter Group 2: Role Filter */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>ASSIGNED ROLE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {(
                      [
                        { id: "all", label: "All Roles" },
                        { id: "admin", label: "Admin" },
                        { id: "hr", label: "HR" },
                        { id: "manager", label: "Manager" },
                        { id: "employee", label: "Employee" },
                        { id: "talent_viewer", label: "Talent Viewer" },
                      ] as const
                    ).map((item) => {
                      const isSelected = roleFilter === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setRoleFilter(item.id)}
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

              {/* Filter Group 3: Department Filter */}
              {departments.length > 0 && (
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupLabel}>DEPARTMENT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      <Pressable
                        onPress={() => setDeptFilter("all")}
                        style={[
                          styles.filterChip,
                          deptFilter === "all" && styles.filterChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            deptFilter === "all" && styles.filterChipTextActive,
                          ]}
                        >
                          All Departments
                        </Text>
                      </Pressable>
                      {departments.map((d) => {
                        const isSelected = deptFilter === d.id;
                        return (
                          <Pressable
                            key={d.id}
                            onPress={() => setDeptFilter(d.id)}
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
                              {d.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Employee Cards List */}
              {filteredEmployees.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>
                    No matching employees found
                  </Text>
                  <Text style={styles.emptySub}>
                    Try adjusting your search criteria or filters.
                  </Text>
                </View>
              ) : (
                <View style={styles.employeeList}>
                  {filteredEmployees.map((emp) => (
                    <AdminEmployeeCard
                      key={emp.id}
                      employee={emp}
                      onPress={() => handleOpenEmployee(emp.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: STRUCTURE */}
          {activeTab === "structure" && (
            <View style={styles.tabBody}>
              {/* Structure Sub-navigation Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.subTabRow}>
                  {(
                    [
                      { id: "departments", label: "Departments" },
                      { id: "teams", label: "Teams" },
                      { id: "designations", label: "Designations" },
                      { id: "locations", label: "Locations" },
                      { id: "tree", label: "Hierarchy Tree" },
                    ] as const
                  ).map((st) => {
                    const isSelected = structureSubTab === st.id;
                    return (
                      <Pressable
                        key={st.id}
                        onPress={() => setStructureSubTab(st.id)}
                        style={[
                          styles.subTabBtn,
                          isSelected && styles.subTabBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.subTabText,
                            isSelected && styles.subTabTextActive,
                          ]}
                        >
                          {st.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Sub-tab Views */}
              {structureSubTab === "departments" && <AdminDepartmentsView />}
              {structureSubTab === "teams" && <AdminTeamsView />}
              {structureSubTab === "designations" && <AdminDesignationsView />}
              {structureSubTab === "locations" && <AdminLocationsView />}
              {structureSubTab === "tree" && (
                <AdminOrgStructureView onSelectEmployee={handleOpenEmployee} />
              )}
            </View>
          )}

          {/* TAB 4: ROLES & ACCESS */}
          {activeTab === "roles" && <AdminRolesView />}
        </ScrollView>
      )}

      {/* Employee Organization Assignment Modal */}
      <AdminEmployeeEditModal
        employeeId={selectedEmployeeId}
        onClose={() => {
          setSelectedEmployeeId(null);
          setEditModalVisible(false);
        }}
        onSaved={() => loadData()}
        visible={editModalVisible}
      />

      {/* External Talent Viewer Requests Review Modal */}
      <TalentViewerRequestsReviewModal
        onClose={() => setViewerRequestsVisible(false)}
        visible={viewerRequestsVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  headerViewerBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  headerViewerBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  topNav: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    paddingRight: 6,
    paddingVertical: 4,
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
  },
  segmentBtn: {
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flex: 1,
    paddingVertical: 12,
  },
  segmentBtnActive: {
    borderBottomColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  errorContainer: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: "700",
  },
  scrollBody: {
    paddingBottom: spacing.xl,
  },
  tabBody: {
    gap: spacing.md,
    padding: spacing.md,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    paddingVertical: 10,
  },
  clearSearch: {
    color: colors.muted,
    fontSize: 13,
    padding: 4,
  },
  filterGroup: {
    gap: 4,
  },
  filterGroupLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
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
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  emptyBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  emptySub: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
  employeeList: {
    gap: spacing.sm,
  },
  subTabRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  subTabBtn: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  subTabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subTabText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  subTabTextActive: {
    color: colors.white,
  },
});
