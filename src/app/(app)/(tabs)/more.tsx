import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { EmployeeScreen, employeeStyles } from "@/components/employee-screen";
import { colors, radius, spacing } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { useEmployee } from "@/features/employee/employee-provider";

export default function MoreScreen() {
  const { identity, signOut } = useAuth();
  const { employee } = useEmployee();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      Alert.alert(
        "Sign Out Error",
        "Could not sign out of your account. Please try again.",
      );
      setIsSigningOut(false);
    }
  }

  function confirmSignOut() {
    Alert.alert(
      "Log out?",
      "You'll need to sign in again to access your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: () => void handleSignOut(),
        },
      ],
    );
  }

  const name =
    employee?.displayName ||
    (employee ? `${employee.firstName} ${employee.lastName}` : null) ||
    identity?.displayName ||
    "Employee";

  const email = employee?.workEmail ?? null;

  return (
    <EmployeeScreen title="More">
      {/* Account Section */}
      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Account</Text>

        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name}</Text>
            {Boolean(email) && <Text style={styles.userEmail}>{email}</Text>}
            {Boolean(employee?.employeeCode) && (
              <Text style={styles.userMeta}>
                Employee ID: {employee?.employeeCode}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionDivider} />

        <Pressable
          accessibilityLabel="Log out of account"
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={confirmSignOut}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator color="#B42318" size="small" />
          ) : (
            <Text style={styles.logoutText}>Log out</Text>
          )}
        </Pressable>
      </View>

      {/* Upcoming Modules Card */}
      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Upcoming Modules</Text>
        <Text style={employeeStyles.muted}>
          Attendance & punch-in, leave management, work progress, and company
          documents are scheduled for upcoming development phases.
        </Text>
      </View>
    </EmployeeScreen>
  );
}

const styles = StyleSheet.create({
  userRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "800",
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  userEmail: {
    color: colors.muted,
    fontSize: 13,
  },
  userMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  actionDivider: {
    backgroundColor: "#EEF1F6",
    height: 1,
    marginTop: spacing.sm,
  },
  logoutButton: {
    alignItems: "center",
    backgroundColor: "#FEE4E2",
    borderRadius: radius.sm,
    justifyContent: "center",
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
  },
  logoutButtonPressed: {
    backgroundColor: "#FECDCA",
  },
  logoutText: {
    color: "#B42318",
    fontSize: 15,
    fontWeight: "700",
  },
});
