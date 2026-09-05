import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import type { TalentNetworkProfileListItem } from "@/types/talent-network";

type Props = {
  profile: TalentNetworkProfileListItem;
  onPress: () => void;
};

export function TalentNetworkProfileCard({ profile, onPress }: Props) {
  const visibleSkills = profile.skills.slice(0, 4);
  const remainingSkills = profile.skills.length - visibleSkills.length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Top row: Talent ID and Org */}
      <View style={styles.topRow}>
        <View style={styles.talentIdBadge}>
          <Text style={styles.talentIdText}>{profile.talent_id}</Text>
        </View>
        <View style={styles.orgBadge}>
          <Text numberOfLines={1} style={styles.orgBadgeText}>
            {profile.organization_name}
          </Text>
        </View>
      </View>

      {/* Main info */}
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.name}>
          {profile.professional_name || "Professional Profile"}
        </Text>
        {Boolean(profile.professional_title) && (
          <Text numberOfLines={1} style={styles.title}>
            {profile.professional_title}
          </Text>
        )}
      </View>

      {/* Summary */}
      {Boolean(profile.summary) && (
        <Text numberOfLines={2} style={styles.summary}>
          {profile.summary}
        </Text>
      )}

      {/* Skills row */}
      {profile.skills.length > 0 && (
        <View style={styles.skillsRow}>
          {visibleSkills.map((sk, idx) => (
            <View key={`${sk.name}-${idx}`} style={styles.skillChip}>
              <Text style={styles.skillText}>{sk.name}</Text>
            </View>
          ))}
          {remainingSkills > 0 && (
            <View style={styles.skillChipMore}>
              <Text style={styles.skillMoreText}>+{remainingSkills}</Text>
            </View>
          )}
        </View>
      )}

      {/* Portfolio highlights footer */}
      <View style={styles.footer}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Experience</Text>
          <Text style={styles.metaValue}>
            {profile.experience_count}{" "}
            {profile.experience_count === 1 ? "role" : "roles"}
          </Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Certs</Text>
          <Text style={styles.metaValue}>{profile.certifications_count}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Projects</Text>
          <Text style={styles.metaValue}>{profile.projects_count}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={styles.viewBtn}
        >
          <Text style={styles.viewBtnText}>View ↗</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs + 2,
    padding: spacing.md,
  },
  cardPressed: {
    backgroundColor: "#F8FAFC",
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  talentIdBadge: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  talentIdText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  orgBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    maxWidth: "50%",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  orgBadgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  header: {
    gap: 2,
    marginTop: 2,
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  title: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  summary: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  skillChip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  skillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
  },
  skillChipMore: {
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  skillMoreText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  footer: {
    alignItems: "center",
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.xs + 2,
  },
  metaCol: {
    gap: 1,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metaValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  viewBtn: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
