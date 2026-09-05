import { StyleSheet, Text, View } from "react-native";

import { employeeStyles } from "@/components/employee-screen";
import {
  StatusIndicator,
  type StatusVariant,
} from "@/components/ui/status-indicator";
import { colors, radius, spacing, typography } from "@/constants/design-system";
import type {
  ReviewStatus,
  TalentProfile,
  TalentVisibility,
} from "@/types/talent";

type Props = {
  profile: TalentProfile;
};

export function formatVisibility(visibility: TalentVisibility): string {
  switch (visibility) {
    case "organization":
      return "Organization";
    case "recruiters":
      return "Talent Network";
    case "private":
    default:
      return "Private (Only you)";
  }
}

export function getReviewStatusInfo(status: ReviewStatus): {
  label: string;
  variant: StatusVariant;
} {
  switch (status) {
    case "approved":
      return { label: "Approved", variant: "approved" };
    case "rejected":
      return { label: "Needs Revision", variant: "rejected" };
    case "pending":
    default:
      return { label: "Pending Review", variant: "pending" };
  }
}

export function TalentHeaderCard({ profile }: Props) {
  const statusInfo = getReviewStatusInfo(profile.review_status);

  return (
    <View style={employeeStyles.card}>
      <View style={styles.headerRow}>
        <Text style={employeeStyles.label}>Talent ID</Text>
        <StatusIndicator variant={statusInfo.variant}>
          {statusInfo.label}
        </StatusIndicator>
      </View>

      <Text style={styles.talentId}>{profile.talent_id}</Text>

      <Text style={styles.idDescription}>
        Your unique professional talent identifier across your career. Distinct
        from your internal organization Employee ID.
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Profile Visibility</Text>
        <View style={styles.metaBadge}>
          <Text style={styles.metaValue}>
            {formatVisibility(profile.visibility)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  talentId: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  idDescription: {
    color: colors.muted,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: "center",
    borderTopColor: "#EEF1F6",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  metaBadge: {
    backgroundColor: "#EEF2F6",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
});
