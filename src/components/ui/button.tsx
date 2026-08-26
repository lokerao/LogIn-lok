import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/design-system';
type ButtonProps = PropsWithChildren<{ accessibilityLabel: string; onPress?: () => void }>;
export function Button({ accessibilityLabel, children, onPress }: ButtonProps) {
  return <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.label}>{children}</Text></Pressable>;
}
const styles = StyleSheet.create({ button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md }, pressed: { backgroundColor: colors.primaryPressed }, label: { color: colors.white, ...typography.button } });
