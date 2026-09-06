import { Button } from '@/components/ui/button';
import { colors, radius, spacing, typography } from '@/constants/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpScreen() {
  const { verifyRecoveryOtp, requestPasswordReset } = useAuth();
  const searchParams = useLocalSearchParams();
  const email = (searchParams.email as string) || '';

  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Cooldown timer for resending code
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // If no email was passed, return to forgot-password
  useEffect(() => {
    if (!email) {
      router.replace('/forgot-password' as any);
    }
  }, [email]);

  function handleCodeChange(text: string) {
    const numericOnly = text.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpCode(numericOnly);
    if (error) setError(null);
    if (resendNotice) setResendNotice(null);
  }

  async function handleVerify() {
    if (isSubmitting) return;

    const trimmed = otpCode.trim();
    if (trimmed.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await verifyRecoveryOtp(email, trimmed);
      setIsSubmitting(false);

      if (!result.success && result.error) {
        setError(result.error);
        return;
      }

      // Proceed to Set New Password screen
      router.push({
        pathname: '/reset-password' as any,
        params: { email },
      });
    } catch {
      setIsSubmitting(false);
      setError('Failed to verify code. Please check your network connection.');
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0 || isResending) return;

    setError(null);
    setIsResending(true);

    try {
      const result = await requestPasswordReset(email);
      setIsResending(false);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);

      if (!result.success && result.error) {
        setError(result.error);
      } else {
        setResendNotice('A new verification code has been sent to your email.');
      }
    } catch {
      setIsResending(false);
      setError('Failed to resend code. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>LogIn</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to forgot password"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Change email</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Enter verification code</Text>

          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              If an account exists for this email, a verification code has been sent.
            </Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>6-Digit Recovery Code</Text>
            <TextInput
              accessibilityLabel="6-digit recovery code"
              autoComplete="one-time-code"
              autoFocus
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={handleCodeChange}
              placeholder="000000"
              placeholderTextColor="#94A3B8"
              style={styles.otpInput}
              value={otpCode}
            />
          </View>

          <Button
            accessibilityLabel="Verify code"
            onPress={() => void handleVerify()}
          >
            {isSubmitting ? 'Verifying code…' : 'Verify code'}
          </Button>

          <View style={styles.resendContainer}>
            {resendCooldown > 0 ? (
              <Text style={styles.cooldownText}>
                Resend code in {resendCooldown}s
              </Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Resend verification code"
                disabled={isResending}
                onPress={() => void handleResendCode()}
                style={styles.resendButton}
              >
                <Text style={styles.resendText}>
                  {isResending ? 'Sending…' : 'Resend verification code'}
                </Text>
              </Pressable>
            )}
          </View>

          {isSubmitting && <ActivityIndicator color={colors.primary} />}

          {resendNotice && (
            <Text accessibilityLiveRegion="polite" style={styles.successNote}>
              {resendNotice}
            </Text>
          )}

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
  infoBanner: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  infoText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  emailText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: { gap: spacing.xs },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  otpInput: {
    backgroundColor: colors.white,
    borderColor: '#D5DDEA',
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 10,
    padding: spacing.md,
    textAlign: 'center',
  },
  resendContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cooldownText: {
    color: colors.muted,
    fontSize: 14,
  },
  resendButton: {
    padding: spacing.xs,
  },
  resendText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  successNote: {
    color: '#15803D',
    fontSize: 14,
    textAlign: 'center',
  },
  error: { color: '#B42318', ...typography.body },
});
