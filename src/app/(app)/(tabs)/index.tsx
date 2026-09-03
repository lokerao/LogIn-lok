import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  EmployeeScreen,
  EmptyModule,
  employeeStyles,
} from '@/components/employee-screen';
import { colors, radius, spacing, typography } from '@/constants/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { useEmployee } from '@/features/employee/employee-provider';

export default function EmployeeHome() {
  const router = useRouter();
  const { identity } = useAuth();
  const { employee, error, isLoading } = useEmployee();

  if (isLoading) {
    return (
      <EmployeeScreen title="Home">
        <ActivityIndicator color={colors.primary} />
      </EmployeeScreen>
    );
  }

  if (error || !employee) {
    return (
      <EmployeeScreen title="Home">
        <EmptyModule
          message={error ?? 'Your employee profile is not available yet.'}
          title="Profile unavailable"
        />
      </EmployeeScreen>
    );
  }

  const name =
    employee.displayName ?? `${employee.firstName} ${employee.lastName}`;
  const isAttendanceEligible = identity?.roles.some((r) =>
    ['employee', 'manager', 'hr'].includes(r),
  );

  return (
    <EmployeeScreen title="Home">
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.detail}>
            {employee.designation ?? 'Employee'} · {employee.employeeCode}
          </Text>
        </View>
      </View>

      {/* Attendance Quick Access (Only for eligible roles) */}
      {isAttendanceEligible && (
        <View style={employeeStyles.card}>
          <View style={styles.cardHeader}>
            <Text style={employeeStyles.label}>Today&apos;s Attendance</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/attendance' as any)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Open Attendance ↗</Text>
            </Pressable>
          </View>
          <Text style={employeeStyles.body}>
            Record your daily check-in and check-out with live camera photo verification.
          </Text>
        </View>
      )}

      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Quick Access</Text>
        <View style={styles.quickLinks}>
          <Pressable
            onPress={() => router.push('/profile')}
            style={styles.quickLink}
          >
            <Text style={styles.quickLinkText}>Profile</Text>
          </Pressable>
          {isAttendanceEligible && (
            <Pressable
              onPress={() => router.push('/attendance' as any)}
              style={styles.quickLink}
            >
              <Text style={styles.quickLinkText}>Attendance</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/talent')}
            style={styles.quickLink}
          >
            <Text style={styles.quickLinkText}>Talent ID</Text>
          </Pressable>
        </View>
      </View>

      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Professional Identity</Text>
        <Text style={employeeStyles.muted}>
          Maintain your verified talent portfolio, skills, experience, and
          credentials on the Talent tab.
        </Text>
      </View>
    </EmployeeScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: '800' },
  welcome: { color: colors.muted, ...typography.body },
  name: { color: colors.ink, fontSize: 23, fontWeight: '800' },
  detail: { color: colors.muted, fontSize: 14, marginTop: 2 },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    paddingVertical: 2,
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quickLink: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickLinkText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
});
