import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import {
  fetchTalentNetworkOrganizations,
  requestOrganizationAccess,
} from "@/features/talent-network/talent-network-service";
import type {
  TalentAccessStatus,
  TalentNetworkOrganization,
} from "@/types/talent-network";

type Props = {
  onSelectApprovedOrg?: (orgId: string) => void;
};

export function TalentNetworkOrganizationsView({ onSelectApprovedOrg }: Props) {
  const [organizations, setOrganizations] = useState<
    TalentNetworkOrganization[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchTalentNetworkOrganizations();
      setOrganizations(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load participating organizations.";
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

  const filteredOrgs = useMemo(() => {
    if (!search.trim()) return organizations;
    const q = search.toLowerCase().trim();
    return organizations.filter((o) => o.name.toLowerCase().includes(q));
  }, [organizations, search]);

  async function handleRequestAccess(org: TalentNetworkOrganization) {
    Alert.alert(
      "Request Organization Access",
      `Submit a formal access request to discover approved talent profiles from "${org.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit Request",
          onPress: async () => {
            setRequestingId(org.id);
            try {
              await requestOrganizationAccess(org.id);
              Alert.alert(
                "Request Submitted",
                `Your access request for ${org.name} has been sent to the organization's HR/Admin team for review.`,
              );
              await loadData();
            } catch (err: unknown) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "Failed to submit request.";
              Alert.alert("Request Failed", msg);
            } finally {
              setRequestingId(null);
            }
          },
        },
      ],
    );
  }

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
        return (
          <View style={[styles.badge, styles.badgeNotRequested]}>
            <Text style={[styles.badgeText, styles.badgeTextNotRequested]}>
              Not Requested
            </Text>
          </View>
        );
    }
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          accessibilityLabel="Search organizations"
          onChangeText={setSearch}
          placeholder="Search participating organizations..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          value={search}
        />
        {Boolean(search) && (
          <Pressable onPress={() => setSearch("")} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>
            Loading participating organizations...
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
          {filteredOrgs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>No Organizations Found</Text>
              <Text style={styles.emptyDesc}>
                {search
                  ? `No organizations match "${search}".`
                  : "No participating organizations available in the Talent Network."}
              </Text>
            </View>
          ) : (
            filteredOrgs.map((org) => {
              const isRequesting = requestingId === org.id;
              const canRequest =
                org.access_status === "not_requested" ||
                org.access_status === "rejected" ||
                org.access_status === "suspended";

              return (
                <View key={org.id} style={styles.orgCard}>
                  <View style={styles.orgHeader}>
                    <View style={styles.orgAvatar}>
                      <Text style={styles.orgAvatarText}>
                        {org.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.orgInfo}>
                      <Text style={styles.orgName}>{org.name}</Text>
                      {renderStatusBadge(org.access_status)}
                    </View>
                  </View>

                  {/* Body description */}
                  <View style={styles.orgDetails}>
                    {org.access_status === "approved" ? (
                      <View style={styles.approvedDetailsRow}>
                        <Text style={styles.talentCountText}>
                          🌟 {org.approved_talent_count} approved talent profile
                          {org.approved_talent_count === 1 ? "" : "s"} available
                        </Text>
                        {onSelectApprovedOrg && (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => onSelectApprovedOrg(org.id)}
                            style={styles.exploreBtn}
                          >
                            <Text style={styles.exploreBtnText}>
                              Discover Talent ↗
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ) : org.access_status === "pending" ? (
                      <Text style={styles.orgNoteText}>
                        Access requested on{" "}
                        {org.requested_at
                          ? new Date(org.requested_at).toLocaleDateString()
                          : "recently"}
                        . Awaiting HR/Admin approval.
                      </Text>
                    ) : org.access_status === "rejected" ? (
                      <Text style={styles.orgNoteText}>
                        Request was rejected
                        {org.reviewed_at
                          ? ` on ${new Date(org.reviewed_at).toLocaleDateString()}`
                          : ""}
                        {org.reviewer_notes ? `: "${org.reviewer_notes}"` : "."}
                      </Text>
                    ) : org.access_status === "suspended" ? (
                      <Text style={styles.orgNoteText}>
                        Access is currently suspended
                        {org.reviewer_notes ? `: "${org.reviewer_notes}"` : "."}
                      </Text>
                    ) : (
                      <Text style={styles.orgNoteText}>
                        Participating in the LogIn Talent Network. Submit an
                        access request to discover approved talent.
                      </Text>
                    )}
                  </View>

                  {/* Action button */}
                  {canRequest && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isRequesting}
                      onPress={() => void handleRequestAccess(org)}
                      style={({ pressed }) => [
                        styles.requestBtn,
                        pressed && styles.requestBtnPressed,
                        isRequesting && styles.btnDisabled,
                      ]}
                    >
                      {isRequesting ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.requestBtnText}>
                          {org.access_status === "rejected" ||
                          org.access_status === "suspended"
                            ? "Re-Request Access"
                            : "Request Access"}
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })
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
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    height: 44,
  },
  clearBtn: {
    padding: spacing.xs,
  },
  clearBtnText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
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
  orgCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  orgHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  orgAvatar: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  orgAvatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  orgInfo: {
    flex: 1,
    gap: 3,
  },
  orgName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  badge: {
    alignSelf: "flex-start",
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
  badgeNotRequested: { backgroundColor: "#F1F5F9" },
  badgeTextNotRequested: { color: colors.muted },
  orgDetails: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: spacing.sm,
  },
  approvedDetailsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  talentCountText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },
  exploreBtn: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exploreBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  orgNoteText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  requestBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    paddingVertical: spacing.sm + 2,
  },
  requestBtnPressed: {
    backgroundColor: colors.primaryPressed,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  requestBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
});
