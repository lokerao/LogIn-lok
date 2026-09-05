import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    EmployeeScreen,
    EmptyModule,
    employeeStyles,
} from "@/components/employee-screen";
import { TalentNetworkMyAccessView } from "@/components/talent-network/talent-network-my-access-view";
import { TalentNetworkOrganizationsView } from "@/components/talent-network/talent-network-organizations-view";
import { colors, radius, spacing } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { useEmployee } from "@/features/employee/employee-provider";
import { isTalentViewer } from "@/types/roles";

export default function MoreScreen() {
  const router = useRouter();
  const { identity, session, signOut, isReady } = useAuth();
  const { employee } = useEmployee();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showOrgsModal, setShowOrgsModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);

  const isViewer = isTalentViewer(identity?.roles);
  const isAuthLoading = !isReady || Boolean(session && !identity);

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

  const canonicalName = employee
    ? `${employee.firstName} ${employee.lastName}`.trim()
    : "";
  const name =
    canonicalName ||
    employee?.displayName ||
    identity?.displayName ||
    (isViewer ? "Talent Viewer" : "Employee");

  const email = employee?.workEmail ?? session?.user?.email ?? null;
  const isAdmin = !isViewer && identity?.roles.includes("admin");
  const isAttendanceEligible =
    !isViewer &&
    !isAdmin &&
    identity?.roles.some((r) => ["employee", "manager", "hr"].includes(r));
  const isHR = !isViewer && identity?.roles.includes("hr");
  const isManager = !isViewer && identity?.roles.includes("manager");

  if (isAuthLoading) {
    return (
      <EmployeeScreen title="More">
        <ActivityIndicator color={colors.primary} />
      </EmployeeScreen>
    );
  }

  if (isViewer) {
    return (
      <EmployeeScreen title="More">
        <EmptyModule
          message="Additional workforce modules are not available for Talent Viewers."
          title="Access Restricted"
        />
      </EmployeeScreen>
    );
  }

  return (
    <EmployeeScreen title="More">
      {/* Attendance Module (For Eligible Roles: Employee, Manager, HR) */}
      {isAttendanceEligible && (
        <View style={employeeStyles.card}>
          <Text style={employeeStyles.label}>Workforce Modules</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/attendance" as any)}
            style={styles.navRow}
          >
            <View>
              <Text style={styles.navRowTitle}>Attendance & Shift Clock</Text>
              <Text style={styles.navRowSubtitle}>
                Live camera check-in, check-out, and attendance history
              </Text>
            </View>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/leave" as any)}
            style={styles.navRow}
          >
            <View>
              <Text style={styles.navRowTitle}>Leave</Text>
              <Text style={styles.navRowSubtitle}>
                Apply for leave, view balances, and track requests
              </Text>
            </View>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(app)/(tabs)/work" as any)}
            style={styles.navRow}
          >
            <View>
              <Text style={styles.navRowTitle}>Daily Work Assignments</Text>
              <Text style={styles.navRowSubtitle}>
                Today&apos;s tasks, progress updates, and team assignments
              </Text>
            </View>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>

          {isManager && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/team" as any)}
              style={styles.navRow}
            >
              <View>
                <Text style={styles.navRowTitle}>My Team & Dashboard</Text>
                <Text style={styles.navRowSubtitle}>
                  Team overview, attendance, leaves, and direct reports
                </Text>
              </View>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          )}

          {isHR && (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/hr" as any)}
                style={styles.navRow}
              >
                <View>
                  <Text style={styles.navRowTitle}>HR & Organization Hub</Text>
                  <Text style={styles.navRowSubtitle}>
                    Workforce directory, lifecycle, hierarchy, and talent
                    reviews
                  </Text>
                </View>
                <Text style={styles.navArrow}>›</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/attendance" as any)}
                style={styles.navRow}
              >
                <View>
                  <Text style={styles.navRowTitle}>
                    HR Attendance Verification
                  </Text>
                  <Text style={styles.navRowSubtitle}>
                    Review and verify employee attendance photos
                  </Text>
                </View>
                <Text style={styles.navArrow}>›</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Administration Module (For Admin Role) */}
      {isAdmin && (
        <View style={employeeStyles.card}>
          <Text style={employeeStyles.label}>Administration</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/admin" as any)}
            style={styles.navRow}
          >
            <View>
              <Text style={styles.navRowTitle}>Admin & Organization Hub</Text>
              <Text style={styles.navRowSubtitle}>
                Organization structure, departments, teams, locations, and roles
              </Text>
            </View>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>
      )}

      {/* Talent Network Module (For Talent Viewer) */}
      {isViewer && (
        <>
          <View style={employeeStyles.card}>
            <Text style={employeeStyles.label}>Talent Network</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(app)/(tabs)" as any)}
              style={styles.navRow}
            >
              <View>
                <Text style={styles.navRowTitle}>Talent Network Overview</Text>
                <Text style={styles.navRowSubtitle}>
                  Dashboard, metrics, and quick network access
                </Text>
              </View>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(app)/(tabs)/talent" as any)}
              style={styles.navRow}
            >
              <View>
                <Text style={styles.navRowTitle}>Discover Talent Profiles</Text>
                <Text style={styles.navRowSubtitle}>
                  Search candidates by skills, headline, and approved portfolios
                </Text>
              </View>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setShowOrgsModal(true)}
              style={styles.navRow}
            >
              <View>
                <Text style={styles.navRowTitle}>
                  Participating Organizations
                </Text>
                <Text style={styles.navRowSubtitle}>
                  Browse organizations and request access
                </Text>
              </View>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAccessModal(true)}
              style={styles.navRow}
            >
              <View>
                <Text style={styles.navRowTitle}>My Access Requests</Text>
                <Text style={styles.navRowSubtitle}>
                  Track pending, approved, and rejected access requests
                </Text>
              </View>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          <View style={employeeStyles.card}>
            <Text style={employeeStyles.label}>Privacy & Compliance</Text>
            <Text style={styles.complianceText}>
              • You are browsing verified candidate profiles in read-only mode.
              {"\n"}• Candidate profiles are visible only after explicit
              organization approval.{"\n"}• Internal organization data,
              attendance, leave, and compensation are strictly protected and
              isolated.
            </Text>
          </View>
        </>
      )}

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
            {isViewer && (
              <Text style={styles.userMeta}>Role: External Talent Viewer</Text>
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

      {/* Modals for Talent Viewer */}
      {isViewer && (
        <>
          <Modal
            animationType="slide"
            onRequestClose={() => setShowOrgsModal(false)}
            visible={showOrgsModal}
          >
            <SafeAreaView style={styles.modalSafe}>
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => setShowOrgsModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕ Close</Text>
                </Pressable>
                <Text style={styles.modalHeaderTitle}>Organizations</Text>
                <View style={{ width: 60 }} />
              </View>
              <TalentNetworkOrganizationsView />
            </SafeAreaView>
          </Modal>

          <Modal
            animationType="slide"
            onRequestClose={() => setShowAccessModal(false)}
            visible={showAccessModal}
          >
            <SafeAreaView style={styles.modalSafe}>
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => setShowAccessModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕ Close</Text>
                </Pressable>
                <Text style={styles.modalHeaderTitle}>My Access Requests</Text>
                <View style={{ width: 60 }} />
              </View>
              <TalentNetworkMyAccessView />
            </SafeAreaView>
          </Modal>
        </>
      )}
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
  navRow: {
    alignItems: "center",
    borderTopColor: "#EEF1F6",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  navRowTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  navRowSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  navArrow: {
    color: colors.muted,
    fontSize: 20,
    fontWeight: "600",
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
  complianceText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  modalSafe: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  modalHeader: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: "#EEF1F6",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalHeaderTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  modalCloseBtn: {
    paddingVertical: spacing.xs,
  },
  modalCloseText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
});
