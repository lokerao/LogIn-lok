import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/design-system';
export function StatusIndicator({ children }: { children: string }) { return <View style={styles.container}><View style={styles.dot} /><Text style={styles.text}>{children}</Text></View>; }
const styles = StyleSheet.create({ container: { alignSelf: 'flex-start', alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.pill, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 12, paddingVertical: 8 }, dot: { backgroundColor: colors.success, borderRadius: radius.pill, height: 8, width: 8 }, text: { color: colors.success, fontSize: 13, fontWeight: '700' } });
