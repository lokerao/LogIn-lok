import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
import type { Experience } from "@/types/talent";
import { getReviewStatusInfo } from "./talent-header-card";

type Props = {
  employeeId: string;
  experiences: Experience[];
  onUpdated: () => void;
};

export function ExperienceSection({
  employeeId,
  experiences,
  onUpdated,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | null>(null);

  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [description, setDescription] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditingExp(null);
    setCompany("");
    setJobTitle("");
    setEmploymentType("Full-time");
    setStartDate("");
    setEndDate("");
    setIsCurrent(false);
    setDescription("");
    setModalVisible(true);
  }

  function openEdit(exp: Experience) {
    setEditingExp(exp);
    setCompany(exp.company);
    setJobTitle(exp.job_title);
    setEmploymentType(exp.employment_type ?? "");
    setStartDate(exp.start_date);
    setEndDate(exp.end_date ?? "");
    setIsCurrent(exp.is_current);
    setDescription(exp.description ?? "");
    setModalVisible(true);
  }

  async function handleSave() {
    const trimmedCompany = company.trim();
    const trimmedTitle = jobTitle.trim();
    const trimmedType = employmentType.trim();
    const trimmedStart = startDate.trim();
    const trimmedEnd = endDate.trim();
    const trimmedDesc = description.trim();

    if (!trimmedCompany || trimmedCompany.length > 120) {
      Alert.alert(
        "Validation Error",
        "Company name is required (max 120 characters).",
      );
      return;
    }
    if (!trimmedTitle || trimmedTitle.length > 120) {
      Alert.alert(
        "Validation Error",
        "Job title is required (max 120 characters).",
      );
      return;
    }
    if (!trimmedStart || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedStart)) {
      Alert.alert(
        "Validation Error",
        "Start Date is required in YYYY-MM-DD format (e.g. 2023-01-15).",
      );
      return;
    }
    if (!isCurrent) {
      if (!trimmedEnd || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedEnd)) {
        Alert.alert(
          "Validation Error",
          "End Date is required in YYYY-MM-DD format for past roles.",
        );
        return;
      }
      if (trimmedStart > trimmedEnd) {
        Alert.alert("Validation Error", "Start Date cannot be after End Date.");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingExp) {
        const { error } = await getSupabase()
          .from("experiences")
          .update({
            company: trimmedCompany,
            job_title: trimmedTitle,
            employment_type: trimmedType || null,
            start_date: trimmedStart,
            end_date: isCurrent ? null : trimmedEnd,
            is_current: isCurrent,
            description: trimmedDesc || null,
          })
          .eq("id", editingExp.id);

        if (error) {
          Alert.alert(
            "Update Failed",
            error.message || "Could not update experience.",
          );
        } else {
          setModalVisible(false);
          onUpdated();
        }
      } else {
        const { error } = await getSupabase()
          .from("experiences")
          .insert({
            employee_id: employeeId,
            company: trimmedCompany,
            job_title: trimmedTitle,
            employment_type: trimmedType || null,
            start_date: trimmedStart,
            end_date: isCurrent ? null : trimmedEnd,
            is_current: isCurrent,
            description: trimmedDesc || null,
          });

        if (error) {
          Alert.alert(
            "Add Failed",
            error.message || "Could not add experience.",
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

  function confirmDelete(exp: Experience) {
    Alert.alert(
      "Remove Experience",
      `Are you sure you want to remove "${exp.job_title} at ${exp.company}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void handleDelete(exp.id),
        },
      ],
    );
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await getSupabase()
        .from("experiences")
        .delete()
        .eq("id", id);
      if (error) {
        Alert.alert(
          "Delete Failed",
          error.message || "Could not remove experience.",
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
          <Text style={employeeStyles.label}>Work Experience</Text>
          <Text style={styles.badge}>{experiences.length}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openAdd}
          style={styles.addButton}
        >
          <Text style={styles.addText}>+ Add Experience</Text>
        </Pressable>
      </View>

      {experiences.length === 0 ? (
        <Text style={employeeStyles.muted}>
          No work experience added yet. Document your employment history to
          enrich your talent profile.
        </Text>
      ) : (
        <View style={styles.timelineList}>
          {experiences.map((exp) => {
            const statusInfo = getReviewStatusInfo(exp.review_status);
            const isDeleting = deletingId === exp.id;
            const dateDisplay = `${exp.start_date} – ${exp.is_current ? "Present" : (exp.end_date ?? "")}`;

            return (
              <View key={exp.id} style={styles.expCard}>
                <View style={styles.expHeader}>
                  <View style={styles.expTitleWrap}>
                    <Text style={styles.jobTitle}>{exp.job_title}</Text>
                    <Text style={styles.company}>
                      {exp.company}
                      {Boolean(exp.employment_type) &&
                        ` · ${exp.employment_type}`}
                    </Text>
                    <Text style={styles.dateRange}>{dateDisplay}</Text>
                  </View>
                  <StatusIndicator variant={statusInfo.variant}>
                    {statusInfo.label}
                  </StatusIndicator>
                </View>

                {Boolean(exp.description) && (
                  <Text style={styles.description}>{exp.description}</Text>
                )}

                <View style={styles.actionLinks}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openEdit(exp)}
                    style={styles.linkButton}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isDeleting}
                    onPress={() => confirmDelete(exp)}
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

      {/* Add / Edit Experience Modal */}
      <Modal animationType="slide" visible={modalVisible}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingExp ? "Edit Work Experience" : "Add Work Experience"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Document your role, organization, and timeframe.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Job Title *</Text>
              <TextInput
                maxLength={120}
                onChangeText={setJobTitle}
                placeholder="e.g. Lead Architect, Software Engineer"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={jobTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Company / Organization *</Text>
              <TextInput
                maxLength={120}
                onChangeText={setCompany}
                placeholder="e.g. Acme Corp"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={company}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Employment Type</Text>
              <TextInput
                maxLength={40}
                onChangeText={setEmploymentType}
                placeholder="e.g. Full-time, Part-time, Contract"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={employmentType}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Start Date * (YYYY-MM-DD)</Text>
              <TextInput
                maxLength={10}
                onChangeText={setStartDate}
                placeholder="2022-03-01"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={startDate}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.formLabel}>
                I currently work in this role
              </Text>
              <Switch
                onValueChange={setIsCurrent}
                thumbColor={isCurrent ? colors.primary : "#F4F5F7"}
                trackColor={{ false: "#D5DDEA", true: "#BFDBFE" }}
                value={isCurrent}
              />
            </View>

            {!isCurrent && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>End Date * (YYYY-MM-DD)</Text>
                <TextInput
                  maxLength={10}
                  onChangeText={setEndDate}
                  placeholder="2024-02-28"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={endDate}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Description / Responsibilities
              </Text>
              <TextInput
                maxLength={2000}
                multiline
                numberOfLines={4}
                onChangeText={setDescription}
                placeholder="Key accomplishments, leadership responsibilities, technologies used..."
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
                  accessibilityLabel="Save Experience"
                  onPress={() => void handleSave()}
                >
                  {editingExp ? "Update Experience" : "Save Experience"}
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
  timelineList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  expCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    gap: spacing.xs,
    padding: spacing.md,
  },
  expHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  expTitleWrap: {
    flex: 1,
    gap: 2,
  },
  jobTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  company: {
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
