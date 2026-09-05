import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import {
    fetchAdminDepartments,
    fetchAdminDesignations,
    fetchAdminEmployeeDetails,
    fetchAdminEmployees,
    fetchAdminLocations,
    fetchAdminTeams,
    updateEmployeeOrganization,
} from "@/features/admin/admin-service";
import type {
    AdminDepartment,
    AdminDesignation,
    AdminEmployeeDetails,
    AdminEmployeeListItem,
    AdminLocation,
    AdminTeam,
} from "@/types/admin";

interface AdminEmployeeEditModalProps {
  employeeId: string | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function AdminEmployeeEditModal({
  employeeId,
  visible,
  onClose,
  onSaved,
}: AdminEmployeeEditModalProps) {
  const [details, setDetails] = useState<AdminEmployeeDetails | null>(null);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [designations, setDesignations] = useState<AdminDesignation[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [managers, setManagers] = useState<AdminEmployeeListItem[]>([]);

  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedDesigId, setSelectedDesigId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [selectedMgrId, setSelectedMgrId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const [empDetails, depts, desigs, tms, locs, emps] = await Promise.all([
        fetchAdminEmployeeDetails(employeeId),
        fetchAdminDepartments(),
        fetchAdminDesignations(),
        fetchAdminTeams(),
        fetchAdminLocations(),
        fetchAdminEmployees(),
      ]);

      setDetails(empDetails);
      setDepartments(depts);
      setDesignations(desigs);
      setTeams(tms);
      setLocations(locs);
      setManagers(emps.filter((e) => e.id !== employeeId));

      setSelectedDeptId(empDetails.department_id);
      setSelectedDesigId(empDetails.designation_id);
      setSelectedTeamId(empDetails.team_id);
      setSelectedLocId(empDetails.location_id);
      setSelectedMgrId(empDetails.manager_employee_id);
    } catch (err: any) {
      setError(err.message || "Failed to load employee details.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (visible && employeeId) {
      const timer = setTimeout(() => void loadAllData(), 0);
      return () => clearTimeout(timer);
    }
  }, [visible, employeeId, loadAllData]);

  async function handleSave() {
    if (!employeeId) return;
    setSaving(true);
    setError(null);
    try {
      await updateEmployeeOrganization(employeeId, {
        department_id: selectedDeptId,
        designation_id: selectedDesigId,
        team_id: selectedTeamId,
        location_id: selectedLocId,
        manager_employee_id: selectedMgrId,
      });

      Alert.alert(
        "Assignments Updated",
        "Employee organizational assignments updated successfully.",
      );
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update assignments.");
    } finally {
      setSaving(false);
    }
  }

  // Filter teams for selected department (or all if none selected)
  const availableTeams = selectedDeptId
    ? teams.filter(
        (t) => !t.department_id || t.department_id === selectedDeptId,
      )
    : teams;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle}>Organizational Assignments</Text>
              <Text style={styles.headerSubtitle}>
                {details?.first_name} {details?.last_name} (
                {details?.employee_code})
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading assignments...</Text>
            </View>
          ) : error && !details ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={loadAllData} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              ) : null}

              {/* Notice regarding HR lifecycle separation */}
              <View style={styles.boundaryNote}>
                <Text style={styles.boundaryNoteTitle}>
                  ℹ️ Role Boundary Note
                </Text>
                <Text style={styles.boundaryNoteText}>
                  Employment lifecycle (Active / Inactive / Terminated) is
                  managed strictly by HR. System Admins configure organizational
                  structure assignments and role permissions.
                </Text>
              </View>

              {/* 1. Department Picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DEPARTMENT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    <Pressable
                      onPress={() => {
                        setSelectedDeptId(null);
                        setSelectedTeamId(null);
                      }}
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
                    {departments.map((d) => {
                      const isSelected = selectedDeptId === d.id;
                      return (
                        <Pressable
                          key={d.id}
                          onPress={() => {
                            setSelectedDeptId(d.id);
                            // If currently selected team belongs to a different department, clear team
                            const currentTeam = teams.find(
                              (t) => t.id === selectedTeamId,
                            );
                            if (
                              currentTeam?.department_id &&
                              currentTeam.department_id !== d.id
                            ) {
                              setSelectedTeamId(null);
                            }
                          }}
                          style={[styles.chip, isSelected && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
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

              {/* 2. Team Picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>TEAM</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    <Pressable
                      onPress={() => setSelectedTeamId(null)}
                      style={[
                        styles.chip,
                        selectedTeamId === null && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedTeamId === null && styles.chipTextActive,
                        ]}
                      >
                        Unassigned
                      </Text>
                    </Pressable>
                    {availableTeams.map((t) => {
                      const isSelected = selectedTeamId === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => {
                            setSelectedTeamId(t.id);
                            if (
                              t.department_id &&
                              t.department_id !== selectedDeptId
                            ) {
                              setSelectedDeptId(t.department_id);
                            }
                          }}
                          style={[styles.chip, isSelected && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {t.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* 3. Designation Picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DESIGNATION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    <Pressable
                      onPress={() => setSelectedDesigId(null)}
                      style={[
                        styles.chip,
                        selectedDesigId === null && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedDesigId === null && styles.chipTextActive,
                        ]}
                      >
                        Unassigned
                      </Text>
                    </Pressable>
                    {designations.map((des) => {
                      const isSelected = selectedDesigId === des.id;
                      return (
                        <Pressable
                          key={des.id}
                          onPress={() => setSelectedDesigId(des.id)}
                          style={[styles.chip, isSelected && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {des.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* 4. Location Picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>LOCATION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    <Pressable
                      onPress={() => setSelectedLocId(null)}
                      style={[
                        styles.chip,
                        selectedLocId === null && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedLocId === null && styles.chipTextActive,
                        ]}
                      >
                        Unassigned
                      </Text>
                    </Pressable>
                    {locations.map((loc) => {
                      const isSelected = selectedLocId === loc.id;
                      return (
                        <Pressable
                          key={loc.id}
                          onPress={() => setSelectedLocId(loc.id)}
                          style={[styles.chip, isSelected && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {loc.name}
                            {loc.city ? ` (${loc.city})` : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* 5. Reporting Manager Picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>REPORTING MANAGER</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    <Pressable
                      onPress={() => setSelectedMgrId(null)}
                      style={[
                        styles.chip,
                        selectedMgrId === null && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedMgrId === null && styles.chipTextActive,
                        ]}
                      >
                        No Manager (Top-level)
                      </Text>
                    </Pressable>
                    {managers.map((m) => {
                      const isSelected = selectedMgrId === m.id;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => setSelectedMgrId(m.id)}
                          style={[styles.chip, isSelected && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {m.first_name} {m.last_name} ({m.employee_code})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Direct Reports Note if they manage people */}
              {(details?.direct_reports_count ?? 0) > 0 ? (
                <View style={styles.infoBanner}>
                  <Text style={styles.infoBannerText}>
                    👥 This employee currently manages{" "}
                    {details?.direct_reports_count} direct report(s). Cycle
                    detection prevents assigning any subordinate as their
                    manager.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* Footer Save Button */}
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={saving || loading}
              onPress={handleSave}
              style={[
                styles.saveBtn,
                (saving || loading) && styles.saveBtnDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Assignments</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    minHeight: "50%",
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  headerSubtitle: {
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
  scrollContent: {
    gap: spacing.md,
    padding: spacing.md,
  },
  errorBanner: {
    backgroundColor: "#FEE2E2",
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorBannerText: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "600",
  },
  boundaryNote: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
  },
  boundaryNoteTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  boundaryNoteText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
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
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  infoBanner: {
    backgroundColor: "#EFF6FF",
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  infoBannerText: {
    color: "#1E40AF",
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    borderTopColor: "#E2E8F0",
    borderTopWidth: 1,
    padding: spacing.md,
  },
  saveBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
