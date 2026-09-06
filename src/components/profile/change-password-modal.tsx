import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { colors, radius, spacing, typography } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { SymbolView } from "expo-symbols";

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({
  visible,
  onClose,
}: ChangePasswordModalProps) {
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function validate(): string | null {
    if (!currentPassword) {
      return "Please enter your current password.";
    }
    if (!newPassword) {
      return "Please enter a new password.";
    }
    if (newPassword.length < 6) {
      return "New password must be at least 6 characters long.";
    }
    if (newPassword === currentPassword) {
      return "New password cannot be the same as your current password.";
    }
    if (!confirmPassword) {
      return "Please confirm your new password.";
    }
    if (newPassword !== confirmPassword) {
      return "New password and confirmation do not match.";
    }
    return null;
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const message = await changePassword(currentPassword, newPassword);
      if (message) {
        setError(message);
        setIsSubmitting(false);
      } else {
        resetForm();
        setIsSubmitting(false);
        onClose();
        Alert.alert(
          "Password Updated",
          "Your password has been changed successfully.",
        );
      }
    } catch {
      setError("An unexpected error occurred. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Dismiss modal backdrop"
          onPress={handleClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Change Password</Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={handleClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Current Password */}
            <View style={styles.field}>
              <Text style={styles.label}>CURRENT PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  accessibilityLabel="Current password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showCurrentPassword}
                  style={styles.passwordInput}
                  value={currentPassword}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showCurrentPassword
                      ? "Hide current password"
                      : "Show current password"
                  }
                  hitSlop={8}
                  onPress={() => setShowCurrentPassword((prev) => !prev)}
                  style={styles.eyeButton}
                >
                  <SymbolView
                    name={{
                      ios: showCurrentPassword ? "eye.slash" : "eye",
                      android: showCurrentPassword ? "visibility_off" : "visibility",
                      web: showCurrentPassword ? "visibility_off" : "visibility",
                    }}
                    size={20}
                    tintColor={colors.muted}
                  />
                </Pressable>
              </View>
            </View>

            {/* New Password */}
            <View style={styles.field}>
              <Text style={styles.label}>NEW PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  accessibilityLabel="New password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min. 6 characters)"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showNewPassword}
                  style={styles.passwordInput}
                  value={newPassword}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showNewPassword
                      ? "Hide new password"
                      : "Show new password"
                  }
                  hitSlop={8}
                  onPress={() => setShowNewPassword((prev) => !prev)}
                  style={styles.eyeButton}
                >
                  <SymbolView
                    name={{
                      ios: showNewPassword ? "eye.slash" : "eye",
                      android: showNewPassword ? "visibility_off" : "visibility",
                      web: showNewPassword ? "visibility_off" : "visibility",
                    }}
                    size={20}
                    tintColor={colors.muted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Confirm New Password */}
            <View style={styles.field}>
              <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  accessibilityLabel="Confirm new password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showConfirmPassword}
                  style={styles.passwordInput}
                  value={confirmPassword}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  hitSlop={8}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  style={styles.eyeButton}
                >
                  <SymbolView
                    name={{
                      ios: showConfirmPassword ? "eye.slash" : "eye",
                      android: showConfirmPassword ? "visibility_off" : "visibility",
                      web: showConfirmPassword ? "visibility_off" : "visibility",
                    }}
                    size={20}
                    tintColor={colors.muted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Error banner */}
            {Boolean(error) && (
              <View style={styles.errorBox}>
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {error}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <Pressable
              accessibilityLabel="Update password"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.submitBtnPressed,
                isSubmitting && styles.submitBtnDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitText}>Update Password</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(23,34,53,0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#EEF1F6",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeTxt: {
    color: colors.muted,
    fontSize: 18,
  },
  body: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: "#DEE4EF",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  passwordContainer: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: "#DEE4EF",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
  },
  passwordInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  eyeButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBox: {
    backgroundColor: "#FEE4E2",
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: {
    color: "#B42318",
    fontSize: 14,
  },
  submitBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
  },
  submitBtnPressed: {
    backgroundColor: colors.primaryPressed,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: colors.white,
    ...typography.button,
  },
});

