import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { colors, spacing, typography } from '@/constants/design-system';
import { useAuth } from '@/features/auth/auth-provider';
export default function ProtectedPlaceholder() {
  const { identity, session, signOut } = useAuth();
  return <SafeAreaView style={styles.screen}><View style={styles.content}><Text style={styles.brand}>LogIn</Text><View style={styles.body}><Text style={styles.title}>You’re signed in.</Text><Text style={styles.text}>{identity?.displayName ?? session?.user.email ?? 'Authenticated user'}</Text><Text style={styles.role}>Role: {identity?.roles[0] ?? 'No assigned role'}</Text><Text style={styles.note}>This protected placeholder verifies identity and access. Role dashboards are not part of Phase 2.</Text></View><Button accessibilityLabel="Sign out" onPress={() => void signOut()}>Sign out</Button></View></SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { backgroundColor: colors.canvas, flex: 1 }, content: { flex: 1, justifyContent: 'space-between', padding: spacing.lg }, brand: { color: colors.ink, fontSize: 24, fontWeight: '800' }, body: { gap: spacing.md }, title: { color: colors.ink, ...typography.title }, text: { color: colors.ink, ...typography.subtitle }, role: { color: colors.primary, fontSize: 15, fontWeight: '700' }, note: { color: colors.muted, ...typography.body } });
