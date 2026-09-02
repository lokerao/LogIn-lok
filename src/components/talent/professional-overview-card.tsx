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
import { colors, radius, spacing, typography } from "@/constants/design-system";
import { getSupabase } from "@/lib/supabase";
import type { TalentProfile, TalentVisibility } from "@/types/talent";
import { formatVisibility } from "./talent-header-card";

type Props = {
  profile: TalentProfile;
  onUpdated: () => void;
};

const visibilityOptions: {
  key: TalentVisibility;
  label: string;
  desc: string;
}[] = [
  { key: "private", label: "Private", desc: "Visible only to you" },
  {
    key: "organization",
    label: "Organization",
    desc: "Visible to colleagues and managers",
  },
  {
    key: "recruiters",
    label: "Recruiters",
    desc: "Visible to authorized talent viewers",
  },
];

export function ProfessionalOverviewCard({ profile, onUpdated }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState(profile.professional_name ?? "");
  const [title, setTitle] = useState(profile.professional_title ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [visibility, setVisibility] = useState<TalentVisibility>(
    profile.visibility,
  );
  const [isSaving, setIsSaving] = useState(false);

  function openEdit() {
    setName(profile.professional_name ?? "");
    setTitle(profile.professional_title ?? "");
    setSummary(profile.summary ?? "");
    setVisibility(profile.visibility);
    setModalVisible(true);
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedTitle = title.trim();
    const trimmedSummary = summary.trim();

    if (trimmedName.length > 100) {
      Alert.alert(
        "Invalid Name",
        "Professional Name cannot exceed 100 characters.",
      );
      return;
    }
    if (trimmedTitle.length > 120) {
      Alert.alert(
        "Invalid Title",
        "Professional Title cannot exceed 120 characters.",
      );
      return;
    }
    if (trimmedSummary.length > 1500) {
      Alert.alert("Invalid Summary", "Summary cannot exceed 1500 characters.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await getSupabase()
        .from("talent_profiles")
        .update({
          professional_name: trimmedName || null,
          professional_title: trimmedTitle || null,
          summary: trimmedSummary || null,
          visibility,
        })
        .eq("employee_id", profile.employee_id);

      if (error) {
        Alert.alert(
          "Save Failed",
          error.message || "Could not update overview.",
        );
      } else {
        setModalVisible(false);
        onUpdated();
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={employeeStyles.card}>
      <View style={styles.headerRow}>
        <Text style={employeeStyles.label}>Professional Overview</Text>
        <Pressable
          accessibilityRole="button"
          onPress={openEdit}
          style={styles.editButton}
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Professional Name</Text>
        <Text style={styles.fieldValue}>
          {profile.professional_name || "Not specified"}
        </Text>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Professional Title</Text>
        <Text style={styles.fieldValue}>
          {profile.professional_title || "Not specified"}
        </Text>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Summary</Text>
        <Text style={styles.summaryValue}>
          {profile.summary || "No professional summary provided yet."}
        </Text>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Visibility Preference</Text>
        <Text style={styles.fieldValue}>
          {formatVisibility(profile.visibility)}
        </Text>
      </View>

      {/* Edit Modal */}
      <Modal animationType="slide" visible={modalVisible}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Professional Overview</Text>
            <Text style={styles.modalSubtitle}>
              Update your public-facing professional details and visibility.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Professional Name</Text>
              <TextInput
                maxLength={100}
                onChangeText={setName}
                placeholder="e.g. John Doe"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={name}
              />
              <Text style={styles.charCount}>{name.length}/100</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Professional Title</Text>
              <TextInput
                maxLength={120}
                onChangeText={setTitle}
                placeholder="e.g. Senior Software Engineer"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={title}
              />
              <Text style={styles.charCount}>{title.length}/120</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Professional Summary</Text>
              <TextInput
                maxLength={1500}
                multiline
                numberOfLines={4}
                onChangeText={setSummary}
                placeholder="Briefly describe your career focus, technical expertise, and domain experience..."
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={summary}
              />
              <Text style={styles.charCount}>{summary.length}/1500</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Visibility</Text>
              {visibilityOptions.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setVisibility(opt.key)}
                  style={[
                    styles.radioOption,
                    visibility === opt.key && styles.radioOptionSelected,
                  ]}
                >
                  <View style={styles.radioDot}>
                    {visibility === opt.key && (
                      <View style={styles.radioDotInner} />
                    )}
                  </View>
                  <View style={styles.radioTextWrap}>
                    <Text style={styles.radioLabel}>{opt.label}</Text>
                    <Text style={styles.radioDesc}>{opt.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.actionRow}>
              {isSaving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Button
                  accessibilityLabel="Save Overview"
                  onPress={() => void handleSave()}
                >
                  Save Overview
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
  editButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  editText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  fieldRow: {
    borderTopColor: "#EEF1F6",
    borderTopWidth: 1,
    gap: 2,
    paddingTop: spacing.sm,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  fieldValue: {
    color: colors.ink,
    ...typography.body,
    fontWeight: "600",
  },
  summaryValue: {
    color: colors.ink,
    ...typography.body,
    lineHeight: 22,
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
    height: 110,
  },
  charCount: {
    alignSelf: "flex-end",
    color: colors.muted,
    fontSize: 11,
  },
  radioOption: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#D5DDEA",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xs,
    padding: spacing.md,
  },
  radioOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#F0F4FF",
  },
  radioDot: {
    alignItems: "center",
    borderColor: colors.muted,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioDotInner: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
  radioTextWrap: {
    flex: 1,
  },
  radioLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  radioDesc: {
    color: colors.muted,
    fontSize: 12,
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
