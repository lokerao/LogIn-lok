import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import {
    assignUserRole,
    fetchAdminRolesOverview,
    removeUserRole,
} from "@/features/admin/admin-service";
import type { AdminUserRoleItem } from "@/types/admin";
import type { AppRole } from "@/types/roles";

const ALL_ROLES: {
  key: AppRole;
  label: string;
  desc: string;
  color: string;
}[] = [
  {
    key: "admin",
    label: "Admin",
    desc: "Organization-level system administration",
    color: "#7C3AED",
  },
  {
    key: "hr",
    label: "HR",
    desc: "Workforce lifecycle, attendance audits, leave",
    color: "#2563EB",
  },
  {
    key: "manager",
    label: "Manager",
    desc: "Team oversight, direct reports, work assignments",
    color: "#059669",
  },
  {
    key: "employee",
    label: "Employee",
    desc: "Standard workforce member access",
    color: colors.ink,
  },
  {
    key: "recruiter",
    label: "Recruiter",
    desc: "Talent viewer access for verified profiles",
    color: "#D97706",
  },
];

export function AdminRolesView() {
  const [users, setUsers] = useState<AdminUserRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [error, setError] = useState<string | null>(null);

  // Manage Role Modal
  const [selectedUser, setSelectedUser] = useState<AdminUserRoleItem | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminRolesOverview();
      setUsers(data);
      // Update selectedUser if modal is open
      if (selectedUser) {
        const updated = data.find(
          (u) => u.profile_id === selectedUser.profile_id,
        );
        if (updated) setSelectedUser(updated);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load user roles.");
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Role filter
      if (roleFilter !== "all" && !u.roles.includes(roleFilter)) {
        return false;
      }
      // 2. Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const fullName =
          `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase();
        const disp = (u.display_name ?? "").toLowerCase();
        const code = (u.employee_code ?? "").toLowerCase();
        const email = (u.work_email ?? "").toLowerCase();
        if (
          !fullName.includes(q) &&
          !disp.includes(q) &&
          !code.includes(q) &&
          !email.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [users, roleFilter, search]);

  function handleOpenManage(user: AdminUserRoleItem) {
    setSelectedUser(user);
    setModalError(null);
    setModalVisible(true);
  }

  async function handleToggleRole(roleKey: AppRole, hasRole: boolean) {
    if (!selectedUser) return;

    if (hasRole) {
      // Removing role
      Alert.alert(
        "Remove Role",
        `Are you sure you want to remove the "${roleKey.toUpperCase()}" role from ${selectedUser.first_name ?? selectedUser.display_name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setActionLoading(true);
              setModalError(null);
              try {
                await removeUserRole(selectedUser.profile_id, roleKey);
                // Refresh list
                const data = await fetchAdminRolesOverview();
                setUsers(data);
                const updated = data.find(
                  (u) => u.profile_id === selectedUser.profile_id,
                );
                if (updated) setSelectedUser(updated);
              } catch (err: any) {
                setModalError(err.message || "Could not remove role.");
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      );
    } else {
      // Adding role
      const isSensitive = roleKey === "admin" || roleKey === "hr";
      if (isSensitive) {
        Alert.alert(
          "Grant High-Privilege Role",
          `Granting "${roleKey.toUpperCase()}" permissions provides significant authority in your organization. Are you sure you want to proceed?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Grant Role",
              onPress: async () => {
                await executeAssignRole(roleKey);
              },
            },
          ],
        );
      } else {
        await executeAssignRole(roleKey);
      }
    }
  }

  async function executeAssignRole(roleKey: AppRole) {
    if (!selectedUser) return;
    setActionLoading(true);
    setModalError(null);
    try {
      await assignUserRole(selectedUser.profile_id, roleKey);
      const data = await fetchAdminRolesOverview();
      setUsers(data);
      const updated = data.find(
        (u) => u.profile_id === selectedUser.profile_id,
      );
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      setModalError(err.message || "Could not assign role.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Search and Filters */}
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            onChangeText={setSearch}
            placeholder="Search users by name, email, code..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={search}
          />
        </View>

        {/* Role Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setRoleFilter("all")}
              style={[styles.chip, roleFilter === "all" && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  roleFilter === "all" && styles.chipTextActive,
                ]}
              >
                All Roles
              </Text>
            </Pressable>
            {ALL_ROLES.map((r) => {
              const isSelected = roleFilter === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setRoleFilter(r.key)}
                  style={[styles.chip, isSelected && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading user roles...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No Users Found</Text>
          <Text style={styles.emptySubtitle}>
            No user profiles match your filter criteria.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredUsers.map((u) => {
            const displayName =
              `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
              u.display_name ||
              "User";
            return (
              <View key={u.profile_id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.avatarText}>
                      {displayName[0]?.toUpperCase() || "U"}
                    </Text>
                  </View>
                  <View style={styles.userInfoCol}>
                    <Text style={styles.userName}>{displayName}</Text>
                    <Text style={styles.userMeta}>
                      {u.employee_code ? `${u.employee_code} · ` : ""}
                      {u.work_email ?? "No email"}
                    </Text>
                    {u.designation || u.department ? (
                      <Text style={styles.userDesignation}>
                        {u.designation ?? "No Designation"}
                        {u.department ? ` · ${u.department}` : ""}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleOpenManage(u)}
                    style={styles.manageBtn}
                  >
                    <Text style={styles.manageBtnText}>Manage</Text>
                  </Pressable>
                </View>

                {/* Assigned Roles List */}
                <View style={styles.roleBadgesRow}>
                  {u.roles.length === 0 ? (
                    <Text style={styles.noRolesText}>No roles assigned</Text>
                  ) : (
                    u.roles.map((rk) => (
                      <View
                        key={rk}
                        style={[
                          styles.roleBadge,
                          rk === "admin"
                            ? styles.roleAdmin
                            : rk === "hr"
                              ? styles.roleHR
                              : rk === "manager"
                                ? styles.roleManager
                                : rk === "recruiter"
                                  ? styles.roleRecruiter
                                  : styles.roleEmployee,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            rk === "admin"
                              ? styles.roleAdminText
                              : rk === "hr"
                                ? styles.roleHRText
                                : rk === "manager"
                                  ? styles.roleManagerText
                                  : rk === "recruiter"
                                    ? styles.roleRecruiterText
                                    : styles.roleEmployeeText,
                          ]}
                        >
                          {rk.toUpperCase()}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Role Management Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        transparent
        visible={modalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage User Roles</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedUser?.first_name} {selectedUser?.last_name} (
                  {selectedUser?.work_email})
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {modalError ? (
              <View style={styles.modalErrorBanner}>
                <Text style={styles.modalErrorText}>{modalError}</Text>
              </View>
            ) : null}

            {actionLoading ? (
              <View style={styles.modalCenterBox}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.modalLoadingText}>
                  Updating permissions...
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.roleOptionsList}>
                {ALL_ROLES.map((r) => {
                  const hasRole = Boolean(selectedUser?.roles.includes(r.key));
                  return (
                    <View key={r.key} style={styles.roleOptionRow}>
                      <View style={styles.roleOptionInfo}>
                        <View style={styles.roleOptionHeader}>
                          <Text
                            style={[styles.roleOptionTitle, { color: r.color }]}
                          >
                            {r.label}
                          </Text>
                          {hasRole ? (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>
                                ASSIGNED
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        disabled={actionLoading}
                        onPress={() => handleToggleRole(r.key, hasRole)}
                        style={[
                          styles.toggleBtn,
                          hasRole ? styles.removeBtn : styles.addBtn,
                        ]}
                      >
                        <Text
                          style={[
                            styles.toggleBtnText,
                            hasRole ? styles.removeBtnText : styles.addBtnText,
                          ]}
                        >
                          {hasRole ? "Revoke" : "Grant"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.doneBtn}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  header: {
    gap: spacing.xs,
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
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: "700",
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
  list: {
    gap: spacing.xs,
  },
  userCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  userHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  userAvatar: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: radius.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  userInfoCol: {
    flex: 1,
  },
  userName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  userMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 1,
  },
  userDesignation: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  manageBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  manageBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  roleBadgesRow: {
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingTop: spacing.xs,
  },
  noRolesText: {
    color: colors.muted,
    fontSize: 11,
    fontStyle: "italic",
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleAdmin: { backgroundColor: "#F5F3FF" },
  roleHR: { backgroundColor: "#EFF6FF" },
  roleManager: { backgroundColor: "#ECFDF5" },
  roleEmployee: { backgroundColor: "#F8FAFC" },
  roleRecruiter: { backgroundColor: "#FFFBEB" },
  roleBadgeText: { fontSize: 9, fontWeight: "800" },
  roleAdminText: { color: "#6D28D9" },
  roleHRText: { color: "#1D4ED8" },
  roleManagerText: { color: "#047857" },
  roleEmployeeText: { color: "#475569" },
  roleRecruiterText: { color: "#B45309" },
  modalOverlay: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    padding: spacing.md,
  },
  modalHeader: {
    alignItems: "center",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "700",
  },
  modalErrorBanner: {
    backgroundColor: "#FEE2E2",
    borderRadius: radius.sm,
    marginVertical: spacing.xs,
    padding: spacing.sm,
  },
  modalErrorText: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "600",
  },
  modalCenterBox: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  modalLoadingText: {
    color: colors.muted,
    fontSize: 12,
  },
  roleOptionsList: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  roleOptionRow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  roleOptionInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  roleOptionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  roleOptionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  activePill: {
    backgroundColor: "#DCFCE7",
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activePillText: {
    color: "#166534",
    fontSize: 8,
    fontWeight: "800",
  },
  roleOptionDesc: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  toggleBtn: {
    borderRadius: 6,
    minWidth: 70,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtn: {
    backgroundColor: colors.primary,
  },
  removeBtn: {
    backgroundColor: "#FEE2E2",
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  addBtnText: {
    color: colors.white,
  },
  removeBtnText: {
    color: "#991B1B",
  },
  modalFooter: {
    borderTopColor: "#E2E8F0",
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  doneBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
  },
  doneBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
});
