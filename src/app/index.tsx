import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { colors, radius, spacing, typography } from '@/constants/design-system';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.brand}>
          <View style={styles.mark}><View style={styles.markInset} /></View>
          <Text style={styles.brandText}>LogIn</Text>
        </View>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>WORKPLACE, SIMPLIFIED</Text>
          <Text style={styles.title}>A better start{'\n'}to work.</Text>
          <Text style={styles.subtitle}>Your secure home for people, progress, and the work that connects them.</Text>
        </View>
        <View style={styles.footer}>
          <StatusIndicator>{isSupabaseConfigured ? 'Secure connection configured' : 'Foundation ready'}</StatusIndicator>
          <Button accessibilityLabel="LogIn foundation is being prepared">Coming soon</Button>
          <Text style={styles.note}>Authentication will be enabled after the secure backend is connected.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  mark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.sm, height: 32, justifyContent: 'center', transform: [{ rotate: '-8deg' }], width: 32 },
  markInset: { borderColor: colors.white, borderRadius: 4, borderWidth: 3, height: 13, width: 13 },
  brandText: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.7 },
  hero: { marginTop: 'auto', paddingBottom: spacing.xxl },
  eyebrow: { color: colors.primary, marginBottom: spacing.md, ...typography.eyebrow },
  title: { color: colors.ink, marginBottom: spacing.md, ...typography.title },
  subtitle: { color: colors.muted, maxWidth: 330, ...typography.subtitle },
  footer: { gap: spacing.md },
  note: { color: colors.muted, textAlign: 'center', ...typography.body },
});
