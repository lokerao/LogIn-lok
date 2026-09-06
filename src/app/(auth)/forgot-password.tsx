import { Button } from '@/components/ui/button';
import { colors, radius, spacing, typography } from '@/constants/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string | null {
    const trimmed = email.trim();
    if (!trimmed) {
      return 'Please enter your work email address.';
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      return 'Please enter a valid work email address.';
    }
    return null;
  }

  async function handleResetRequest() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedEmail = email.trim();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await requestPasswordReset(trimmedEmail);
      setIsSubmitting(false);

      if (!result.success && result.error) {
        setError(result.error);
        return;
      }

      // Move to the code verification step
      router.push({
        pathname: '/verify-otp' as any,
        params: { email: trimmedEmail },
      });
    } catch {
      setIsSubmitting(false);
      setError('Unable to send verification code. Please check your network.');
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>LogIn</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back to Sign in</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Forgot password</Text>
          <Text style={styles.subtitle}>
            Enter your work email address and we will send you a 6-digit verification code to reset your password.
          </Text>

          <TextInput
            accessibilityLabel="Work email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(null);
            }}
            placeholder="Work email"
            style={styles.input}
            value={email}
          />

          <Button
            accessibilityLabel="Send verification code"
            onPress={() => void handleResetRequest()}
          >
            {isSubmitting ? 'Sending code…' : 'Send verification code'}
          </Button>

          {isSubmitting && <ActivityIndicator color={colors.primary} />}

          {error && (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  form: { gap: spacing.md, marginBottom: 'auto', marginTop: 'auto' },
  title: { color: colors.ink, ...typography.title },
  subtitle: { color: colors.muted, ...typography.subtitle },
  input: {
    backgroundColor: colors.white,
    borderColor: '#D5DDEA',
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    padding: spacing.md,
  },
  error: { color: '#B42318', ...typography.body },
});
