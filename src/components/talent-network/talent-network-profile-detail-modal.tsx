import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import { fetchTalentNetworkProfileDetails } from "@/features/talent-network/talent-network-service";
import type { TalentNetworkProfileDetails } from "@/types/talent-network";

type Props = {
  talentId: string | null;
  visible: boolean;
  onClose: () => void;
};

export function TalentNetworkProfileDetailModal({
  talentId,
  visible,
  onClose,
}: Props) {
  const [profile, setProfile] = useState<TalentNetworkProfileDetails | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!visible || !talentId) {
        setProfile(null);
        return;
      }
      setLoading(true);
      setError(null);
      void fetchTalentNetworkProfileDetails(talentId)
        .then((data) => setProfile(data))
        .catch((err) =>
          setError(err.message || "Failed to load Talent Profile details."),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, talentId]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.talentIdBadge}>
                <Text style={styles.talentIdText}>{talentId}</Text>
              </View>
              {Boolean(profile?.organization_name) && (
                <Text numberOfLines={1} style={styles.orgName}>
                  {profile?.organization_name}
                </Text>
              )}
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
              <Text style={styles.loadingText}>Loading Talent Profile...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={styles.retryBtn}
              >
                <Text style={styles.retryBtnText}>Close</Text>
              </Pressable>
            </View>
          ) : profile ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Privacy Banner */}
              <View style={styles.privacyBanner}>
                <Text style={styles.privacyText}>
                  🛡 Verified professional credentials approved for Talent
                  Network discovery.
                </Text>
              </View>

              {/* Identity block */}
              <View style={styles.identityCard}>
                <Text style={styles.profName}>
                  {profile.professional_name || "Talent Member"}
                </Text>
                {Boolean(profile.professional_title) && (
                  <Text style={styles.profTitle}>
                    {profile.professional_title}
                  </Text>
                )}
                {Boolean(profile.summary) && (
                  <Text style={styles.summary}>{profile.summary}</Text>
                )}
                {profile.has_resume && (
                  <View style={styles.resumeBadge}>
                    <Text style={styles.resumeText}>
                      📄 Verified Resume on file
                    </Text>
                  </View>
                )}
              </View>

              {/* Skills */}
              {profile.skills.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Skills & Proficiencies
                  </Text>
                  <View style={styles.skillsGrid}>
                    {profile.skills.map((sk, idx) => (
                      <View key={`${sk.name}-${idx}`} style={styles.skillItem}>
                        <Text style={styles.skillName}>{sk.name}</Text>
                        <View style={styles.profPill}>
                          <Text style={styles.profPillText}>
                            {sk.proficiency}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Experience */}
              {profile.experiences.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Professional Experience
                  </Text>
                  <View style={styles.timeline}>
                    {profile.experiences.map((exp) => (
                      <View key={exp.id} style={styles.timelineCard}>
                        <View style={styles.timelineHeader}>
                          <Text style={styles.itemTitle}>{exp.job_title}</Text>
                          <Text style={styles.companyName}>{exp.company}</Text>
                        </View>
                        <Text style={styles.dateMeta}>
                          {exp.start_date} —{" "}
                          {exp.is_current ? "Present" : exp.end_date || "N/A"}
                          {exp.employment_type
                            ? ` · ${exp.employment_type}`
                            : ""}
                        </Text>
                        {Boolean(exp.description) && (
                          <Text style={styles.itemDesc}>{exp.description}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Education */}
              {profile.education.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Education</Text>
                  <View style={styles.itemsList}>
                    {profile.education.map((edu) => (
                      <View key={edu.id} style={styles.itemCard}>
                        <Text style={styles.itemTitle}>
                          {edu.qualification}
                        </Text>
                        <Text style={styles.subTitle}>{edu.institution}</Text>
                        {Boolean(edu.field_of_study) && (
                          <Text style={styles.fieldMeta}>
                            Field: {edu.field_of_study}
                          </Text>
                        )}
                        {(edu.start_date || edu.end_date) && (
                          <Text style={styles.dateMeta}>
                            {edu.start_date || ""} — {edu.end_date || ""}
                          </Text>
                        )}
                        {Boolean(edu.description) && (
                          <Text style={styles.itemDesc}>{edu.description}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Certifications */}
              {profile.certifications.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Certifications & Credentials
                  </Text>
                  <View style={styles.itemsList}>
                    {profile.certifications.map((cert) => (
                      <View key={cert.id} style={styles.itemCard}>
                        <Text style={styles.itemTitle}>{cert.name}</Text>
                        <Text style={styles.subTitle}>{cert.issuer}</Text>
                        {Boolean(cert.credential_id) && (
                          <Text style={styles.metaBadge}>
                            ID: {cert.credential_id}
                          </Text>
                        )}
                        {Boolean(cert.issue_date) && (
                          <Text style={styles.dateMeta}>
                            Issued: {cert.issue_date}
                            {cert.expiry_date
                              ? ` · Expires: ${cert.expiry_date}`
                              : ""}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Projects */}
              {profile.projects.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Projects & Technical Work
                  </Text>
                  <View style={styles.itemsList}>
                    {profile.projects.map((proj) => (
                      <View key={proj.id} style={styles.itemCard}>
                        <Text style={styles.itemTitle}>{proj.name}</Text>
                        {Boolean(proj.role) && (
                          <Text style={styles.subTitle}>Role: {proj.role}</Text>
                        )}
                        {Boolean(proj.description) && (
                          <Text style={styles.itemDesc}>
                            {proj.description}
                          </Text>
                        )}
                        {proj.technologies && proj.technologies.length > 0 && (
                          <View style={styles.techRow}>
                            {proj.technologies.map((t, tidx) => (
                              <View key={`${t}-${tidx}`} style={styles.techTag}>
                                <Text style={styles.techTagText}>{t}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Achievements */}
              {profile.achievements.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Achievements & Honors</Text>
                  <View style={styles.itemsList}>
                    {profile.achievements.map((ach) => (
                      <View key={ach.id} style={styles.itemCard}>
                        <Text style={styles.itemTitle}>{ach.title}</Text>
                        {Boolean(ach.issuer) && (
                          <Text style={styles.subTitle}>{ach.issuer}</Text>
                        )}
                        {Boolean(ach.achieved_on) && (
                          <Text style={styles.dateMeta}>
                            Date: {ach.achieved_on}
                          </Text>
                        )}
                        {Boolean(ach.description) && (
                          <Text style={styles.itemDesc}>{ach.description}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          ) : null}
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
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "50%",
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  headerInfo: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  talentIdBadge: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  talentIdText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  orgName: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  closeBtn: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  closeBtnText: {
    color: colors.ink,
    fontSize: 14,
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
    fontSize: 14,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  privacyBanner: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
  },
  privacyText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  identityCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md,
  },
  profName: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  profTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  summary: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  resumeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    marginTop: spacing.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resumeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  section: {
    gap: spacing.xs + 2,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  skillItem: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skillName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  profPill: {
    backgroundColor: "#EFF6FF",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  profPillText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 3,
    padding: spacing.md,
  },
  timelineHeader: {
    gap: 1,
  },
  itemsList: {
    gap: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 3,
    padding: spacing.md,
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  companyName: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  subTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  fieldMeta: {
    color: colors.ink,
    fontSize: 12,
  },
  dateMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 1,
  },
  itemDesc: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  metaBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  techRow: {
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
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
});
