import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import type { HRDepartmentStructure } from "@/types/hr";

interface HROrgStructureViewProps {
  departments: HRDepartmentStructure[];
  onSelectEmployee: (employeeId: string) => void;
}

export function HROrgStructureView({
  departments,
  onSelectEmployee,
}: HROrgStructureViewProps) {
  if (departments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Departments Found</Text>
        <Text style={styles.emptySubtitle}>
          No organizational departments have been configured for your
          organization.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {departments.map((dept) => (
        <View key={dept.id} style={styles.deptCard}>
          {/* Department Header */}
          <View style={styles.deptHeader}>
            <View>
              <Text style={styles.deptName}>{dept.name}</Text>
              <Text style={styles.deptSubtitle}>
                {dept.employee_count}{" "}
                {dept.employee_count === 1 ? "Employee" : "Employees"} enrolled
              </Text>
            </View>
            <View style={styles.deptBadge}>
              <Text style={styles.deptBadgeText}>
                {dept.teams.length} Teams
              </Text>
            </View>
          </View>

          {/* Teams List */}
          <View style={styles.teamsList}>
            {dept.teams.length === 0 ? (
              <Text style={styles.noTeamsText}>
                No teams established under this department.
              </Text>
            ) : (
              dept.teams.map((team) => (
                <View key={team.id} style={styles.teamBox}>
                  {/* Team Header */}
                  <View style={styles.teamHeader}>
                    <View style={styles.teamTitleCol}>
                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.teamManager}>
                        {team.manager
                          ? `Manager: ${team.manager.name} (${team.manager.employee_code})`
                          : "Manager: Unassigned"}
                      </Text>
                    </View>
                    <View style={styles.teamBadge}>
                      <Text style={styles.teamBadgeText}>
                        {team.member_count}{" "}
                        {team.member_count === 1 ? "Member" : "Members"}
                      </Text>
                    </View>
                  </View>

                  {/* Members Grid */}
                  <View style={styles.membersGrid}>
                    {team.members.length === 0 ? (
                      <Text style={styles.noMembersText}>
                        No members enrolled in this team.
                      </Text>
                    ) : (
                      team.members.map((mem) => (
                        <Pressable
                          key={mem.id}
                          accessibilityRole="button"
                          onPress={() => onSelectEmployee(mem.id)}
                          style={({ pressed }) => [
                            styles.memberChip,
                            pressed && styles.memberChipPressed,
                          ]}
                        >
                          <View style={styles.chipAvatar}>
                            <Text style={styles.chipAvatarText}>
                              {mem.name?.[0]?.toUpperCase() ?? "E"}
                            </Text>
                          </View>
                          <View style={styles.chipInfo}>
                            <Text style={styles.chipName} numberOfLines={1}>
                              {mem.name}
                            </Text>
                            <Text style={styles.chipMeta} numberOfLines={1}>
                              {mem.designation ?? mem.employee_code}
                            </Text>
                          </View>
                        </Pressable>
                      ))
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  emptyContainer: {
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
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  deptCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  deptHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  deptName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  deptSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  deptBadge: {
    backgroundColor: "#F0F5FF",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deptBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  teamsList: {
    gap: spacing.sm + 2,
  },
  noTeamsText: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic",
  },
  teamBox: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm + 4,
    gap: spacing.sm,
  },
  teamHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  teamTitleCol: {
    flex: 1,
    gap: 2,
  },
  teamName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  teamManager: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
  },
  teamBadge: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  teamBadgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  membersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  noMembersText: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
  },
  memberChip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs + 2,
    minWidth: "48%",
    flex: 1,
    padding: spacing.xs + 4,
  },
  memberChipPressed: {
    backgroundColor: "#F1F5F9",
  },
  chipAvatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  chipAvatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  chipInfo: {
    flex: 1,
  },
  chipName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  chipMeta: {
    color: colors.muted,
    fontSize: 10,
  },
});
