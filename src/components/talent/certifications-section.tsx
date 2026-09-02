import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
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
import type { Certification } from "@/types/talent";
import { getReviewStatusInfo } from "./talent-header-card";

type Props = {
  employeeId: string;
  certifications: Certification[];
  onUpdated: () => void;
};

export function CertificationsSection({
  employeeId,
  certifications,
  onUpdated,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);

  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditingCert(null);
    setName("");
    setIssuer("");
    setIssueDate("");
    setExpiryDate("");
    setCredentialId("");
    setVerificationUrl("");
    setModalVisible(true);
  }

  function openEdit(cert: Certification) {
    setEditingCert(cert);
    setName(cert.name);
    setIssuer(cert.issuer);
    setIssueDate(cert.issue_date ?? "");
    setExpiryDate(cert.expiry_date ?? "");
    setCredentialId(cert.credential_id ?? "");
    setVerificationUrl(cert.verification_url ?? "");
    setModalVisible(true);
  }

  async function handleOpenUrl(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Cannot Open URL",
          "The verification URL is not accessible.",
        );
      }
    } catch {
      Alert.alert("Error", "Could not open the verification link.");
    }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedIssuer = issuer.trim();
    const trimmedIssue = issueDate.trim();
    const trimmedExpiry = expiryDate.trim();
    const trimmedCred = credentialId.trim();
    const trimmedUrl = verificationUrl.trim();

    if (!trimmedName || trimmedName.length > 140) {
      Alert.alert(
        "Validation Error",
        "Certification name is required (max 140 characters).",
      );
      return;
    }
    if (!trimmedIssuer || trimmedIssuer.length > 140) {
      Alert.alert(
        "Validation Error",
        "Issuer is required (max 140 characters).",
      );
      return;
    }
    if (trimmedIssue && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedIssue)) {
      Alert.alert(
        "Validation Error",
        "Issue Date must be in YYYY-MM-DD format.",
      );
      return;
    }
    if (trimmedExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedExpiry)) {
      Alert.alert(
        "Validation Error",
        "Expiry Date must be in YYYY-MM-DD format.",
      );
      return;
    }
    if (trimmedIssue && trimmedExpiry && trimmedIssue > trimmedExpiry) {
      Alert.alert(
        "Validation Error",
        "Issue Date cannot be after Expiry Date.",
      );
      return;
    }
    if (trimmedCred.length > 120) {
      Alert.alert(
        "Validation Error",
        "Credential ID cannot exceed 120 characters.",
      );
      return;
    }
    if (trimmedUrl && !trimmedUrl.startsWith("https://")) {
      Alert.alert(
        "Validation Error",
        "Verification URL must start with https://",
      );
      return;
    }

    setIsSaving(true);
    try {
      if (editingCert) {
        const { error } = await getSupabase()
          .from("certifications")
          .update({
            name: trimmedName,
            issuer: trimmedIssuer,
            issue_date: trimmedIssue || null,
            expiry_date: trimmedExpiry || null,
            credential_id: trimmedCred || null,
            verification_url: trimmedUrl || null,
          })
          .eq("id", editingCert.id);

        if (error) {
          Alert.alert(
            "Update Failed",
            error.message || "Could not update certification.",
          );
        } else {
          setModalVisible(false);
          onUpdated();
        }
      } else {
        const { error } = await getSupabase()
          .from("certifications")
          .insert({
            employee_id: employeeId,
            name: trimmedName,
            issuer: trimmedIssuer,
            issue_date: trimmedIssue || null,
            expiry_date: trimmedExpiry || null,
            credential_id: trimmedCred || null,
            verification_url: trimmedUrl || null,
          });

        if (error) {
          Alert.alert(
            "Add Failed",
            error.message || "Could not add certification.",
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

  function confirmDelete(cert: Certification) {
    Alert.alert(
      "Remove Certification",
      `Are you sure you want to remove "${cert.name}" from ${cert.issuer}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void handleDelete(cert.id),
        },
      ],
    );
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await getSupabase()
        .from("certifications")
        .delete()
        .eq("id", id);
      if (error) {
        Alert.alert(
          "Delete Failed",
          error.message || "Could not remove certification.",
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
          <Text style={employeeStyles.label}>Certifications & Credentials</Text>
          <Text style={styles.badge}>{certifications.length}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openAdd}
          style={styles.addButton}
        >
          <Text style={styles.addText}>+ Add Certification</Text>
        </Pressable>
      </View>

      {certifications.length === 0 ? (
        <Text style={employeeStyles.muted}>
          No certifications added yet. Showcase verified professional licenses
          and credentials.
        </Text>
      ) : (
        <View style={styles.list}>
          {certifications.map((cert) => {
            const statusInfo = getReviewStatusInfo(cert.review_status);
            const isDeleting = deletingId === cert.id;
            const dateDisplay =
              cert.issue_date || cert.expiry_date
                ? `Issued: ${cert.issue_date ?? "N/A"}${cert.expiry_date ? ` · Expires: ${cert.expiry_date}` : ""}`
                : null;

            return (
              <View key={cert.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleWrap}>
                    <Text style={styles.certName}>{cert.name}</Text>
                    <Text style={styles.issuer}>{cert.issuer}</Text>
                    {Boolean(dateDisplay) && (
                      <Text style={styles.dateRange}>{dateDisplay}</Text>
                    )}
                    {Boolean(cert.credential_id) && (
                      <Text style={styles.credentialId}>
                        ID: {cert.credential_id}
                      </Text>
                    )}
                  </View>
                  <StatusIndicator variant={statusInfo.variant}>
                    {statusInfo.label}
                  </StatusIndicator>
                </View>

                {Boolean(cert.verification_url) && (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void handleOpenUrl(cert.verification_url!)}
                    style={styles.verifyLink}
                  >
                    <Text style={styles.verifyLinkText}>
                      Verify Credential ↗
                    </Text>
                  </Pressable>
                )}

                <View style={styles.actionLinks}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openEdit(cert)}
                    style={styles.linkButton}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isDeleting}
                    onPress={() => confirmDelete(cert)}
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

      {/* Add / Edit Certification Modal */}
      <Modal animationType="slide" visible={modalVisible}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCert ? "Edit Certification" : "Add Certification"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Document accredited certifications and credentials.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Certification Name *</Text>
              <TextInput
                maxLength={140}
                onChangeText={setName}
                placeholder="e.g. AWS Certified Solutions Architect"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={name}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Issuing Organization *</Text>
              <TextInput
                maxLength={140}
                onChangeText={setIssuer}
                placeholder="e.g. Amazon Web Services, Scrum Alliance"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={issuer}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Issue Date (YYYY-MM-DD, Optional)
              </Text>
              <TextInput
                maxLength={10}
                onChangeText={setIssueDate}
                placeholder="2023-06-15"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={issueDate}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Expiry Date (YYYY-MM-DD, Optional)
              </Text>
              <TextInput
                maxLength={10}
                onChangeText={setExpiryDate}
                placeholder="2026-06-15"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={expiryDate}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Credential ID (Optional)</Text>
              <TextInput
                maxLength={120}
                onChangeText={setCredentialId}
                placeholder="e.g. AWS-PSA-123456"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={credentialId}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Verification URL (Optional, must start with https://)
              </Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="url"
                onChangeText={setVerificationUrl}
                placeholder="https://www.credly.com/badges/..."
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={verificationUrl}
              />
            </View>

            <View style={styles.actionRow}>
              {isSaving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Button
                  accessibilityLabel="Save Certification"
                  onPress={() => void handleSave()}
                >
                  {editingCert ? "Update Certification" : "Save Certification"}
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
  certName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  issuer: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "500",
  },
  dateRange: {
    color: colors.muted,
    fontSize: 12,
  },
  credentialId: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: "monospace",
  },
  verifyLink: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF2F6",
    borderRadius: radius.sm,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifyLinkText: {
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
