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
    createAdminTeam,
    deleteAdminTeam,
    fetchAdminDepartments,
    fetchAdminTeams,
    updateAdminTeam,
} from "@/features/admin/admin-service";
import type { AdminDepartment, AdminTeam } from "@/types/admin";

export function AdminTeamsView() {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modal states for Create / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamsData, deptsData] = await Promise.all([
        fetchAdminTeams(),
        fetchAdminDepartments(),
      ]);
      setTeams(teamsData);
      setDepartments(deptsData);
    } catch (err: any) {
      setError(err.message || "Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase().trim();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.department_name && t.department_name.toLowerCase().includes(q)),
    );
  }, [teams, search]);

  function handleOpenCreate() {
    setEditingTeam(null);
    setTeamNameInput("");
    setSelectedDeptId(null);
    setModalError(null);
    setModalVisible(true);
  }

  function handleOpenEdit(team: AdminTeam) {
    setEditingTeam(team);
    setTeamNameInput(team.name);
    setSelectedDeptId(team.department_id);
    setModalError(null);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!teamNameInput.trim()) {
      setModalError("Team name is required.");
      return;
    }
    if (teamNameInput.trim().length < 2 || teamNameInput.trim().length > 100) {
      setModalError("Name must be between 2 and 100 characters.");
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      if (editingTeam) {
        await updateAdminTeam(
          editingTeam.id,
          teamNameInput.trim(),
          selectedDeptId,
        );
      } else {
        await createAdminTeam(teamNameInput.trim(), selectedDeptId);
      }
      setModalVisible(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || "Failed to save team.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(team: AdminTeam) {
    if (team.employee_count > 0) {
      Alert.alert(
        "Cannot Delete Team",
        `This team currently has ${team.employee_count} employee(s) assigned. Please reassign them before deleting.`,
      );
      return;
    }

    Alert.alert(
      "Delete Team",
      `Are you sure you want to delete "${team.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAdminTeam(team.id);
              await loadData();
            } catch (err: any) {
              Alert.alert(
                "Deletion Error",
                err.message || "Could not delete team.",
              );
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      {/* Action Header */}
      <View style={styles.actionHeader}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            onChangeText={setSearch}
            placeholder="Search teams or departments..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={search}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleOpenCreate}
          style={styles.createBtn}
        >
          <Text style={styles.createBtnText}>+ Add Team</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading teams...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredTeams.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No Teams Found</Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? "No team matches your search criteria."
              : "Create your organization's first operational team."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredTeams.map((team) => (
            <View key={team.id} style={styles.teamCard}>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamMeta}>
                  Dept: {team.department_name ?? "Unassigned"} ·{" "}
                  {team.employee_count} member(s)
                </Text>
                {team.manager ? (
                  <Text style={styles.teamManager}>
                    Manager: {team.manager.name} ({team.manager.employee_code})
                  </Text>
                ) : null}
              </View>

              <View style={styles.actionsCol}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleOpenEdit(team)}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleDelete(team)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create/Edit Modal */}
      <Modal
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        transparent
        visible={modalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTeam ? "Edit Team" : "Create Team"}
            </Text>

            {modalError ? (
              <View style={styles.modalErrorBanner}>
                <Text style={styles.modalErrorText}>{modalError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>TEAM NAME</Text>
            <TextInput
              autoFocus
              onChangeText={setTeamNameInput}
              placeholder="e.g. Frontend Core, Enterprise Sales"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={teamNameInput}
            />

            <Text style={styles.inputLabel}>ASSIGN DEPARTMENT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <Pressable
                  onPress={() => setSelectedDeptId(null)}
                  style={[
                    styles.chip,
                    selectedDeptId === null && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedDeptId === null && styles.chipTextActive,
                    ]}
                  >
                    Unassigned
                  </Text>
                </Pressable>
                {departments.map((dept) => {
                  const isSelected = selectedDeptId === dept.id;
                  return (
                    <Pressable
                      key={dept.id}
                      onPress={() => setSelectedDeptId(dept.id)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextActive,
                        ]}
                      >
                        {dept.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                disabled={saving}
                onPress={() => setModalVisible(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={handleSave}
                style={[styles.modalSaveBtn, saving && styles.btnDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>
                    {editingTeam ? "Save Changes" : "Create"}
                  </Text>
                )}
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
  actionHeader: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
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
  createBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  createBtnText: {
    color: colors.white,
    fontSize: 12,
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
  teamCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  teamMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  teamManager: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  actionsCol: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  editBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  deleteBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteBtnText: {
    color: "#991B1B",
    fontSize: 11,
    fontWeight: "700",
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    gap: spacing.sm,
    maxWidth: 420,
    padding: spacing.lg,
    width: "100%",
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  modalErrorBanner: {
    backgroundColor: "#FEE2E2",
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  modalErrorText: {
    color: "#991B1B",
    fontSize: 12,
  },
  inputLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  textInput: {
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: spacing.sm,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
    marginTop: spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelBtnText: {
    color: colors.muted,
    fontWeight: "600",
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    minWidth: 80,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalSaveBtnText: {
    color: colors.white,
    fontWeight: "700",
    textAlign: "center",
  },
});
