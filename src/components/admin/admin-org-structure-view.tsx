import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import { fetchAdminOrganizationStructure } from "@/features/admin/admin-service";
import type { AdminOrgDepartmentStructure } from "@/types/admin";

interface AdminOrgStructureViewProps {
  onSelectEmployee?: (employeeId: string) => void;
}

export function AdminOrgStructureView({
  onSelectEmployee,
}: AdminOrgStructureViewProps) {
  const [departments, setDepartments] = useState<AdminOrgDepartmentStructure[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>(
    {},
  );
  const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>(
    {},
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminOrganizationStructure();
      setDepartments(data);
    } catch (err: any) {
      setError(err.message || "Failed to load hierarchy structure.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  function toggleDept(deptId: string) {
    setCollapsedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }));
  }

  function toggleTeam(teamId: string) {
    setCollapsedTeams((prev) => ({ ...prev, [teamId]: !prev[teamId] }));
  }

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading hierarchy structure...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={loadData} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (departments.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>No Organization Structure</Text>
        <Text style={styles.emptySubtitle}>
          Create departments and teams in the Structure tabs to build your
          hierarchy.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.introCard}>
        <Text style={styles.introTitle}>Organization Structure</Text>
        <Text style={styles.introSubtitle}>
          Hierarchical breakdown: Departments → Teams → Managers → Employees
        </Text>
      </View>

      {departments.map((dept) => {
        const isDeptCollapsed = Boolean(collapsedDepts[dept.id]);
        return (
          <View key={dept.id} style={styles.deptBlock}>
            {/* Department Header */}
            <Pressable
              accessibilityRole="button"
              onPress={() => toggleDept(dept.id)}
              style={styles.deptHeader}
            >
              <View style={styles.deptHeaderLeft}>
                <Text style={styles.collapseIcon}>
                  {isDeptCollapsed ? "▶" : "▼"}
                </Text>
                <Text style={styles.deptName}>{dept.name}</Text>
              </View>
              <View style={styles.deptBadge}>
                <Text style={styles.deptBadgeText}>
                  {dept.employee_count} members · {dept.teams.length} teams
                </Text>
              </View>
            </Pressable>

            {/* Teams inside Department */}
            {!isDeptCollapsed && (
              <View style={styles.teamsList}>
                {dept.teams.length === 0 ? (
                  <View style={styles.noTeamsBox}>
                    <Text style={styles.noTeamsText}>
                      No operational teams created under this department yet.
                    </Text>
                  </View>
                ) : (
                  dept.teams.map((team) => {
                    const isTeamCollapsed = Boolean(collapsedTeams[team.id]);
                    return (
                      <View key={team.id} style={styles.teamBlock}>
                        {/* Team Header */}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => toggleTeam(team.id)}
                          style={styles.teamHeader}
                        >
                          <View style={styles.teamHeaderLeft}>
                            <Text style={styles.collapseIconSmall}>
                              {isTeamCollapsed ? "▶" : "▼"}
                            </Text>
                            <Text style={styles.teamName}>{team.name}</Text>
                          </View>
                          <Text style={styles.teamMemberCount}>
                            {team.member_count} member(s)
                          </Text>
                        </Pressable>

                        {/* Team Contents: Manager & Members */}
                        {!isTeamCollapsed && (
                          <View style={styles.teamBody}>
                            {team.manager ? (
                              <View style={styles.managerRow}>
                                <Text style={styles.managerIcon}>👑</Text>
                                <View style={styles.managerInfo}>
                                  <Text style={styles.managerLabel}>
                                    TEAM MANAGER
                                  </Text>
                                  <Text style={styles.managerName}>
                                    {team.manager.name} (
                                    {team.manager.employee_code})
                                  </Text>
                                </View>
                              </View>
                            ) : (
                              <View style={styles.noManagerRow}>
                                <Text style={styles.noManagerText}>
                                  No manager assigned to this team
                                </Text>
                              </View>
                            )}

                            {/* Team Members List */}
                            <View style={styles.membersList}>
                              {team.members.length === 0 ? (
                                <Text style={styles.noMembersText}>
                                  No employees assigned to this team yet.
                                </Text>
                              ) : (
                                team.members.map((member) => (
                                  <Pressable
                                    key={member.id}
                                    onPress={() =>
                                      onSelectEmployee?.(member.id)
                                    }
                                    style={styles.memberRow}
                                  >
                                    <View style={styles.memberAvatar}>
                                      <Text style={styles.memberAvatarText}>
                                        {member.name[0]?.toUpperCase() || "E"}
                                      </Text>
                                    </View>
                                    <View style={styles.memberInfo}>
                                      <Text style={styles.memberName}>
                                        {member.name}
                                      </Text>
                                      <Text style={styles.memberMeta}>
                                        {member.employee_code} ·{" "}
                                        {member.designation ?? "Employee"}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        styles.memberStatusBadge,
                                        member.status === "active"
                                          ? styles.memberStatusActive
                                          : styles.memberStatusInactive,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.memberStatusText,
                                          member.status === "active"
                                            ? styles.memberStatusTextActive
                                            : styles.memberStatusTextInactive,
                                        ]}
                                      >
                                        {member.status.toUpperCase()}
                                      </Text>
                                    </View>
                                  </Pressable>
                                ))
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.md,
  },
  introCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  introTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  introSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  centerBox: {
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: "700",
  },
  emptyBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  deptBlock: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  deptHeader: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  deptHeaderLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  collapseIcon: {
    color: colors.muted,
    fontSize: 12,
    width: 14,
  },
  deptName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  deptBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deptBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
  teamsList: {
    gap: spacing.sm,
    padding: spacing.sm,
  },
  noTeamsBox: {
    padding: spacing.sm,
  },
  noTeamsText: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
  },
  teamBlock: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  teamHeader: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  teamHeaderLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  collapseIconSmall: {
    color: colors.muted,
    fontSize: 10,
    width: 12,
  },
  teamName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  teamMemberCount: {
    color: colors.muted,
    fontSize: 11,
  },
  teamBody: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  managerRow: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.xs,
  },
  managerIcon: {
    fontSize: 16,
  },
  managerInfo: {
    flex: 1,
  },
  managerLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  managerName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  noManagerRow: {
    padding: 2,
  },
  noManagerText: {
    color: colors.muted,
    fontSize: 11,
    fontStyle: "italic",
  },
  membersList: {
    gap: 4,
    marginTop: 4,
  },
  noMembersText: {
    color: colors.muted,
    fontSize: 11,
    fontStyle: "italic",
    paddingVertical: 2,
  },
  memberRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 6,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.xs,
  },
  memberAvatar: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  memberAvatarText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 10,
  },
  memberStatusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  memberStatusActive: {
    backgroundColor: "#DCFCE7",
  },
  memberStatusInactive: {
    backgroundColor: "#F1F5F9",
  },
  memberStatusText: {
    fontSize: 8,
    fontWeight: "800",
  },
  memberStatusTextActive: {
    color: "#166534",
  },
  memberStatusTextInactive: {
    color: "#64748B",
  },
});
