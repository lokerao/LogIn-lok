import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyModule, employeeStyles } from "@/components/employee-screen";
import { ApplyLeaveModal } from "@/components/leave/apply-leave-modal";
import { HRLeaveReview } from "@/components/leave/hr-leave-review";
import { LeaveBalanceCard } from "@/components/leave/leave-balance-card";
import { LeaveRequestCard } from "@/components/leave/leave-request-card";
import { ManagerLeaveReview } from "@/components/leave/manager-leave-review";
import { colors, radius, spacing, typography } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { useEmployee } from "@/features/employee/employee-provider";
import {
    fetchMyLeaveBalances,
    fetchMyLeaveRequests,
} from "@/features/leave/leave-service";
import type { LeaveBalance, LeaveRequest } from "@/types/leave";

export default function LeaveScreen() {
  const router = useRouter();
  const { identity } = useAuth();
  const { isLoading: employeeLoading } = useEmployee();

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyVisible, setApplyVisible] = useState(false);

  const roles = identity?.roles ?? [];
  const isEmployee = roles.includes("employee");
  const isManager = roles.includes("manager");
  const isHR = roles.includes("hr");
  const isLeaveEligible = isEmployee || isManager || isHR;

  const loadEmployeeData = useCallback(
    async (isRefresh = false) => {
      if (!isLeaveEligible) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [bal, reqs] = await Promise.all([
          fetchMyLeaveBalances(),
          fetchMyLeaveRequests(20),
        ]);
        setBalances(bal);
        setRequests(reqs);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load leave data. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLeaveEligible],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadEmployeeData(), 0);
    return () => clearTimeout(timer);
  }, [loadEmployeeData]);

  function handleApplySubmitted() {
    setApplyVisible(false);
    void loadEmployeeData();
  }

  // Recruiter / unauthorized roles: block access entirely
  if (!isLeaveEligible) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Leave</Text>
          <EmptyModule
            title="Access Restricted"
            message="Leave management is not available for your role."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (employeeLoading || loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Leave</Text>
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing.xl }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && !isHR && !isManager) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Leave</Text>
          <EmptyModule title="Failed to Load" message={error} />
          <Pressable
            onPress={() => void loadEmployeeData()}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void loadEmployeeData(true)}
            refreshing={refreshing}
          />
        }
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Leave</Text>

        {/* ── EMPLOYEE SECTION ── */}
        {isEmployee && (
          <>
            {/* Balances */}
            <LeaveBalanceCard balances={balances} />

            {/* Apply Button */}
            <Pressable
              accessibilityRole="button"
              onPress={() => setApplyVisible(true)}
              style={({ pressed }) => [
                styles.applyBtn,
                pressed && styles.applyBtnPressed,
              ]}
            >
              <Text style={styles.applyText}>Apply for Leave</Text>
            </Pressable>

            {/* History */}
            <View style={employeeStyles.card}>
              <Text style={employeeStyles.label}>My Requests</Text>
              {requests.length === 0 && (
                <Text style={employeeStyles.muted}>
                  You have not submitted any leave requests yet.
                </Text>
              )}
            </View>

            {requests.map((req) => (
              <LeaveRequestCard
                key={req.id}
                request={req}
                onCancelled={() => void loadEmployeeData()}
              />
            ))}
          </>
        )}

        {/* ── MANAGER SECTION ── */}
        {isManager && <ManagerLeaveReview />}

        {/* ── HR SECTION ── */}
        {isHR && <HRLeaveReview />}
      </ScrollView>

      {/* Apply Leave Modal */}
      <ApplyLeaveModal
        visible={applyVisible}
        onClose={() => setApplyVisible(false)}
        onSubmitted={handleApplySubmitted}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: { paddingVertical: spacing.xs },
  backText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
  title: { color: colors.ink, ...typography.title },
  applyBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  applyBtnPressed: { backgroundColor: colors.primaryPressed },
  applyText: { color: colors.white, ...typography.button },
  retryBtn: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  retryText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
});
