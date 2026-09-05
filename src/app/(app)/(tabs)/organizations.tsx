import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyModule } from "@/components/employee-screen";
import { TalentNetworkOrganizationsView } from "@/components/talent-network/talent-network-organizations-view";
import { colors, spacing } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { isTalentViewer } from "@/types/roles";

export default function OrganizationsScreen() {
  const router = useRouter();
  const { identity, isReady, session } = useAuth();
  const isViewer = isTalentViewer(identity?.roles);
  const isAuthLoading = !isReady || Boolean(session && !identity);

  if (isAuthLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isViewer) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.restrictedContainer}>
          <EmptyModule
            message="Talent Network organizations directory is available exclusively to Talent Viewers."
            title="Access Restricted"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <TalentNetworkOrganizationsView
        onSelectApprovedOrg={(orgId) => {
          router.push({
            pathname: "/(app)/(tabs)/talent",
            params: { orgId },
          } as any);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  restrictedContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  centerContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
