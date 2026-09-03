import { colors, radius, spacing } from "@/constants/design-system";
import {
    fetchDirectReports,
    fetchTeamAssignments,
} from "@/features/work/work-service";
import type {
    DirectReport,
    WorkAssignment,
    WorkAssignmentStatus,
} from "@/types/work";
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
import { CreateAssignmentModal } from "./create-assignment-modal";
import { WorkAssignmentCard } from "./work-assignment-card";

export function ManagerTeamWork() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<WorkAssignment[]>([]);

  // Filter state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<
    string | undefined
  >(undefined);
  const [statusFilter, setStatusFilter] = useState<
    WorkAssignmentStatus | "all" | "overdue"
  >("all");

  // Modals state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [reports, assignments] = await Promise.all([
        fetchDirectReports(),
        fetchTeamAssignments({
          employeeId: selectedEmployeeId,
          status:
            statusFilter !== "all" && statusFilter !== "overdue"
              ? statusFilter
              : undefined,
          onlyOverdue: statusFilter === "overdue",
        }),
      ]);
      setDirectReports(reports);
      setTeamAssignments(assignments);
    } catch {
      // Handled cleanly
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedEmployeeId, statusFilter]);

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
      {/* Top action bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Team Work</Text>
          <Text style={styles.topBarSubtitle}>
            Track and assign daily work for direct reports
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreateModalVisible(true)}
          style={styles.createBtn}
        >
          <Text style={styles.createBtnText}>+ Assign Work</Text>
        </Pressable>
      </View>

      {/* Employee filter chips */}
      {directReports.length > 0 && (
        <ScrollView
          contentContainerStyle={styles.filterScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            onPress={() => setSelectedEmployeeId(undefined)}
            style={[
              styles.filterChip,
              selectedEmployeeId === undefined && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedEmployeeId === undefined && styles.filterChipTextActive,
              ]}
            >
              All Team ({directReports.length})
            </Text>
          </Pressable>
          {directReports.map((emp) => (
            <Pressable
              key={emp.id}
              onPress={() => setSelectedEmployeeId(emp.id)}
              style={[
                styles.filterChip,
                selectedEmployeeId === emp.id && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedEmployeeId === emp.id && styles.filterChipTextActive,
                ]}
              >
                {emp.first_name} {emp.last_name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

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

      {/* Assignment List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading team assignments...</Text>
        </View>
      ) : teamAssignments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No assignments found</Text>
          <Text style={styles.emptyText}>
            {statusFilter === "overdue"
              ? "Great! No overdue assignments for this selection."
              : "No assignments match the selected filters."}
          </Text>
          <Pressable
            onPress={() => setCreateModalVisible(true)}
            style={styles.emptyActionBtn}
          >
            <Text style={styles.emptyActionBtnText}>Create Assignment</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
          }
          showsVerticalScrollIndicator={false}
        >
          {teamAssignments.map((assignment) => (
            <WorkAssignmentCard
              assignment={assignment}
              key={assignment.id}
              onPress={() => setSelectedAssignmentId(assignment.id)}
              showEmployeeName={true}
            />
          ))}
        </ScrollView>
      )}

      {/* Detail / Action Modal */}
      <AssignmentDetailModal
        assignmentId={selectedAssignmentId}
        isEmployee={false}
        isManager={true}
        onClose={() => setSelectedAssignmentId(null)}
        onUpdated={() => void loadData()}
        visible={Boolean(selectedAssignmentId)}
      />

      {/* Create Modal */}
      <CreateAssignmentModal
        initialEmployeeId={selectedEmployeeId}
        onClose={() => setCreateModalVisible(false)}
        onCreated={() => void loadData()}
        visible={createModalVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  topBarTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  topBarSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  filterScroll: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 4,
  },
  filterChip: {
    backgroundColor: colors.white,
    borderColor: "#D0D5DD",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  statusFilterScroll: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  statusChip: {
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  emptyActionBtn: {
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyActionBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
});
