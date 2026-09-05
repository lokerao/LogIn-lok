import {
    EmployeeScreen,
    EmptyModule,
    employeeStyles,
} from "@/components/employee-screen";
import { Button } from "@/components/ui/button";
import { colors, spacing, typography } from "@/constants/design-system";
import { useEmployee } from "@/features/employee/employee-provider";
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
  const { employee, error, isLoading, updateDisplayName } = useEmployee();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
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
});
