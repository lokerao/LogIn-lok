import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { EmptyModule } from '@/components/employee-screen';
import { AttendanceHistorySection } from '@/components/attendance/attendance-history-section';
import { CameraCaptureModal } from '@/components/attendance/camera-capture-modal';
import { EmployeeAttendanceCard } from '@/components/attendance/employee-attendance-card';
import { HRAttendanceReview } from '@/components/attendance/hr-attendance-review';
import { colors, spacing } from '@/constants/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import {
  fetchActiveOrTodayAttendance,
  fetchAttendanceHistory,
  fetchHRAttendanceRecords,
  fetchManagerAttendanceRecords,
  submitCheckIn,
  submitCheckOut,
} from '@/features/attendance/attendance-service';
import { getSupabase } from '@/lib/supabase';
import type { AttendanceRecord } from '@/types/attendance';

export default function AttendanceScreen() {
  const router = useRouter();
  const { identity, session } = useAuth();

  const [activeTab, setActiveTab] = useState<'my_attendance' | 'hr_queue' | 'team_attendance'>('my_attendance');

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [hrRecords, setHrRecords] = useState<AttendanceRecord[]>([]);
  const [managerRecords, setManagerRecords] = useState<AttendanceRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera modal state
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<'check_in' | 'check_out'>('check_in');

  const isHR = identity?.roles.includes('hr');
  const isManager = identity?.roles.includes('manager');
  const isAdmin = identity?.roles.includes('admin') && !identity?.roles.includes('employee') && !identity?.roles.includes('hr') && !identity?.roles.includes('manager');
  const isRecruiter = identity?.roles.includes('recruiter') && !identity?.roles.includes('employee') && !identity?.roles.includes('hr') && !identity?.roles.includes('manager');

  // Check role restrictions
  const isBlockedRole = isAdmin || isRecruiter;

  const loadData = useCallback(async (isRefresh = false) => {
    if (!session || isBlockedRole) {
      setIsLoading(false);
      return;
    }

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // 1. Fetch authenticated employee id
      const { data: empData, error: empErr } = await getSupabase()
        .from('employees')
        .select('id')
        .eq('profile_id', session.user.id)
        .maybeSingle();

      if (empErr) throw empErr;

      if (!empData && !isHR) {
        setError('Employee record not found for this account.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const empId = empData?.id ?? null;
      setEmployeeId(empId);

      // 2. Fetch employee's own attendance if employee record exists
      if (empId) {
        const [todayRes, historyRes] = await Promise.all([
          fetchActiveOrTodayAttendance(empId),
          fetchAttendanceHistory(empId),
        ]);
        setTodayAttendance(todayRes);
        setHistory(historyRes);
      }

      // 3. If HR role, fetch HR verification queue
      if (isHR) {
        const hrQueue = await fetchHRAttendanceRecords(50);
        setHrRecords(hrQueue);
      }

      // 4. If Manager role, fetch team attendance
      if (isManager) {
        const mgrQueue = await fetchManagerAttendanceRecords(50);
        setManagerRecords(mgrQueue);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Could not load attendance data. Please try again.';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session, isBlockedRole, isHR, isManager]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  function handleStartCheckIn() {
    setCameraMode('check_in');
    setCameraModalVisible(true);
  }

  function handleStartCheckOut() {
    setCameraMode('check_out');
    setCameraModalVisible(true);
  }

  async function handleCameraProceed(photoUri: string) {
    if (!employeeId) {
      Alert.alert('Error', 'Employee record not found.');
      return;
    }

    try {
      if (cameraMode === 'check_in') {
        await submitCheckIn(employeeId, photoUri);
        Alert.alert(
          'Checked In Successfully',
          'Your working time has begun immediately. Attendance photo sent for HR verification.',
        );
      } else {
        if (!todayAttendance?.id) {
          Alert.alert('Error', 'Active check-in session not found.');
          return;
        }
        await submitCheckOut(employeeId, todayAttendance.id, photoUri);
        Alert.alert(
          'Checked Out Successfully',
          'Your shift has been completed. Attendance photo sent for HR verification.',
        );
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Attendance submission failed.';
      Alert.alert('Submission Error', msg);
      throw err;
    }
  }

  if (isBlockedRole) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.screenTitle}>Attendance</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyModule
            message="Attendance tracking is not applicable for your assigned system role."
            title="Attendance Access Restricted"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Attendance</Text>
      </View>

      {/* Role Navigation Tabs (if HR or Manager) */}
      {(isHR || isManager) && (
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab('my_attendance')}
            style={[styles.tabItem, activeTab === 'my_attendance' && styles.tabItemActive]}
          >
            <Text
              style={[styles.tabItemText, activeTab === 'my_attendance' && styles.tabItemTextActive]}
            >
              My Attendance
            </Text>
          </Pressable>

          {isHR && (
            <Pressable
              onPress={() => setActiveTab('hr_queue')}
              style={[styles.tabItem, activeTab === 'hr_queue' && styles.tabItemActive]}
            >
              <Text
                style={[styles.tabItemText, activeTab === 'hr_queue' && styles.tabItemTextActive]}
              >
                HR Review {hrRecords.length > 0 && `(${hrRecords.filter(r => r.check_in_verification_status === 'pending' || r.check_out_verification_status === 'pending').length})`}
              </Text>
            </Pressable>
          )}

          {isManager && (
            <Pressable
              onPress={() => setActiveTab('team_attendance')}
              style={[styles.tabItem, activeTab === 'team_attendance' && styles.tabItemActive]}
            >
              <Text
                style={[styles.tabItemText, activeTab === 'team_attendance' && styles.tabItemTextActive]}
              >
                Team Attendance
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void loadData(true)}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        {error ? (
          <EmptyModule message={error} title="Attendance Error" />
        ) : activeTab === 'my_attendance' ? (
          <>
            {/* 1. Today's Attendance Check-In / Check-Out Card */}
            <EmployeeAttendanceCard
              attendance={todayAttendance}
              onCheckInPress={handleStartCheckIn}
              onCheckOutPress={handleStartCheckOut}
            />

            {/* 2. Attendance History List */}
            <AttendanceHistorySection history={history} />
          </>
        ) : activeTab === 'hr_queue' && isHR ? (
          /* HR Verification Queue */
          <HRAttendanceReview
            onUpdated={() => void loadData()}
            records={hrRecords}
          />
        ) : activeTab === 'team_attendance' && isManager ? (
          /* Manager Team Attendance View */
          <AttendanceHistorySection history={managerRecords} />
        ) : null}
      </ScrollView>

      {/* Live Camera & Photo Preview Modal */}
      <CameraCaptureModal
        mode={cameraMode}
        onClose={() => setCameraModalVisible(false)}
        onProceed={handleCameraProceed}
        visible={cameraModalVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomColor: '#EEF1F6',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  screenTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
  tabBar: {
    backgroundColor: colors.white,
    borderBottomColor: '#EEF1F6',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  tabItem: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabItemText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  tabItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
