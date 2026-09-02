import { useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { employeeStyles } from "@/components/employee-screen";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { colors, radius, spacing, typography } from "@/constants/design-system";
import { getSupabase } from "@/lib/supabase";
import type { EmployeeSkill, ProficiencyLevel } from "@/types/talent";
import { getReviewStatusInfo } from "./talent-header-card";

type Props = {
  skills: EmployeeSkill[];
  onUpdated: () => void;
};

const proficiencyLevels: { key: ProficiencyLevel; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
  { key: "expert", label: "Expert" },
];

export function SkillsSection({ skills, onUpdated }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [proficiency, setProficiency] =
    useState<ProficiencyLevel>("intermediate");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setName("");
    setCategory("");
    setProficiency("intermediate");
    setModalVisible(true);
  }

  async function handleAddSkill() {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();

    if (!trimmedName || trimmedName.length > 80) {
      Alert.alert(
        "Invalid Name",
        "Skill name must be between 1 and 80 characters.",
      );
      return;
    }
    if (trimmedCategory.length > 80) {
      Alert.alert("Invalid Category", "Category cannot exceed 80 characters.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await getSupabase().rpc("add_own_skill", {
        skill_name: trimmedName,
        skill_category: trimmedCategory || null,
        skill_proficiency: proficiency,
      });

      if (error) {
        Alert.alert(
          "Could Not Add Skill",
          error.message || "Failed to add skill.",
        );
      } else {
        setModalVisible(false);
        onUpdated();
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred while adding skill.");
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete(skill: EmployeeSkill) {
    Alert.alert(
      "Remove Skill",
      `Are you sure you want to remove "${skill.skill_name}" from your profile?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void handleDelete(skill.id),
        },
      ],
    );
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await getSupabase()
        .from("employee_skills")
        .delete()
        .eq("id", id);
      if (error) {
        Alert.alert(
          "Delete Failed",
          error.message || "Could not remove skill.",
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
          <Text style={employeeStyles.label}>Skills & Proficiencies</Text>
          <Text style={styles.badge}>{skills.length}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openAdd}
          style={styles.addButton}
        >
          <Text style={styles.addText}>+ Add Skill</Text>
        </Pressable>
      </View>

      {skills.length === 0 ? (
        <Text style={employeeStyles.muted}>
          No skills added yet. Add your technical and domain expertise to build
          your talent profile.
        </Text>
      ) : (
        <View style={styles.skillList}>
          {skills.map((skill) => {
            const statusInfo = getReviewStatusInfo(skill.review_status);
            const isDeleting = deletingId === skill.id;

            return (
              <View key={skill.id} style={styles.skillCard}>
                <View style={styles.skillInfo}>
                  <View style={styles.skillTop}>
                    <Text style={styles.skillName}>{skill.skill_name}</Text>
                    <View style={styles.profBadge}>
                      <Text style={styles.profText}>
                        {skill.proficiency.charAt(0).toUpperCase() +
                          skill.proficiency.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {Boolean(skill.skill_category) && (
                    <Text style={styles.skillCategory}>
                      {skill.skill_category}
                    </Text>
                  )}

                  <View style={styles.skillMeta}>
                    <StatusIndicator variant={statusInfo.variant}>
                      {statusInfo.label}
                    </StatusIndicator>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={isDeleting}
                  onPress={() => confirmDelete(skill)}
                  style={styles.deleteButton}
                >
                  {isDeleting ? (
                    <ActivityIndicator color={colors.muted} size="small" />
                  ) : (
                    <Text style={styles.deleteText}>Remove</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Skill Modal */}
      <Modal animationType="slide" visible={modalVisible}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Skill</Text>
            <Text style={styles.modalSubtitle}>
              Specify your skill and self-assessed proficiency level.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Skill Name *</Text>
              <TextInput
                maxLength={80}
                onChangeText={setName}
                placeholder="e.g. TypeScript, React Native, SQL"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={name}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category (Optional)</Text>
              <TextInput
                maxLength={80}
                onChangeText={setCategory}
                placeholder="e.g. Frontend, Backend, Cloud, Management"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={category}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Proficiency Level</Text>
              <View style={styles.profSelector}>
                {proficiencyLevels.map((lvl) => (
                  <Pressable
                    key={lvl.key}
                    onPress={() => setProficiency(lvl.key)}
                    style={[
                      styles.profOption,
                      proficiency === lvl.key && styles.profOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.profOptionText,
                        proficiency === lvl.key &&
                          styles.profOptionTextSelected,
                      ]}
                    >
                      {lvl.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.actionRow}>
              {isSaving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Button
                  accessibilityLabel="Save Skill"
                  onPress={() => void handleAddSkill()}
                >
                  Save Skill
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
  skillList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  skillCard: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  skillInfo: {
    flex: 1,
    gap: 4,
  },
  skillTop: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  skillName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  profBadge: {
    backgroundColor: "#E0E7FF",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  profText: {
    color: "#3730A3",
    fontSize: 11,
    fontWeight: "700",
  },
  skillCategory: {
    color: colors.muted,
    fontSize: 12,
  },
  skillMeta: {
    marginTop: 2,
  },
  deleteButton: {
    padding: spacing.sm,
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
  profSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  profOption: {
    backgroundColor: colors.white,
    borderColor: "#D5DDEA",
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  profOptionText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  profOptionTextSelected: {
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
