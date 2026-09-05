import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import { fetchMyOrganizationAccess } from "@/features/talent-network/talent-network-service";
import type {
  TalentAccessStatus,
  TalentViewerAccessRequestItem,
} from "@/types/talent-network";

type FilterOption = "all" | TalentAccessStatus;

type Props = {
  onDiscoverOrgTalent?: (orgId: string) => void;
};

export function TalentNetworkMyAccessView({ onDiscoverOrgTalent }: Props) {
  const [requests, setRequests] = useState<TalentViewerAccessRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterOption>("all");

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchMyOrganizationAccess();
      setRequests(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load access requests.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  function renderStatusBadge(status: TalentAccessStatus) {
    switch (status) {
      case "approved":
        return (
          <View style={[styles.badge, styles.badgeApproved]}>
            <Text style={[styles.badgeText, styles.badgeTextApproved]}>
              ✓ Approved
            </Text>
          </View>
        );
      case "pending":
        return (
          <View style={[styles.badge, styles.badgePending]}>
            <Text style={[styles.badgeText, styles.badgeTextPending]}>
              ⏳ Pending Approval
            </Text>
          </View>
        );
      case "rejected":
        return (
          <View style={[styles.badge, styles.badgeRejected]}>
            <Text style={[styles.badgeText, styles.badgeTextRejected]}>
              ✕ Rejected
            </Text>
          </View>
        );
      case "suspended":
        return (
          <View style={[styles.badge, styles.badgeSuspended]}>
            <Text style={[styles.badgeText, styles.badgeTextSuspended]}>
              ⊘ Suspended
            </Text>
          </View>
        );
      default:
        return null;
    }
  }

  return (
    <View style={styles.container}>
      {/* Policy banner */}
      <View style={styles.policyBanner}>
        <Text style={styles.policyText}>
          🔒 Access to an organization&apos;s verified talent profiles is
          organization-specific. Approved access grants discovery privileges
          strictly within that organization.
        </Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: `All (${requests.length})` },
              {
                key: "approved",
                label: `Approved (${requests.filter((r) => r.status === "approved").length})`,
              },
              {
                key: "pending",
                label: `Pending (${requests.filter((r) => r.status === "pending").length})`,
              },
              {
                key: "rejected",
                label: `Rejected (${requests.filter((r) => r.status === "rejected").length})`,
              },
              {
                key: "suspended",
                label: `Suspended (${requests.filter((r) => r.status === "suspended").length})`,
              },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setStatusFilter(item.key)}
              style={[
                styles.chip,
                statusFilter === item.key && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  statusFilter === item.key && styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>
            Loading your access requests...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void loadData()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Access Requests</Text>
              <Text style={styles.emptyDesc}>
                {statusFilter === "all"
                  ? "You have not submitted any organization access requests yet. Visit Organizations tab to request access."
                  : `No requests with status "${statusFilter}".`}
              </Text>
            </View>
          ) : (
            filteredRequests.map((req) => (
              <View key={req.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerTitleCol}>
                    <Text style={styles.orgName}>{req.organization_name}</Text>
                    <Text style={styles.requestedMeta}>
                      Requested:{" "}
                      {new Date(req.requested_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {renderStatusBadge(req.status)}
                </View>

                {Boolean(req.reviewed_at) && (
                  <View style={styles.reviewBox}>
                    <Text style={styles.reviewMeta}>
                      Reviewed on:{" "}
                      {new Date(req.reviewed_at!).toLocaleDateString()}
                    </Text>
                    {Boolean(req.reviewer_notes) && (
                      <Text style={styles.notesText}>
                        Reviewer Note: &quot;{req.reviewer_notes}&quot;
                      </Text>
                    )}
                  </View>
                )}

                {req.status === "approved" && onDiscoverOrgTalent && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onDiscoverOrgTalent(req.organization_id)}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionBtnText}>
                      Discover {req.organization_name} Talent ↗
                    </Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
  },
  policyBanner: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
  },
  policyText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  filterScroll: {
    maxHeight: 36,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: colors.white,
  },
  centerBox: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyDesc: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerTitleCol: {
    flex: 1,
    gap: 2,
    marginRight: spacing.sm,
  },
  orgName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  requestedMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  badgeApproved: { backgroundColor: "#DCFCE7" },
  badgeTextApproved: { color: "#166534" },
  badgePending: { backgroundColor: "#FEF3C7" },
  badgeTextPending: { color: "#92400E" },
  badgeRejected: { backgroundColor: "#FEE2E2" },
  badgeTextRejected: { color: "#991B1B" },
  badgeSuspended: { backgroundColor: "#FFEDD5" },
  badgeTextSuspended: { color: "#9A3412" },
  reviewBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    gap: 2,
    padding: spacing.sm,
  },
  reviewMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  notesText: {
    color: colors.ink,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  actionBtn: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
