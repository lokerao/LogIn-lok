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
    createAdminLocation,
    deleteAdminLocation,
    fetchAdminLocations,
    updateAdminLocation,
} from "@/features/admin/admin-service";
import type { AdminLocation } from "@/types/admin";

export function AdminLocationsView() {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modal states for Create / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLoc, setEditingLoc] = useState<AdminLocation | null>(null);
  const [locNameInput, setLocNameInput] = useState("");
  const [locCityInput, setLocCityInput] = useState("");
  const [locCountryInput, setLocCountryInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminLocations();
      setLocations(data);
    } catch (err: any) {
      setError(err.message || "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const filteredLocations = useMemo(() => {
    if (!search.trim()) return locations;
    const q = search.toLowerCase().trim();
    return locations.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.country_code && l.country_code.toLowerCase().includes(q)),
    );
  }, [locations, search]);

  function handleOpenCreate() {
    setEditingLoc(null);
    setLocNameInput("");
    setLocCityInput("");
    setLocCountryInput("");
    setModalError(null);
    setModalVisible(true);
  }

  function handleOpenEdit(loc: AdminLocation) {
    setEditingLoc(loc);
    setLocNameInput(loc.name);
    setLocCityInput(loc.city ?? "");
    setLocCountryInput(loc.country_code ?? "");
    setModalError(null);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!locNameInput.trim()) {
      setModalError("Location name is required.");
      return;
    }
    if (locNameInput.trim().length < 2 || locNameInput.trim().length > 100) {
      setModalError("Name must be between 2 and 100 characters.");
      return;
    }

    const cc = locCountryInput.trim().toUpperCase();
    if (cc && !/^[A-Z]{2}$/.test(cc)) {
      setModalError(
        "Country code must be a 2-letter uppercase code (e.g. IN, US, GB).",
      );
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      if (editingLoc) {
        await updateAdminLocation(
          editingLoc.id,
          locNameInput.trim(),
          locCityInput.trim() || null,
          cc || null,
        );
      } else {
        await createAdminLocation(
          locNameInput.trim(),
          locCityInput.trim() || null,
          cc || null,
        );
      }
      setModalVisible(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || "Failed to save location.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(loc: AdminLocation) {
    if (loc.employee_count > 0) {
      Alert.alert(
        "Cannot Delete Location",
        `This location is currently assigned to ${loc.employee_count} employee(s). Please reassign them before deleting.`,
      );
      return;
    }

    Alert.alert(
      "Delete Location",
      `Are you sure you want to delete "${loc.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAdminLocation(loc.id);
              await loadData();
            } catch (err: any) {
              Alert.alert(
                "Deletion Error",
                err.message || "Could not delete location.",
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
            placeholder="Search locations or cities..."
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
          <Text style={styles.createBtnText}>+ Add Location</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading locations...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredLocations.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No Locations Found</Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? "No location matches your search criteria."
              : "Create your organization's first work location."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredLocations.map((loc) => (
            <View key={loc.id} style={styles.locCard}>
              <View style={styles.locInfo}>
                <Text style={styles.locName}>{loc.name}</Text>
                <Text style={styles.locMeta}>
                  {loc.city ? `${loc.city}, ` : ""}
                  {loc.country_code ? `${loc.country_code} · ` : ""}
                  {loc.employee_count} employee(s)
                </Text>
              </View>

              <View style={styles.actionsCol}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleOpenEdit(loc)}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleDelete(loc)}
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
              {editingLoc ? "Edit Location" : "Create Location"}
            </Text>

            {modalError ? (
              <View style={styles.modalErrorBanner}>
                <Text style={styles.modalErrorText}>{modalError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>LOCATION NAME</Text>
            <TextInput
              autoFocus
              onChangeText={setLocNameInput}
              placeholder="e.g. Headquarters, Bangalore Branch, New York Office"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={locNameInput}
            />

            <Text style={styles.inputLabel}>CITY (OPTIONAL)</Text>
            <TextInput
              onChangeText={setLocCityInput}
              placeholder="e.g. Hyderabad, London, Tokyo"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={locCityInput}
            />

            <Text style={styles.inputLabel}>
              COUNTRY CODE (2-LETTER ISO, OPTIONAL)
            </Text>
            <TextInput
              autoCapitalize="characters"
              maxLength={2}
              onChangeText={setLocCountryInput}
              placeholder="e.g. IN, US, GB, DE"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={locCountryInput}
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
                    {editingLoc ? "Save Changes" : "Create"}
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
  locCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  locInfo: {
    flex: 1,
  },
  locName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  locMeta: {
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
