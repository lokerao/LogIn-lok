import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import {
  fetchMyOrganizationAccess,
  fetchTalentNetworkOrganizations,
} from "@/features/talent-network/talent-network-service";
import type { TalentNetworkOrganization } from "@/types/talent-network";
import { TalentNetworkDiscoveryView } from "./talent-network-discovery-view";
import { TalentNetworkMyAccessView } from "./talent-network-my-access-view";
import { TalentNetworkOrganizationsView } from "./talent-network-organizations-view";

type DashboardTab = "overview" | "organizations" | "discovery" | "my_access";

export function TalentViewerDashboard() {
  const { identity } = useAuth();

  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [organizations, setOrganizations] = useState<
    TalentNetworkOrganization[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const [orgs] = await Promise.all([
        fetchTalentNetworkOrganizations(),
        fetchMyOrganizationAccess(),
      ]);
      setOrganizations(orgs);
    } catch {
      // Handled cleanly
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadSummary(), 0);
    return () => clearTimeout(timer);
  }, [loadSummary]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadSummary();
  };

  const approvedOrgsCount = organizations.filter(
    (o) => o.access_status === "approved",
  ).length;
  const pendingOrgsCount = organizations.filter(
    (o) => o.access_status === "pending",
  ).length;
  const totalTalentAvailable = organizations.reduce(
    (sum, o) => sum + (o.approved_talent_count || 0),
    0,
  );

  function handleSelectApprovedOrg(orgId: string) {
    setFilterOrgId(orgId);
    setActiveTab("discovery");
  }

  const name = identity?.displayName || "Talent Viewer";

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={styles.topTitleCol}>
          <Text style={styles.brandTitle}>LogIn Talent Network</Text>
          <Text style={styles.brandSubtitle}>
            Cross-Organization Professional Discovery
          </Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Talent Viewer</Text>
        </View>
      </View>

      {/* Segmented Tab Navigation */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab("overview")}
          style={[
            styles.tabItem,
            activeTab === "overview" && styles.tabItemActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "overview" && styles.tabTextActive,
            ]}
          >
            Overview
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("organizations")}
          style={[
            styles.tabItem,
            activeTab === "organizations" && styles.tabItemActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "organizations" && styles.tabTextActive,
            ]}
          >
            Organizations
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("discovery")}
          style={[
            styles.tabItem,
            activeTab === "discovery" && styles.tabItemActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "discovery" && styles.tabTextActive,
            ]}
          >
            Talent
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("my_access")}
          style={[
            styles.tabItem,
            activeTab === "my_access" && styles.tabItemActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "my_access" && styles.tabTextActive,
            ]}
          >
            My Access
          </Text>
        </Pressable>
      </View>

      {/* Main View Area */}
      <View style={styles.content}>
        {activeTab === "overview" ? (
          loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.overviewScroll}
              refreshControl={
                <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
              }
              showsVerticalScrollIndicator={false}
            >
              {/* Hero greeting */}
              <View style={styles.heroCard}>
                <View style={styles.heroAvatar}>
                  <Text style={styles.heroAvatarText}>
                    {name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.heroTextCol}>
                  <Text style={styles.welcomeLabel}>Welcome back,</Text>
                  <Text style={styles.heroName}>{name}</Text>
                  <Text style={styles.heroDesc}>
                    Authorized to discover verified professional talent profiles
                    belonging to approved participating organizations.
                  </Text>
                </View>
              </View>

              {/* KPI metrics */}
              <View style={styles.metricsGrid}>
                <Pressable
                  onPress={() => setActiveTab("organizations")}
                  style={styles.metricCard}
                >
                  <Text style={styles.metricValue}>{approvedOrgsCount}</Text>
                  <Text style={styles.metricLabel}>Approved Orgs</Text>
                  <Text style={styles.metricSub}>Ready for discovery</Text>
                </Pressable>

                <Pressable
                  onPress={() => setActiveTab("my_access")}
                  style={styles.metricCard}
                >
                  <Text style={[styles.metricValue, styles.metricValueAmber]}>
                    {pendingOrgsCount}
                  </Text>
                  <Text style={styles.metricLabel}>Pending Requests</Text>
                  <Text style={styles.metricSub}>Under review</Text>
                </Pressable>

                <Pressable
                  onPress={() => setActiveTab("discovery")}
                  style={styles.metricCard}
                >
                  <Text style={[styles.metricValue, styles.metricValuePrimary]}>
                    {totalTalentAvailable}
                  </Text>
                  <Text style={styles.metricLabel}>Discoverable Talent</Text>
                  <Text style={styles.metricSub}>Approved profiles</Text>
                </Pressable>
              </View>

              {/* Privacy Boundary Notice */}
              <View style={styles.boundaryCard}>
                <Text style={styles.boundaryTitle}>
                  🛡 Talent Network Privacy Guarantee
                </Text>
                <Text style={styles.boundaryText}>
                  • Only professional summaries, verified skills, experience,
                  education, and projects are visible.
                  {"\n"}• Internal employee records, attendance clocks, leave,
                  work assignments, and compensation are strictly protected and
                  never exposed.
                  {"\n"}• Access is granted on a per-organization basis by
                  authorized organizational administrators.
                </Text>
              </View>

              {/* Quick action buttons */}
              <View style={styles.actionsCard}>
                <Text style={styles.actionsTitle}>Quick Actions</Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveTab("organizations")}
                  style={styles.actionRow}
                >
                  <View style={styles.actionIconBox}>
                    <Text style={styles.actionIcon}>🏢</Text>
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionRowTitle}>
                      Browse Participating Organizations
                    </Text>
                    <Text style={styles.actionRowSubtitle}>
                      Discover organizations and submit access requests
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveTab("discovery")}
                  style={styles.actionRow}
                >
                  <View style={styles.actionIconBox}>
                    <Text style={styles.actionIcon}>🔍</Text>
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionRowTitle}>
                      Talent Discovery Search
                    </Text>
                    <Text style={styles.actionRowSubtitle}>
                      Search approved talent by skills, title, or keywords
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveTab("my_access")}
                  style={styles.actionRow}
                >
                  <View style={styles.actionIconBox}>
                    <Text style={styles.actionIcon}>📋</Text>
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionRowTitle}>
                      View Organization Access Status
                    </Text>
                    <Text style={styles.actionRowSubtitle}>
                      Track pending, approved, and reviewed requests
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </Pressable>
              </View>
            </ScrollView>
          )
        ) : activeTab === "organizations" ? (
          <TalentNetworkOrganizationsView
            onSelectApprovedOrg={handleSelectApprovedOrg}
          />
        ) : activeTab === "discovery" ? (
          <TalentNetworkDiscoveryView
            initialOrgId={filterOrgId}
            onNavigateToOrganizations={() => setActiveTab("organizations")}
          />
        ) : (
          <TalentNetworkMyAccessView
            onDiscoverOrgTalent={handleSelectApprovedOrg}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.white,
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  topTitleCol: {
    gap: 1,
  },
  brandTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: colors.muted,
    fontSize: 11,
  },
  roleBadge: {
    backgroundColor: "#F5F3FF",
    borderColor: "#DDD6FE",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleBadgeText: {
    color: "#6D28D9",
    fontSize: 10,
    fontWeight: "800",
  },
  tabBar: {
    backgroundColor: colors.white,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
    paddingVertical: spacing.sm + 2,
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
    borderBottomWidth: 2,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  content: {
    backgroundColor: colors.canvas,
    flex: 1,
    padding: spacing.md,
  },
  centerBox: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  overviewScroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  heroAvatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  heroAvatarText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
  },
  heroTextCol: {
    flex: 1,
    gap: 2,
  },
  welcomeLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  heroName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  heroDesc: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  metricCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: spacing.sm + 2,
  },
  metricValue: {
    color: "#166534",
    fontSize: 22,
    fontWeight: "800",
  },
  metricValueAmber: {
    color: "#D97706",
  },
  metricValuePrimary: {
    color: colors.primary,
  },
  metricLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  metricSub: {
    color: colors.muted,
    fontSize: 9,
  },
  boundaryCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md,
  },
  boundaryTitle: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "800",
  },
  boundaryText: {
    color: "#166534",
    fontSize: 11,
    lineHeight: 17,
  },
  actionsCard: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  actionsTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  actionRow: {
    alignItems: "center",
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  actionIconBox: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionTextCol: {
    flex: 1,
    gap: 2,
  },
  actionRowTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  actionRowSubtitle: {
    color: colors.muted,
    fontSize: 11,
  },
  actionArrow: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "600",
  },
});
