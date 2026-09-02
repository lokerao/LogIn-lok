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
import type { Achievement } from "@/types/talent";
import { getReviewStatusInfo } from "./talent-header-card";

type Props = {
  employeeId: string;
  achievements: Achievement[];
  onUpdated: () => void;
};

export function AchievementsSection({
  employeeId,
  achievements,
  onUpdated,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAch, setEditingAch] = useState<Achievement | null>(null);

  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [achievedOn, setAchievedOn] = useState("");
  const [description, setDescription] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditingAch(null);
    setTitle("");
    setIssuer("");
    setAchievedOn("");
    setDescription("");
    setModalVisible(true);
  }

  function openEdit(ach: Achievement) {
    setEditingAch(ach);
    setTitle(ach.title);
    setIssuer(ach.issuer ?? "");
    setAchievedOn(ach.achieved_on ?? "");
    setDescription(ach.description ?? "");
    setModalVisible(true);
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    const trimmedIssuer = issuer.trim();
    const trimmedDate = achievedOn.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle || trimmedTitle.length > 140) {
      Alert.alert(
        "Validation Error",
        "Title is required (max 140 characters).",
      );
      return;
    }
    if (trimmedIssuer.length > 140) {
      Alert.alert("Validation Error", "Issuer cannot exceed 140 characters.");
      return;
    }
    if (trimmedDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      Alert.alert("Validation Error", "Date must be in YYYY-MM-DD format.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingAch) {
        const { error } = await getSupabase()
          .from("achievements")
          .update({
            title: trimmedTitle,
            issuer: trimmedIssuer || null,
            achieved_on: trimmedDate || null,
            description: trimmedDesc || null,
          })
          .eq("id", editingAch.id);

        if (error) {
          Alert.alert(
            "Update Failed",
            error.message || "Could not update achievement.",
          );
        } else {
          setModalVisible(false);
          onUpdated();
        }
      } else {
        const { error } = await getSupabase()
          .from("achievements")
          .insert({
            employee_id: employeeId,
            title: trimmedTitle,
            issuer: trimmedIssuer || null,
            achieved_on: trimmedDate || null,
            description: trimmedDesc || null,
          });

        if (error) {
          Alert.alert(
            "Add Failed",
            error.message || "Could not add achievement.",
          );
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

  function confirmDelete(ach: Achievement) {
    Alert.alert(
      "Remove Achievement",
      `Are you sure you want to remove "${ach.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void handleDelete(ach.id),
        },
      ],
    );
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await getSupabase()
        .from("achievements")
        .delete()
        .eq("id", id);
      if (error) {
        Alert.alert(
          "Delete Failed",
          error.message || "Could not remove achievement.",
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
          <Text style={employeeStyles.label}>Achievements & Honors</Text>
          <Text style={styles.badge}>{achievements.length}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openAdd}
          style={styles.addButton}
        >
          <Text style={styles.addText}>+ Add Achievement</Text>
        </Pressable>
      </View>

      {achievements.length === 0 ? (
        <Text style={employeeStyles.muted}>
          No achievements recorded yet. Showcase patents, awards, leadership
          recognitions, or publications.
        </Text>
      ) : (
        <View style={styles.list}>
          {achievements.map((ach) => {
            const statusInfo = getReviewStatusInfo(ach.review_status);
            const isDeleting = deletingId === ach.id;

            return (
              <View key={ach.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleWrap}>
                    <Text style={styles.achTitle}>{ach.title}</Text>
                    {Boolean(ach.issuer) && (
                      <Text style={styles.issuer}>{ach.issuer}</Text>
                    )}
                    {Boolean(ach.achieved_on) && (
                      <Text style={styles.date}>{ach.achieved_on}</Text>
                    )}
                  </View>
                  <StatusIndicator variant={statusInfo.variant}>
                    {statusInfo.label}
                  </StatusIndicator>
                </View>

                {Boolean(ach.description) && (
                  <Text style={styles.description}>{ach.description}</Text>
                )}

                <View style={styles.actionLinks}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openEdit(ach)}
                    style={styles.linkButton}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isDeleting}
                    onPress={() => confirmDelete(ach)}
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

      {/* Add / Edit Achievement Modal */}
      <Modal animationType="slide" visible={modalVisible}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingAch ? "Edit Achievement" : "Add Achievement"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Highlight career milestones and awards.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Title / Recognition *</Text>
              <TextInput
                maxLength={140}
                onChangeText={setTitle}
                placeholder="e.g. Employee of the Year, Best Innovation Award"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={title}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Issuing Organization (Optional)
              </Text>
              <TextInput
                maxLength={140}
                onChangeText={setIssuer}
                placeholder="e.g. IEEE, Tech Excellence Forum"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={issuer}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Date Achieved (YYYY-MM-DD, Optional)
              </Text>
              <TextInput
                maxLength={10}
                onChangeText={setAchievedOn}
                placeholder="2023-10-15"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={achievedOn}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                maxLength={1500}
                multiline
                numberOfLines={4}
                onChangeText={setDescription}
                placeholder="Context, evaluation criteria, impact of recognition..."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={description}
              />
              <Text style={styles.charCount}>{description.length}/1500</Text>
            </View>

            <View style={styles.actionRow}>
              {isSaving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Button
                  accessibilityLabel="Save Achievement"
                  onPress={() => void handleSave()}
                >
                  {editingAch ? "Update Achievement" : "Save Achievement"}
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
  achTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  issuer: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "500",
  },
  date: {
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
    height: 90,
  },
  charCount: {
    alignSelf: "flex-end",
    color: colors.muted,
    fontSize: 11,
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
