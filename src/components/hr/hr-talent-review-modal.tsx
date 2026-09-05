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

import { colors, radius, spacing } from "@/constants/design-system";
import { reviewTalentProfile } from "@/features/hr/hr-service";
import type { HRPendingTalentReview } from "@/types/hr";

interface HRTalentReviewModalProps {
  visible: boolean;
  review: HRPendingTalentReview | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function HRTalentReviewModal({
  visible,
  review,
  onClose,
  onSuccess,
}: HRTalentReviewModalProps) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!review) return null;

  const handleAction = async (action: "approve" | "reject") => {
    try {
      setSubmitting(true);
      await reviewTalentProfile(review.employee_id, action, notes);
      Alert.alert(
        action === "approve" ? "Profile Approved" : "Profile Rejected",
        `Professional profile for ${review.employee_name} has been ${action === "approve" ? "approved" : "rejected"}.`,
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Review Action Failed",
        err.message || "Could not complete review.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Review Talent Profile</Text>
              <Text style={styles.subtitle}>
                {review.employee_name} · {review.employee_code}
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

          <ScrollView style={styles.scrollArea}>
            {/* Identity & Department */}
            <View style={styles.detailCard}>
              <Text style={styles.cardTitle}>Professional Overview</Text>
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Talent ID: </Text>
                <Text style={styles.metaValue}>{review.talent_id}</Text>
              </Text>
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Professional Title: </Text>
                <Text style={styles.metaValue}>
                  {review.professional_title ?? "Not specified"}
                </Text>
              </Text>
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Designation: </Text>
                <Text style={styles.metaValue}>
                  {review.designation ?? "N/A"}
                </Text>
              </Text>
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Department: </Text>
                <Text style={styles.metaValue}>
                  {review.department ?? "N/A"}
                </Text>
              </Text>
              {review.summary && (
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>Summary:</Text>
                  <Text style={styles.summaryText}>{review.summary}</Text>
                </View>
              )}
            </View>

            {/* Submitted Sections Breakdown */}
            <View style={styles.detailCard}>
              <Text style={styles.cardTitle}>
                Submitted Items for Verification
              </Text>
              <View style={styles.countsGrid}>
                <View style={styles.countBadge}>
                  <Text style={styles.countNumber}>
                    {review.pending_skills_count}
                  </Text>
                  <Text style={styles.countName}>Skills</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countNumber}>
                    {review.pending_experiences_count}
                  </Text>
                  <Text style={styles.countName}>Experience</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countNumber}>
                    {review.pending_education_count}
                  </Text>
                  <Text style={styles.countName}>Education</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countNumber}>
                    {review.pending_certifications_count}
                  </Text>
                  <Text style={styles.countName}>Certificates</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countNumber}>
                    {review.pending_projects_count}
                  </Text>
                  <Text style={styles.countName}>Projects</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countNumber}>
                    {review.pending_achievements_count}
                  </Text>
                  <Text style={styles.countName}>Achievements</Text>
                </View>
              </View>
            </View>

            {/* 1. Skills Section */}
            {review.skills && review.skills.length > 0 && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionHeader}>
                  Skills ({review.skills.length})
                </Text>
                <View style={styles.itemList}>
                  {review.skills.map((skill) => (
                    <View key={skill.id} style={styles.itemRow}>
                      <View style={styles.itemMainCol}>
                        <Text style={styles.itemMainTitle}>{skill.name}</Text>
                        {skill.category && (
                          <Text style={styles.itemSubText}>
                            {skill.category}
                          </Text>
                        )}
                      </View>
                      <View style={styles.proficiencyBadge}>
                        <Text style={styles.proficiencyText}>
                          {skill.proficiency.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 2. Experience Section */}
            {review.experiences && review.experiences.length > 0 && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionHeader}>
                  Experience ({review.experiences.length})
                </Text>
                <View style={styles.itemList}>
                  {review.experiences.map((exp) => (
                    <View key={exp.id} style={styles.itemCard}>
                      <Text style={styles.itemMainTitle}>{exp.job_title}</Text>
                      <Text style={styles.itemCompany}>
                        {exp.company}
                        {exp.employment_type ? ` · ${exp.employment_type}` : ""}
                      </Text>
                      <Text style={styles.itemDate}>
                        {exp.start_date} —{" "}
                        {exp.is_current ? "Present" : (exp.end_date ?? "N/A")}
                      </Text>
                      {exp.description && (
                        <Text style={styles.itemDesc}>{exp.description}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 3. Education Section */}
            {review.education && review.education.length > 0 && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionHeader}>
                  Education ({review.education.length})
                </Text>
                <View style={styles.itemList}>
                  {review.education.map((edu) => (
                    <View key={edu.id} style={styles.itemCard}>
                      <Text style={styles.itemMainTitle}>
                        {edu.qualification}
                        {edu.field_of_study ? ` in ${edu.field_of_study}` : ""}
                      </Text>
                      <Text style={styles.itemCompany}>{edu.institution}</Text>
                      {(edu.start_date || edu.end_date) && (
                        <Text style={styles.itemDate}>
                          {edu.start_date ?? "N/A"} —{" "}
                          {edu.end_date ?? "Present"}
                        </Text>
                      )}
                      {edu.description && (
                        <Text style={styles.itemDesc}>{edu.description}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 4. Certifications Section */}
            {review.certifications && review.certifications.length > 0 && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionHeader}>
                  Certifications ({review.certifications.length})
                </Text>
                <View style={styles.itemList}>
                  {review.certifications.map((cert) => (
                    <View key={cert.id} style={styles.itemCard}>
                      <Text style={styles.itemMainTitle}>{cert.name}</Text>
                      <Text style={styles.itemCompany}>
                        Issued by {cert.issuer}
                      </Text>
                      {(cert.issue_date || cert.expiry_date) && (
                        <Text style={styles.itemDate}>
                          Issued: {cert.issue_date ?? "N/A"}
                          {cert.expiry_date
                            ? ` · Expires: ${cert.expiry_date}`
                            : ""}
                        </Text>
                      )}
                      {cert.credential_id && (
                        <Text style={styles.itemMeta}>
                          Credential ID: {cert.credential_id}
                        </Text>
                      )}
                      {cert.verification_url && (
                        <Text style={styles.itemLink} numberOfLines={1}>
                          {cert.verification_url}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 5. Projects Section */}
            {review.projects && review.projects.length > 0 && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionHeader}>
                  Projects ({review.projects.length})
                </Text>
                <View style={styles.itemList}>
                  {review.projects.map((proj) => (
                    <View key={proj.id} style={styles.itemCard}>
                      <Text style={styles.itemMainTitle}>{proj.name}</Text>
                      {proj.role && (
                        <Text style={styles.itemCompany}>
                          Role: {proj.role}
                        </Text>
                      )}
                      {(proj.start_date || proj.end_date) && (
                        <Text style={styles.itemDate}>
                          {proj.start_date ?? "N/A"} —{" "}
                          {proj.is_current
                            ? "Present"
                            : (proj.end_date ?? "N/A")}
                        </Text>
                      )}
                      {proj.technologies && proj.technologies.length > 0 && (
                        <View style={styles.tagWrap}>
                          {proj.technologies.map((t, idx) => (
                            <View key={idx} style={styles.techTag}>
                              <Text style={styles.techTagText}>{t}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {proj.description && (
                        <Text style={styles.itemDesc}>{proj.description}</Text>
                      )}
                      {proj.project_url && (
                        <Text style={styles.itemLink} numberOfLines={1}>
                          {proj.project_url}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 6. Achievements Section */}
            {review.achievements && review.achievements.length > 0 && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionHeader}>
                  Achievements ({review.achievements.length})
                </Text>
                <View style={styles.itemList}>
                  {review.achievements.map((ach) => (
                    <View key={ach.id} style={styles.itemCard}>
                      <Text style={styles.itemMainTitle}>{ach.title}</Text>
                      {ach.issuer && (
                        <Text style={styles.itemCompany}>
                          Awarded by {ach.issuer}
                        </Text>
                      )}
                      {ach.achieved_on && (
                        <Text style={styles.itemDate}>
                          Date: {ach.achieved_on}
                        </Text>
                      )}
                      {ach.description && (
                        <Text style={styles.itemDesc}>{ach.description}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Reviewer Feedback Notes */}
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>
                Reviewer Feedback / Notes (Optional)
              </Text>
              <TextInput
                maxLength={400}
                multiline
                numberOfLines={3}
                onChangeText={setNotes}
                placeholder="Enter feedback or approval remarks..."
                placeholderTextColor={colors.muted}
                style={styles.notesInput}
                value={notes}
              />
            </View>
          </ScrollView>

          {/* Action Decision Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => handleAction("reject")}
              style={[styles.btn, styles.rejectBtn]}
            >
              <Text style={styles.rejectBtnText}>Reject Profile</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => handleAction("approve")}
              style={[styles.btn, styles.approveBtn]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.approveBtnText}>Approve Profile</Text>
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
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    maxHeight: "85%",
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "700",
  },
  scrollArea: {
    gap: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.sm + 4,
    gap: 4,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  metaRow: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaLabel: {
    color: colors.muted,
    fontWeight: "600",
  },
  metaValue: {
    color: colors.ink,
    fontWeight: "700",
  },
  summaryBlock: {
    borderTopColor: "#E2E8F0",
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 4,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  summaryText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  countsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
    marginTop: 4,
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minWidth: "30%",
    paddingVertical: 8,
  },
  countNumber: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  countName: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  itemList: {
    gap: spacing.xs + 2,
    marginTop: 4,
  },
  itemRow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  itemMainCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemMainTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  itemSubText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  proficiencyBadge: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 2,
  },
  proficiencyText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  itemCard: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 2,
  },
  itemCompany: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  itemDate: {
    color: colors.muted,
    fontSize: 12,
  },
  itemDesc: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  itemLink: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 2,
    textDecorationLine: "underline",
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  techTag: {
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  techTagText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
  },
  inputBlock: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  notesInput: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 13,
    minHeight: 60,
    padding: spacing.sm,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  btn: {
    alignItems: "center",
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  rejectBtn: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
    borderWidth: 1,
  },
  rejectBtnText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },
  approveBtn: {
    backgroundColor: colors.success,
  },
  approveBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
