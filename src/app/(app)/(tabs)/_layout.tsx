import { Tabs } from "expo-router";

import { colors } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { isTalentViewer } from "@/types/roles";

export default function AppTabs() {
  const { identity, isReady, session } = useAuth();

  if (!isReady || (session && !identity)) {
    return null;
  }

  const isViewer = isTalentViewer(identity?.roles);

  if (isViewer) {
    return (
      <Tabs
        key="talent-viewer-tabs"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.white },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen
          name="organizations"
          options={{ title: "Organizations" }}
        />
        <Tabs.Screen name="talent" options={{ title: "Talent" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        <Tabs.Screen
          name="work"
          options={{ href: null, tabBarItemStyle: { display: "none" } }}
        />
        <Tabs.Screen
          name="more"
          options={{ href: null, tabBarItemStyle: { display: "none" } }}
        />
      </Tabs>
    );
  }

  return (
    <Tabs
      key="employee-tabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="work" options={{ title: "My Work" }} />
      <Tabs.Screen name="talent" options={{ title: "Talent" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
      <Tabs.Screen
        name="organizations"
        options={{ href: null, tabBarItemStyle: { display: "none" } }}
      />
    </Tabs>
  );
}
