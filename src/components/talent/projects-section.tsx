import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { employeeStyles } from "@/components/employee-screen";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { colors, radius, spacing, typography } from "@/constants/design-system";
import { getSupabase } from "@/lib/supabase";
import type { Project, TalentVisibility } from "@/types/talent";
import { formatVisibility, getReviewStatusInfo } from "./talent-header-card";

type Props = {
  employeeId: string;
  projects: Project[];
  onUpdated: () => void;
};

const visibilityOptions: { key: TalentVisibility; label: string }[] = [
  { key: "private", label: "Private" },
  { key: "organization", label: "Organization" },
  { key: "recruiters", label: "Recruiters" },
];

export function ProjectsSection({ employeeId, projects, onUpdated }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [technologiesText, setTechnologiesText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [projectUrl, setProjectUrl] = useState("");
  const [visibility, setVisibility] = useState<TalentVisibility>("private");
  const [description, setDescription] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditingProj(null);
    setName("");
    setRole("");
    setTechnologiesText("");
    setStartDate("");
    setEndDate("");
    setIsCurrent(false);
    setProjectUrl("");
    setVisibility("private");
    setDescription("");
    setModalVisible(true);
  }

  function openEdit(proj: Project) {
    setEditingProj(proj);
    setName(proj.name);
    setRole(proj.role ?? "");
    setTechnologiesText((proj.technologies ?? []).join(", "));
    setStartDate(proj.start_date ?? "");
    setEndDate(proj.end_date ?? "");
    setIsCurrent(proj.is_current);
    setProjectUrl(proj.project_url ?? "");
    setVisibility(proj.visibility);
    setDescription(proj.description ?? "");
    setModalVisible(true);
  }

  async function handleOpenUrl(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Cannot Open URL", "The project URL is not accessible.");
      }
    } catch {
      Alert.alert("Error", "Could not open the project link.");
    }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    const trimmedStart = startDate.trim();
    const trimmedEnd = endDate.trim();
    const trimmedUrl = projectUrl.trim();
    const trimmedDesc = description.trim();

    const techArray = technologiesText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (!trimmedName || trimmedName.length > 140) {
      Alert.alert(
        "Validation Error",
        "Project name is required (max 140 characters).",
      );
      return;
    }
    if (trimmedRole.length > 120) {
      Alert.alert("Validation Error", "Role cannot exceed 120 characters.");
      return;
    }
    if (trimmedStart && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedStart)) {
      Alert.alert(
        "Validation Error",
        "Start Date must be in YYYY-MM-DD format.",
      );
      return;
    }
    if (!isCurrent && trimmedEnd && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedEnd)) {
      Alert.alert("Validation Error", "End Date must be in YYYY-MM-DD format.");
      return;
    }
    if (trimmedStart && trimmedEnd && !isCurrent && trimmedStart > trimmedEnd) {
      Alert.alert("Validation Error", "Start Date cannot be after End Date.");
      return;
    }
    if (trimmedUrl && !trimmedUrl.startsWith("https://")) {
      Alert.alert("Validation Error", "Project URL must start with https://");
      return;
    }

    setIsSaving(true);
    try {
      if (editingProj) {
        const { error } = await getSupabase()
          .from("projects")
          .update({
            name: trimmedName,
            role: trimmedRole || null,
            description: trimmedDesc || null,
            technologies: techArray,
            start_date: trimmedStart || null,
            end_date: isCurrent ? null : trimmedEnd || null,
            is_current: isCurrent,
            project_url: trimmedUrl || null,
            visibility,
          })
          .eq("id", editingProj.id);

        if (error) {
          Alert.alert(
            "Update Failed",
            error.message || "Could not update project.",
          );
        } else {
          setModalVisible(false);
          onUpdated();
        }
      } else {
        const { error } = await getSupabase()
          .from("projects")
          .insert({
            employee_id: employeeId,
            name: trimmedName,
            role: trimmedRole || null,
            description: trimmedDesc || null,
            technologies: techArray,
            start_date: trimmedStart || null,
            end_date: isCurrent ? null : trimmedEnd || null,
            is_current: isCurrent,
            project_url: trimmedUrl || null,
            visibility,
          });

        if (error) {
          Alert.alert("Add Failed", error.message || "Could not add project.");
        } else {
          setModalVisible(false);
          onUpdated();
        }
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete(proj: Project) {
    Alert.alert(
      "Remove Project",
      `Are you sure you want to remove "${proj.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void handleDelete(proj.id),
        },
      ],
    );
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await getSupabase()
        .from("projects")
        .delete()
        .eq("id", id);
      if (error) {
        Alert.alert(
          "Delete Failed",
          error.message || "Could not remove project.",
        );
      } else {
        onUpdated();
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred while deleting.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={employeeStyles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={employeeStyles.label}>Projects & Portfolio</Text>
          <Text style={styles.badge}>{projects.length}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openAdd}
          style={styles.addButton}
        >
          <Text style={styles.addText}>+ Add Project</Text>
        </Pressable>
      </View>

      {projects.length === 0 ? (
        <Text style={employeeStyles.muted}>
          No projects added yet. Showcase key products, architectural
          initiatives, or client deliverables.
        </Text>
      ) : (
        <View style={styles.list}>
          {projects.map((proj) => {
            const statusInfo = getReviewStatusInfo(proj.review_status);
            const isDeleting = deletingId === proj.id;
            const dateDisplay =
              proj.start_date || proj.end_date || proj.is_current
                ? `${proj.start_date ?? ""} – ${proj.is_current ? "Ongoing" : (proj.end_date ?? "")}`
                : null;

            return (
              <View key={proj.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleWrap}>
                    <Text style={styles.projName}>{proj.name}</Text>
                    {Boolean(proj.role) && (
                      <Text style={styles.role}>{proj.role}</Text>
                    )}
                    {Boolean(dateDisplay) && (
                      <Text style={styles.dateRange}>{dateDisplay}</Text>
                    )}
                  </View>
                  <StatusIndicator variant={statusInfo.variant}>
                    {statusInfo.label}
                  </StatusIndicator>
                </View>

                {Boolean(proj.description) && (
                  <Text style={styles.description}>{proj.description}</Text>
                )}

                {proj.technologies && proj.technologies.length > 0 && (
                  <View style={styles.techChips}>
                    {proj.technologies.map((tech, idx) => (
                      <View key={`${tech}-${idx}`} style={styles.chip}>
                        <Text style={styles.chipText}>{tech}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.footerRow}>
                  <Text style={styles.visLabel}>
                    Visibility: {formatVisibility(proj.visibility)}
                  </Text>
                  {Boolean(proj.project_url) && (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => void handleOpenUrl(proj.project_url!)}
                      style={styles.linkButtonSmall}
                    >
                      <Text style={styles.linkText}>View Project ↗</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.actionLinks}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openEdit(proj)}
                    style={styles.linkButton}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isDeleting}
                    onPress={() => confirmDelete(proj)}
                    style={styles.linkButton}
                  >
                    {isDeleting ? (
                      <ActivityIndicator color={colors.muted} size="small" />
                    ) : (
                      <Text style={styles.deleteText}>Delete</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add / Edit Project Modal */}
      <Modal animationType="slide" visible={modalVisible}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingProj ? "Edit Project" : "Add Project"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Detail your role, technologies, and achievements.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Project Name *</Text>
              <TextInput
                maxLength={140}
                onChangeText={setName}
                placeholder="e.g. Real-Time Payroll Processing Engine"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={name}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Your Role / Title (Optional)</Text>
              <TextInput
                maxLength={120}
                onChangeText={setRole}
                placeholder="e.g. Lead Frontend Architect, Core Contributor"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={role}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Technologies (Comma-separated)
              </Text>
              <TextInput
                onChangeText={setTechnologiesText}
                placeholder="e.g. React Native, TypeScript, PostgreSQL, Docker"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={technologiesText}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Start Date (YYYY-MM-DD, Optional)
              </Text>
              <TextInput
                maxLength={10}
                onChangeText={setStartDate}
                placeholder="2023-01-10"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={startDate}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.formLabel}>Ongoing Project</Text>
              <Switch
                onValueChange={setIsCurrent}
                thumbColor={isCurrent ? colors.primary : "#F4F5F7"}
                trackColor={{ false: "#D5DDEA", true: "#BFDBFE" }}
                value={isCurrent}
              />
            </View>

            {!isCurrent && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  End Date (YYYY-MM-DD, Optional)
                </Text>
                <TextInput
                  maxLength={10}
                  onChangeText={setEndDate}
                  placeholder="2023-11-20"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={endDate}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Project URL (Optional, must start with https://)
              </Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="url"
                onChangeText={setProjectUrl}
                placeholder="https://github.com/..."
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={projectUrl}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Project Visibility</Text>
              <View style={styles.visSelector}>
                {visibilityOptions.map((opt) => (
                  <Pressable
                    key={opt.key}
                    onPress={() => setVisibility(opt.key)}
                    style={[
                      styles.visOption,
                      visibility === opt.key && styles.visOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.visOptionText,
                        visibility === opt.key && styles.visOptionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                maxLength={2000}
                multiline
                numberOfLines={4}
                onChangeText={setDescription}
                placeholder="High-level architecture, key results, scale, impact..."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={description}
              />
              <Text style={styles.charCount}>{description.length}/2000</Text>
            </View>

            <View style={styles.actionRow}>
              {isSaving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Button
                  accessibilityLabel="Save Project"
                  onPress={() => void handleSave()}
                >
                  {editingProj ? "Update Project" : "Save Project"}
                </Button>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => setModalVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: "#EEF2F6",
    borderRadius: radius.pill,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  addButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  addText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  itemCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    gap: spacing.xs,
    padding: spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemTitleWrap: {
    flex: 1,
    gap: 2,
  },
  projName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  role: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "500",
  },
  dateRange: {
    color: colors.muted,
    fontSize: 12,
  },
  description: {
    color: colors.ink,
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  techChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  chip: {
    backgroundColor: "#E0E7FF",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: {
    color: "#3730A3",
    fontSize: 11,
    fontWeight: "600",
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  visLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  linkButtonSmall: {
    paddingVertical: 2,
  },
  linkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  actionLinks: {
    borderTopColor: "#EEF1F6",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  linkButton: {
    paddingVertical: 2,
  },
  editText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  deleteText: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "600",
  },
  modalSafe: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  modalContent: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.ink,
    ...typography.title,
    fontSize: 24,
  },
  modalSubtitle: {
    color: colors.muted,
    ...typography.body,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  formGroup: {
    gap: spacing.xs,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  formLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.white,
    borderColor: "#D5DDEA",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    padding: spacing.md,
  },
  textArea: {
    height: 100,
  },
  charCount: {
    alignSelf: "flex-end",
    color: colors.muted,
    fontSize: 11,
  },
  visSelector: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  visOption: {
    backgroundColor: colors.white,
    borderColor: "#D5DDEA",
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  visOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  visOptionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  visOptionTextSelected: {
    color: colors.white,
  },
  actionRow: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700",
  },
});
