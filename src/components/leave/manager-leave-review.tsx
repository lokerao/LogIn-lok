import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { employeeStyles } from "@/components/employee-screen";
import { LeaveRequestCard } from "@/components/leave/leave-request-card";
import { LeaveReviewModal } from "@/components/leave/leave-review-modal";
import { colors, radius, spacing } from "@/constants/design-system";
import { fetchManagerLeaveRequests } from "@/features/leave/leave-service";
import type { LeaveRequest } from "@/types/leave";

type Filter = "pending" | "all";

export function ManagerLeaveReview() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagerLeaveRequests(
        filter === "pending" ? "pending" : undefined,
      );
      setRequests(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load leave requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  function handleReviewed() {
    setSelectedRequest(null);
    void load();
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "all", label: "All" },
  ];

  return (
    <>
      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Team Leave Requests</Text>

        <View style={styles.tabs}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setFilter(t.key)}
              style={[styles.tab, filter === t.key && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  filter === t.key && styles.tabTextActive,
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing.sm }}
          />
        )}

        {Boolean(error) && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && requests.length === 0 && (
          <Text style={employeeStyles.muted}>
            {filter === "pending"
              ? "No pending requests from your team."
              : "No leave requests found."}
          </Text>
        )}
      </View>

      {requests.map((req) => (
        <Pressable key={req.id} onPress={() => setSelectedRequest(req)}>
          <LeaveRequestCard request={req} showEmployee />
        </Pressable>
      ))}

      <LeaveReviewModal
        request={selectedRequest}
        visible={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        onReviewed={handleReviewed}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: colors.white },
  errorBox: { gap: spacing.xs },
  errorText: { color: "#B42318", fontSize: 14 },
  retryText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
