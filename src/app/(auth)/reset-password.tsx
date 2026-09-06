import { Button } from '@/components/ui/button';
import { colors, radius, spacing, typography } from '@/constants/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const { session, isRecoveringPassword, resetPasswordWithRecoverySession, signOut } =
    useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const hasValidSession = Boolean(session && isRecoveringPassword);

  function validate(): string | null {
    if (!newPassword) {
      return 'Please enter a new password.';
    }
    if (newPassword.length < 6) {
      return 'New password must be at least 6 characters long.';
    }
    if (!confirmPassword) {
      return 'Please confirm your new password.';
    }
    if (newPassword !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  }

  async function handleResetPassword() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await resetPasswordWithRecoverySession(newPassword);
      setIsSubmitting(false);

      if (!result.success && result.error) {
        setError(result.error);
        return;
      }

      // Success: clear inputs and show confirmation
      setNewPassword('');
      setConfirmPassword('');
      setIsSuccess(true);
    } catch {
      setIsSubmitting(false);
      setError('An unexpected error occurred. Please try again.');
    }
  }

  async function handleCancel() {
    await signOut();
    router.replace('/sign-in' as any);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>LogIn</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel and return to sign in"
            onPress={() => void handleCancel()}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Back to Sign in</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          {!hasValidSession && !isSuccess ? (
            <View style={styles.errorContainer}>
              <Text style={styles.title}>Session expired</Text>
              <Text style={styles.errorMessage}>
                No active password recovery session was found. Please request a new verification code.
              </Text>
              <Button
                accessibilityLabel="Go to forgot password"
                onPress={() => router.replace('/forgot-password' as any)}
              >
                Request New Code
              </Button>
            </View>
          ) : isSuccess ? (
            <View style={styles.successContainer}>
              <Text style={styles.title}>Password updated</Text>
              <Text style={styles.successMessage}>
                Your password has been successfully reset. You can now sign in with your new credentials.
              </Text>
              <Button
                accessibilityLabel="Sign in with new password"
                onPress={() => router.replace('/sign-in' as any)}
              >
                Sign in with new password
              </Button>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.title}>Set new password</Text>
              <Text style={styles.subtitle}>
                Create a new password for your work account. Password must be at least 6 characters long.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    accessibilityLabel="New password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (error) setError(null);
                    }}
                    placeholder="Enter new password (min. 6 characters)"
                    secureTextEntry={!showNewPassword}
                    style={styles.passwordInput}
                    value={newPassword}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showNewPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowNewPassword((prev) => !prev)}
                    style={styles.eyeButton}
                    hitSlop={8}
                  >
                    <SymbolView
                      name={{
                        ios: showNewPassword ? 'eye.slash' : 'eye',
                        android: showNewPassword ? 'visibility_off' : 'visibility',
                        web: showNewPassword ? 'visibility_off' : 'visibility',
                      }}
                      size={20}
                      tintColor={colors.muted}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    accessibilityLabel="Confirm new password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (error) setError(null);
                    }}
                    placeholder="Confirm new password"
                    secureTextEntry={!showConfirmPassword}
                    style={styles.passwordInput}
                    value={confirmPassword}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    style={styles.eyeButton}
                    hitSlop={8}
                  >
                    <SymbolView
                      name={{
                        ios: showConfirmPassword ? 'eye.slash' : 'eye',
                        android: showConfirmPassword ? 'visibility_off' : 'visibility',
                        web: showConfirmPassword ? 'visibility_off' : 'visibility',
                      }}
                      size={20}
                      tintColor={colors.muted}
                    />
                  </Pressable>
                </View>
              </View>

              <Button
                accessibilityLabel="Update password"
                onPress={() => void handleResetPassword()}
              >
                {isSubmitting ? 'Updating password…' : 'Update password'}
              </Button>

              {isSubmitting && <ActivityIndicator color={colors.primary} />}

              {error && (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {error}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  cancelButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  form: { gap: spacing.md },
  fieldGroup: { gap: spacing.xs },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  title: { color: colors.ink, ...typography.title },
  subtitle: { color: colors.muted, ...typography.subtitle },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#D5DDEA',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    padding: spacing.md,
  },
  eyeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    gap: spacing.md,
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  errorMessage: {
    color: '#991B1B',
    fontSize: 14,
    lineHeight: 20,
  },
  successContainer: {
    gap: spacing.md,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  successMessage: {
    color: '#166534',
    fontSize: 15,
    lineHeight: 22,
  },
  error: { color: '#B42318', ...typography.body },
});
