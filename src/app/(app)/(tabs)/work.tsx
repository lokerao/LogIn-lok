import { EmployeeScreen, EmptyModule } from "@/components/employee-screen";
import { AssignmentDetailModal } from "@/components/work/assignment-detail-modal";
import { HROrganizationWork } from "@/components/work/hr-organization-work";
import { ManagerTeamWork } from "@/components/work/manager-team-work";
import { WorkAssignmentCard } from "@/components/work/work-assignment-card";
import { colors, radius, spacing } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { fetchMyAssignments } from "@/features/work/work-service";
import type { WorkAssignment, WorkSegment } from "@/types/work";
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

export default function WorkScreen() {
  const { identity } = useAuth();
  const roles = identity?.roles ?? [];

  const isEmployee = roles.includes("employee");
  const isManager = roles.includes("manager");
  const isHR = roles.includes("hr");
  const isAdminOrRecruiterOnly =
    roles.length > 0 && roles.every((r) => r === "admin" || r === "recruiter");

  // Top navigation view mode: 'my_work' | 'team_work' | 'hr_work'
  const [viewMode, setViewMode] = useState<"my_work" | "team_work" | "hr_work">(
    "my_work",
  );

  // Employee Segment: 'today' | 'upcoming' | 'history'
  const [segment, setSegment] = useState<WorkSegment>("today");
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  const loadAssignments = useCallback(async () => {
    if (!isEmployee) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchMyAssignments(segment);
      setAssignments(data);
    } catch {
      // Handled cleanly
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isEmployee, segment]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAssignments();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAssignments]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadAssignments();
  };

  // 1. Role-based Access Restriction for Admin & Recruiter
  if (isAdminOrRecruiterOnly) {
    return (
      <EmployeeScreen title="Work">
        <EmptyModule
          message="Daily work assignments and progress tracking are not available for your role."
          title="Access Restricted"
        />
      </EmployeeScreen>
    );
  }

  return (
    <EmployeeScreen title="My Work">
      {/* Top role mode switcher if Manager or HR */}
      {(isManager || isHR) && (
        <View style={styles.modeSwitcher}>
          <Pressable
            onPress={() => setViewMode("my_work")}
            style={[
              styles.modeTab,
              viewMode === "my_work" && styles.modeTabActive,
            ]}
          >
            <Text
              style={[
                styles.modeTabText,
                viewMode === "my_work" && styles.modeTabTextActive,
              ]}
            >
              My Work
            </Text>
          </Pressable>

          {isManager && (
            <Pressable
              onPress={() => setViewMode("team_work")}
              style={[
                styles.modeTab,
                viewMode === "team_work" && styles.modeTabActive,
              ]}
            >
              <Text
                style={[
                  styles.modeTabText,
                  viewMode === "team_work" && styles.modeTabTextActive,
                ]}
              >
                Team Work
              </Text>
            </Pressable>
          )}

          {isHR && (
            <Pressable
              onPress={() => setViewMode("hr_work")}
              style={[
                styles.modeTab,
                viewMode === "hr_work" && styles.modeTabActive,
              ]}
            >
              <Text
                style={[
                  styles.modeTabText,
                  viewMode === "hr_work" && styles.modeTabTextActive,
                ]}
              >
                Organization
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Render selected view mode */}
      {viewMode === "team_work" && isManager ? (
        <ManagerTeamWork />
      ) : viewMode === "hr_work" && isHR ? (
        <HROrganizationWork />
      ) : (
        <View style={styles.myWorkContainer}>
          {/* Segment Selector: Today, Upcoming, History */}
          <View style={styles.segmentRow}>
            {(
              [
                { key: "today", label: "Today's Work" },
                { key: "upcoming", label: "Upcoming" },
                { key: "history", label: "History" },
              ] as const
            ).map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setSegment(s.key)}
                style={[
                  styles.segmentChip,
                  segment === s.key && styles.segmentChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    segment === s.key && styles.segmentTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Assignments list */}
          {loading && !refreshing ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>
                Loading your assignments...
              </Text>
            </View>
          ) : assignments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {segment === "today"
                  ? "No assignments for today"
                  : segment === "upcoming"
                    ? "No upcoming assignments"
                    : "No past assignments found"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {segment === "today"
                  ? "You're all caught up! When tasks are assigned by your manager, they will appear here."
                  : "Check back later for newly scheduled daily tasks."}
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
                />
              ))}
            </ScrollView>
          )}

          {/* Assignment Detail & Update Modal */}
          <AssignmentDetailModal
            assignmentId={selectedAssignmentId}
            isEmployee={isEmployee}
            isManager={isManager}
            onClose={() => setSelectedAssignmentId(null)}
            onUpdated={() => void loadAssignments()}
            visible={Boolean(selectedAssignmentId)}
          />
        </View>
      )}
    </EmployeeScreen>
  );
}

const styles = StyleSheet.create({
  modeSwitcher: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.xs,
    padding: 4,
  },
  modeTab: {
    borderRadius: radius.sm,
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeTabText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  modeTabTextActive: {
    color: colors.white,
  },
  myWorkContainer: {
    flex: 1,
    gap: spacing.md,
  },
  segmentRow: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    flexDirection: "row",
    padding: 4,
  },
  segmentChip: {
    alignItems: "center",
    borderRadius: radius.pill,
    flex: 1,
    paddingVertical: 8,
  },
  segmentChipActive: {
    backgroundColor: colors.canvas,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.ink,
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
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
});
