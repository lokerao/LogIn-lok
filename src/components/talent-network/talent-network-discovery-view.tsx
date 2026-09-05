import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import { fetchTalentNetworkProfiles } from "@/features/talent-network/talent-network-service";
import type { TalentNetworkProfileListItem } from "@/types/talent-network";
import { TalentNetworkProfileCard } from "./talent-network-profile-card";
import { TalentNetworkProfileDetailModal } from "./talent-network-profile-detail-modal";

type Props = {
  initialOrgId?: string | null;
  onNavigateToOrganizations?: () => void;
};

export function TalentNetworkDiscoveryView({
  initialOrgId,
  onNavigateToOrganizations,
}: Props) {
  const [profiles, setProfiles] = useState<TalentNetworkProfileListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [skill, setSkill] = useState<string>("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    initialOrgId ?? null,
  );

  // Selected modal profile
  const [selectedTalentId, setSelectedTalentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchTalentNetworkProfiles({
        organization_id: selectedOrgId || null,
        search: search.trim() || null,
        skill: skill.trim() || null,
        limit: 50,
      });
      setProfiles(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load talent profiles.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedOrgId, search, skill]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  return (
    <View style={styles.container}>
      {/* Search and filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            accessibilityLabel="Search talent"
            onChangeText={setSearch}
            placeholder="Search by name, title, or keywords..."
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

        <View style={styles.skillBox}>
          <Text style={styles.skillIcon}>⚡</Text>
          <TextInput
            accessibilityLabel="Filter by skill"
            onChangeText={setSkill}
            placeholder="Filter by skill (e.g. React, Python, SQL)..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={skill}
          />
          {Boolean(skill) && (
            <Pressable onPress={() => setSkill("")} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          )}
        </View>

        {selectedOrgId ? (
          <View style={styles.orgChip}>
            <Text style={styles.orgChipText}>Filtered by Organization</Text>
            <Pressable
              onPress={() => setSelectedOrgId(null)}
              style={styles.orgChipClear}
            >
              <Text style={styles.orgChipClearText}>✕ Clear Org</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Discovering Talent Profiles...</Text>
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
          {profiles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🎯</Text>
              <Text style={styles.emptyTitle}>No Talent Profiles Found</Text>
              <Text style={styles.emptyDesc}>
                {search || skill
                  ? "No approved talent profiles match your current search criteria."
                  : "You do not have access to any approved talent profiles yet. Request access to participating organizations first."}
              </Text>
              {onNavigateToOrganizations && (
                <Pressable
                  accessibilityRole="button"
                  onPress={onNavigateToOrganizations}
                  style={styles.navOrgsBtn}
                >
                  <Text style={styles.navOrgsBtnText}>
                    Browse Organizations ↗
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.resultCount}>
                Showing {profiles.length} approved Talent Profile
                {profiles.length === 1 ? "" : "s"}
              </Text>
              {profiles.map((p) => (
                <TalentNetworkProfileCard
                  key={p.talent_id}
                  onPress={() => setSelectedTalentId(p.talent_id)}
                  profile={p}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Profile Detail Modal */}
      <TalentNetworkProfileDetailModal
        onClose={() => setSelectedTalentId(null)}
        talentId={selectedTalentId}
        visible={Boolean(selectedTalentId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
  },
  searchSection: {
    gap: spacing.xs,
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
  skillBox: {
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
  skillIcon: {
    fontSize: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    height: 40,
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
  resultCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 2,
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
    lineHeight: 18,
    textAlign: "center",
  },
  navOrgsBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navOrgsBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  orgChip: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  orgChipText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "600",
  },
  orgChipClear: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  orgChipClearText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "700",
  },
});
