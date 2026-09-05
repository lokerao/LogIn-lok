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
  createAdminDepartment,
  deleteAdminDepartment,
  fetchAdminDepartments,
  updateAdminDepartment,
} from "@/features/admin/admin-service";
import type { AdminDepartment } from "@/types/admin";

export function AdminDepartmentsView() {
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modal states for Create / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDept, setEditingDept] = useState<AdminDepartment | null>(null);
  const [deptNameInput, setDeptNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDepartments();
      setDepartments(data);
    } catch (err: any) {
      setError(err.message || "Failed to load departments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const filteredDepartments = useMemo(() => {
    if (!search.trim()) return departments;
    const q = search.toLowerCase().trim();
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  function handleOpenCreate() {
    setEditingDept(null);
    setDeptNameInput("");
    setModalError(null);
    setModalVisible(true);
  }

  function handleOpenEdit(dept: AdminDepartment) {
    setEditingDept(dept);
    setDeptNameInput(dept.name);
    setModalError(null);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!deptNameInput.trim()) {
      setModalError("Department name is required.");
      return;
    }
    if (deptNameInput.trim().length < 2 || deptNameInput.trim().length > 100) {
      setModalError("Name must be between 2 and 100 characters.");
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      if (editingDept) {
        await updateAdminDepartment(editingDept.id, deptNameInput.trim());
      } else {
        await createAdminDepartment(deptNameInput.trim());
      }
      setModalVisible(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || "Failed to save department.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(dept: AdminDepartment) {
    if (dept.employee_count > 0 || dept.team_count > 0) {
      Alert.alert(
        "Cannot Delete Department",
        `This department currently has ${dept.employee_count} employee(s) and ${dept.team_count} team(s) assigned. Please reassign them before deleting.`,
      );
      return;
    }

    Alert.alert(
      "Delete Department",
      `Are you sure you want to delete "${dept.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAdminDepartment(dept.id);
              await loadData();
            } catch (err: any) {
              Alert.alert(
                "Deletion Error",
                err.message || "Could not delete department.",
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
            placeholder="Search departments..."
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
          <Text style={styles.createBtnText}>+ Add Department</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading departments...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredDepartments.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No Departments Found</Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? "No department matches your search criteria."
              : "Create your organization's first department."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredDepartments.map((dept) => (
            <View key={dept.id} style={styles.deptCard}>
              <View style={styles.deptInfo}>
                <Text style={styles.deptName}>{dept.name}</Text>
                <Text style={styles.deptMeta}>
                  {dept.employee_count} employee(s) · {dept.team_count} team(s)
                </Text>
              </View>

              <View style={styles.actionsCol}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleOpenEdit(dept)}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleDelete(dept)}
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
              {editingDept ? "Edit Department" : "Create Department"}
            </Text>

            {modalError ? (
              <View style={styles.modalErrorBanner}>
                <Text style={styles.modalErrorText}>{modalError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>DEPARTMENT NAME</Text>
            <TextInput
              autoFocus
              onChangeText={setDeptNameInput}
              placeholder="e.g. Engineering, Sales, Human Resources"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={deptNameInput}
            />

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
                    {editingDept ? "Save Changes" : "Create"}
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
  deptCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  deptInfo: {
    flex: 1,
  },
  deptName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  deptMeta: {
    color: colors.muted,
    fontSize: 11,
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
