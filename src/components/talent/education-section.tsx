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
import type { Education } from "@/types/talent";
import { getReviewStatusInfo } from "./talent-header-card";

type Props = {
  employeeId: string;
  educationList: Education[];
  onUpdated: () => void;
};

export function EducationSection({
  employeeId,
  educationList,
  onUpdated,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEdu, setEditingEdu] = useState<Education | null>(null);

  const [institution, setInstitution] = useState("");
  const [qualification, setQualification] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditingEdu(null);
    setInstitution("");
    setQualification("");
    setFieldOfStudy("");
    setStartDate("");
    setEndDate("");
    setDescription("");
    setModalVisible(true);
  }

  function openEdit(edu: Education) {
    setEditingEdu(edu);
    setInstitution(edu.institution);
    setQualification(edu.qualification);
    setFieldOfStudy(edu.field_of_study ?? "");
    setStartDate(edu.start_date ?? "");
    setEndDate(edu.end_date ?? "");
    setDescription(edu.description ?? "");
    setModalVisible(true);
  }

  async function handleSave() {
    const trimmedInst = institution.trim();
    const trimmedQual = qualification.trim();
    const trimmedField = fieldOfStudy.trim();
    const trimmedStart = startDate.trim();
    const trimmedEnd = endDate.trim();
    const trimmedDesc = description.trim();

    if (!trimmedInst || trimmedInst.length > 160) {
      Alert.alert(
        "Validation Error",
        "Institution is required (max 160 characters).",
      );
      return;
    }
    if (!trimmedQual || trimmedQual.length > 120) {
      Alert.alert(
        "Validation Error",
        "Qualification / Degree is required (max 120 characters).",
      );
      return;
    }
    if (trimmedField.length > 120) {
      Alert.alert(
        "Validation Error",
        "Field of Study cannot exceed 120 characters.",
      );
      return;
    }
    if (trimmedStart && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedStart)) {
      Alert.alert(
        "Validation Error",
        "Start Date must be in YYYY-MM-DD format.",
      );
      return;
    }
    if (trimmedEnd && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedEnd)) {
      Alert.alert("Validation Error", "End Date must be in YYYY-MM-DD format.");
      return;
    }
    if (trimmedStart && trimmedEnd && trimmedStart > trimmedEnd) {
      Alert.alert("Validation Error", "Start Date cannot be after End Date.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingEdu) {
        const { error } = await getSupabase()
          .from("education")
          .update({
            institution: trimmedInst,
            qualification: trimmedQual,
            field_of_study: trimmedField || null,
            start_date: trimmedStart || null,
            end_date: trimmedEnd || null,
            description: trimmedDesc || null,
          })
          .eq("id", editingEdu.id);

        if (error) {
          Alert.alert(
            "Update Failed",
            error.message || "Could not update education record.",
          );
        } else {
          setModalVisible(false);
          onUpdated();
        }
      } else {
        const { error } = await getSupabase()
          .from("education")
          .insert({
            employee_id: employeeId,
            institution: trimmedInst,
            qualification: trimmedQual,
            field_of_study: trimmedField || null,
            start_date: trimmedStart || null,
            end_date: trimmedEnd || null,
            description: trimmedDesc || null,
          });

        if (error) {
          Alert.alert(
            "Add Failed",
            error.message || "Could not add education record.",
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

  function confirmDelete(edu: Education) {
    Alert.alert(
      "Remove Education",
      `Are you sure you want to remove "${edu.qualification} from ${edu.institution}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void handleDelete(edu.id),
        },
      ],
    );
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await getSupabase()
        .from("education")
        .delete()
        .eq("id", id);
      if (error) {
        Alert.alert(
          "Delete Failed",
          error.message || "Could not remove education record.",
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
          <Text style={employeeStyles.label}>Education & Qualifications</Text>
          <Text style={styles.badge}>{educationList.length}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openAdd}
          style={styles.addButton}
        >
          <Text style={styles.addText}>+ Add Education</Text>
        </Pressable>
      </View>

      {educationList.length === 0 ? (
        <Text style={employeeStyles.muted}>
          No education records added yet. Add your academic background and
          degrees.
        </Text>
      ) : (
        <View style={styles.list}>
          {educationList.map((edu) => {
            const statusInfo = getReviewStatusInfo(edu.review_status);
            const isDeleting = deletingId === edu.id;
            const dateDisplay =
              edu.start_date || edu.end_date
                ? `${edu.start_date ?? ""} – ${edu.end_date ?? ""}`
                : null;

            return (
              <View key={edu.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleWrap}>
                    <Text style={styles.qualification}>
                      {edu.qualification}
                    </Text>
                    <Text style={styles.institution}>
                      {edu.institution}
                      {Boolean(edu.field_of_study) &&
                        ` · ${edu.field_of_study}`}
                    </Text>
                    {Boolean(dateDisplay) && (
                      <Text style={styles.dateRange}>{dateDisplay}</Text>
                    )}
                  </View>
                  <StatusIndicator variant={statusInfo.variant}>
                    {statusInfo.label}
                  </StatusIndicator>
                </View>

                {Boolean(edu.description) && (
                  <Text style={styles.description}>{edu.description}</Text>
                )}

                <View style={styles.actionLinks}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openEdit(edu)}
                    style={styles.linkButton}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isDeleting}
                    onPress={() => confirmDelete(edu)}
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

      {/* Add / Edit Education Modal */}
      <Modal animationType="slide" visible={modalVisible}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingEdu ? "Edit Education" : "Add Education"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Specify your institution, qualification, and field of study.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Qualification / Degree *</Text>
              <TextInput
                maxLength={120}
                onChangeText={setQualification}
                placeholder="e.g. Bachelor of Science in Computer Science"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={qualification}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Institution / University *</Text>
              <TextInput
                maxLength={160}
                onChangeText={setInstitution}
                placeholder="e.g. Stanford University"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={institution}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Field of Study (Optional)</Text>
              <TextInput
                maxLength={120}
                onChangeText={setFieldOfStudy}
                placeholder="e.g. Software Engineering, Data Science"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={fieldOfStudy}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Start Date (YYYY-MM-DD, Optional)
              </Text>
              <TextInput
                maxLength={10}
                onChangeText={setStartDate}
                placeholder="2018-09-01"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={startDate}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                End Date (YYYY-MM-DD, Optional)
              </Text>
              <TextInput
                maxLength={10}
                onChangeText={setEndDate}
                placeholder="2022-05-30"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={endDate}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                maxLength={1000}
                multiline
                numberOfLines={3}
                onChangeText={setDescription}
                placeholder="Honors, relevant coursework, activities..."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={description}
              />
              <Text style={styles.charCount}>{description.length}/1000</Text>
            </View>

            <View style={styles.actionRow}>
              {isSaving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Button
                  accessibilityLabel="Save Education"
                  onPress={() => void handleSave()}
                >
                  {editingEdu ? "Update Education" : "Save Education"}
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
  qualification: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  institution: {
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
