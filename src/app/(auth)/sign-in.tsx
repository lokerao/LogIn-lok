import { Button } from '@/components/ui/button';
import { colors, radius, spacing, typography } from '@/constants/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignInScreen() {
  const { configurationError, identity, session, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset password visibility when the user leaves the screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowPassword(false);
      };
    }, []),
  );

  const blockedAccount = Boolean(session && identity?.status !== 'active');

  async function handleSignIn() {
    setError(null);
    setIsSubmitting(true);
    const message = await signIn(email, password);
    setError(message);
    setIsSubmitting(false);
    if (!message) {
      setShowPassword(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.brand}>LogIn</Text>
        <View style={styles.form}>
          <Text style={styles.title}>
            {blockedAccount ? 'Account unavailable' : 'Welcome back'}
          </Text>
          <Text style={styles.subtitle}>
            {configurationError
              ? 'Add the two public Supabase values to .env.local, then reload the app.'
              : blockedAccount
                ? 'Your account is not active. Contact your organization administrator.'
                : 'Sign in with your work account.'}
          </Text>

          {!configurationError && !blockedAccount && (
            <>
              <TextInput
                accessibilityLabel="Work email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Work email"
                style={styles.input}
                value={email}
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  accessibilityLabel="Password"
                  autoComplete="current-password"
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeButton}
                  hitSlop={8}
                >
                  <SymbolView
                    name={{
                      ios: showPassword ? 'eye.slash' : 'eye',
                      android: showPassword ? 'visibility_off' : 'visibility',
                      web: showPassword ? 'visibility_off' : 'visibility',
                    }}
                    size={20}
                    tintColor={colors.muted}
                  />
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forgot Password"
                onPress={() => router.push('/forgot-password' as any)}
                style={styles.forgotPasswordButton}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>

              <Button
                accessibilityLabel="Sign in"
                onPress={() => void handleSignIn()}
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </>
          )}

          {blockedAccount && (
            <Button accessibilityLabel="Sign out" onPress={() => void signOut()}>
              Sign out
            </Button>
          )}

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
  brand: { color: colors.ink, fontSize: 24, fontWeight: '800' },
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  error: { color: '#B42318', ...typography.body },
});

