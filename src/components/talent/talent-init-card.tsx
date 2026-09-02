import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { employeeStyles } from "@/components/employee-screen";
import { Button } from "@/components/ui/button";
import { colors, spacing, typography } from "@/constants/design-system";
import { getSupabase } from "@/lib/supabase";

type Props = {
  employeeId: string;
  defaultName: string;
  defaultTitle: string | null;
  onInitialized: () => void;
};

export function TalentInitCard({
  employeeId,
  defaultName,
  defaultTitle,
  onInitialized,
}: Props) {
  const [isInitializing, setIsInitializing] = useState(false);

  async function handleInitialize() {
    setIsInitializing(true);
    try {
      const { error } = await getSupabase()
        .from("talent_profiles")
        .insert({
          employee_id: employeeId,
          professional_name: defaultName || null,
          professional_title: defaultTitle || null,
          summary: null,
          visibility: "private",
        });

      if (error) {
        Alert.alert(
          "Initialization Error",
          error.message || "Could not create your Talent Profile.",
        );
      } else {
        Alert.alert(
          "Talent Profile Created",
          "Your professional Talent ID has been generated.",
        );
        onInitialized();
      }
    } catch {
      Alert.alert(
        "Error",
        "An unexpected error occurred while creating your Talent Profile.",
      );
    } finally {
      setIsInitializing(false);
    }
  }

  return (
    <View style={employeeStyles.card}>
      <Text style={employeeStyles.label}>Professional Talent Profile</Text>
      <Text style={styles.title}>Initialize Your Talent Profile</Text>
      <Text style={styles.description}>
        Your Talent Profile is your portable professional identity. Creating it
        generates your unique Talent ID and enables you to showcase verified
        skills, experience, education, certifications, and portfolio projects.
      </Text>
      {isInitializing ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <Button
          accessibilityLabel="Create Talent Profile"
          onPress={() => void handleInitialize()}
        >
          Create Professional Profile
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  description: {
    color: colors.muted,
    ...typography.body,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  loader: {
    paddingVertical: spacing.md,
  },
});
