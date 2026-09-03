import { colors, radius, spacing } from "@/constants/design-system";
import { fetchHROrganizationWork } from "@/features/work/work-service";
import type { WorkAssignment, WorkAssignmentStatus } from "@/types/work";
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
import { AssignmentDetailModal } from "./assignment-detail-modal";
import { WorkAssignmentCard } from "./work-assignment-card";

export function HROrganizationWork() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    WorkAssignmentStatus | "all" | "overdue"
  >("all");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchHROrganizationWork({
        status:
          statusFilter !== "all" && statusFilter !== "overdue"
            ? statusFilter
            : undefined,
        onlyOverdue: statusFilter === "overdue",
      });
      setAssignments(data);
    } catch {
      // Handled cleanly
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Organization Work Monitoring</Text>
        <Text style={styles.subtitle}>
          Track daily work assignments across your organization
        </Text>
      </View>

      {/* Status filter chips */}
      <ScrollView
        contentContainerStyle={styles.statusFilterScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {(
          [
            { key: "all", label: "All Tasks" },
            { key: "overdue", label: "⚠️ Overdue" },
            { key: "assigned", label: "Assigned" },
            { key: "in_progress", label: "In Progress" },
            { key: "blocked", label: "Blocked" },
            { key: "completed", label: "Completed" },
          ] as const
        ).map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setStatusFilter(f.key)}
            style={[
              styles.statusChip,
              statusFilter === f.key && styles.statusChipActive,
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                statusFilter === f.key && styles.statusChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading organization work...</Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No assignments found</Text>
          <Text style={styles.emptyText}>
            No work assignments found matching the current filter.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
          }
          showsVerticalScrollIndicator={false}
        >
          {assignments.map((assignment) => (
            <WorkAssignmentCard
              assignment={assignment}
              key={assignment.id}
              onPress={() => setSelectedAssignmentId(assignment.id)}
              showEmployeeName={true}
            />
          ))}
        </ScrollView>
      )}

      {/* Assignment detail modal (read-only for HR) */}
      <AssignmentDetailModal
        assignmentId={selectedAssignmentId}
        isEmployee={false}
        isManager={false}
        onClose={() => setSelectedAssignmentId(null)}
        onUpdated={() => void loadData()}
        visible={Boolean(selectedAssignmentId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
  },
  header: {
    gap: 2,
    paddingBottom: 4,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  statusFilterScroll: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  statusChip: {
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusChipActive: {
    backgroundColor: "#EFF8FF",
    borderColor: colors.primary,
    borderWidth: 1,
  },
  statusChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  statusChipTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  centerContainer: {
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
});
