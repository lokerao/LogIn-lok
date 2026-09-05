import {
    EmployeeScreen,
    EmptyModule,
    employeeStyles,
} from "@/components/employee-screen";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing, typography } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { useEmployee } from "@/features/employee/employee-provider";
import { isTalentViewer } from "@/types/roles";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function ProfileScreen() {
  const { identity, session, signOut, isReady } = useAuth();
  const isViewer = isTalentViewer(identity?.roles);
  const isAuthLoading = !isReady || Boolean(session && !identity);
  const { employee, error, isLoading, updateDisplayName } = useEmployee();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
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

  if (isAuthLoading) {
    return (
      <EmployeeScreen title="Profile">
        <ActivityIndicator color={colors.primary} />
      </EmployeeScreen>
    );
  }

  if (isViewer) {
    const displayName = identity?.displayName || "Talent Viewer";
    const email = session?.user?.email ?? "Not provided";
    return (
      <EmployeeScreen title="Viewer Account">
        <View style={employeeStyles.card}>
          <Text style={employeeStyles.label}>Account Details</Text>
          <View style={styles.viewerHeader}>
            <View style={styles.viewerAvatar}>
              <Text style={styles.viewerAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.viewerEmail}>{email}</Text>
              <View style={styles.viewerBadge}>
                <Text style={styles.viewerBadgeText}>Talent Viewer</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={employeeStyles.card}>
          <Text style={employeeStyles.label}>Network Access Privileges</Text>
          <Text style={styles.viewerScopeText}>
            • Discover participating organizations in the talent network.{"\n"}•
            Request organization-specific access to view candidate profiles.
            {"\n"}• Access approved professional summaries, verified skills, and
            experience timelines.{"\n"}• Strictly read-only access. Internal
            attendance, payroll, and workforce data are isolated.
          </Text>
        </View>

        <View style={employeeStyles.card}>
          <Text style={employeeStyles.label}>Account Session</Text>
          <Button accessibilityLabel="Log out" onPress={confirmSignOut}>
            {isSigningOut ? "Signing out…" : "Log out"}
          </Button>
        </View>
      </EmployeeScreen>
    );
  }

  if (isLoading)
    return (
      <EmployeeScreen title="Profile">
        <ActivityIndicator color={colors.primary} />
      </EmployeeScreen>
    );
  if (error || !employee)
    return (
      <EmployeeScreen title="Profile">
        <EmptyModule
          title="Profile unavailable"
          message={error ?? "Your employee profile is not available yet."}
        />
      </EmployeeScreen>
    );
  async function save() {
    setSaving(true);
    const message = await updateDisplayName(name);
    setSaving(false);
    if (message) Alert.alert("Could not save", message);
    else {
      setEditing(false);
      Alert.alert("Saved", "Your display name has been updated.");
    }
  }
  const label = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return "Not provided";
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "Not provided";
  };

  const canonicalName =
    `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim();
  const resolvedName =
    (canonicalName && canonicalName !== "Test Employee"
      ? canonicalName
      : employee.displayName) ||
    canonicalName ||
    employee.displayName ||
    "Employee";
  const rows: [string, string][] = [
    ["Employee ID", label(employee.employeeCode)],
    ["Work email", label(employee.workEmail)],
    ["Phone", label(employee.phone)],
    ["Department", label(employee.department)],
    ["Team", label(employee.team)],
    ["Designation", label(employee.designation)],
    ["Joining date", label(employee.joiningDate)],
    ["Employment type", label(employee.employmentType?.replace(/_/g, " "))],
    ["Employment status", label(employee.employmentStatus?.replace(/_/g, " "))],
    ["Location", label(employee.location)],
  ];
  return (
    <EmployeeScreen title="Profile">
      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Identity</Text>
        {editing ? (
          <>
            <TextInput
              accessibilityLabel="Display name"
              maxLength={100}
              onChangeText={setName}
              style={styles.input}
              value={name}
            />
            <Button
              accessibilityLabel="Save display name"
              onPress={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Text
              accessibilityRole="button"
              onPress={() => {
                setName(resolvedName);
                setEditing(false);
              }}
              style={styles.cancel}
            >
              Cancel
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.name}>{resolvedName}</Text>
            <Text style={employeeStyles.muted}>
              Profile photo uploads will be enabled when private storage is
              ready.
            </Text>
            <Text
              accessibilityRole="button"
              onPress={() => {
                setName(resolvedName);
                setEditing(true);
              }}
              style={styles.edit}
            >
              Edit display name
            </Text>
          </>
        )}
      </View>
      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Employment</Text>
        {rows.map(([title, value]) => (
          <View key={title} style={styles.row}>
            <Text style={styles.rowLabel}>{title}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        ))}
      </View>
    </EmployeeScreen>
  );
}
const styles = StyleSheet.create({
  name: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  edit: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: "#D5DDEA",
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    padding: spacing.md,
  },
  cancel: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  row: {
    borderTopColor: "#EEF1F6",
    borderTopWidth: 1,
    gap: 2,
    paddingTop: spacing.sm,
  },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: {
    color: colors.ink,
    textTransform: "capitalize",
    ...typography.body,
  },
  viewerHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  viewerAvatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  viewerAvatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
  },
  viewerEmail: {
    color: colors.muted,
    fontSize: 14,
  },
  viewerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  viewerBadgeText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },
  viewerScopeText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
});
