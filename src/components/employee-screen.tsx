import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/constants/design-system';
export function EmployeeScreen({ title, children }: PropsWithChildren<{ title: string }>) { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>{title}</Text>{children}</ScrollView></SafeAreaView>; }
export function EmptyModule({ title, message }: { title: string; message: string }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{message}</Text></View>; }
export const employeeStyles = StyleSheet.create({ label: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: .5, textTransform: 'uppercase' }, card: { backgroundColor: colors.white, borderRadius: radius.md, gap: spacing.sm, padding: spacing.md }, body: { color: colors.ink, ...typography.body }, muted: { color: colors.muted, ...typography.body } });
const styles = StyleSheet.create({ safe: { backgroundColor: colors.canvas, flex: 1 }, content: { gap: spacing.lg, padding: spacing.lg }, title: { color: colors.ink, ...typography.title }, empty: { backgroundColor: colors.white, borderRadius: radius.md, gap: spacing.sm, padding: spacing.lg }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' }, emptyText: { color: colors.muted, ...typography.body } });
