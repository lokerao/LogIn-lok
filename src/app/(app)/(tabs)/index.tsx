import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import {
    EmployeeScreen,
    EmptyModule,
    employeeStyles,
} from "@/components/employee-screen";
import { TalentViewerDashboard } from "@/components/talent-network/talent-viewer-dashboard";
import { colors, radius, spacing, typography } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { useEmployee } from "@/features/employee/employee-provider";
import { fetchMyAssignments } from "@/features/work/work-service";
import { isTalentViewer } from "@/types/roles";
import type { WorkAssignment } from "@/types/work";

export default function EmployeeHome() {
  const router = useRouter();
  const { identity, session, isReady } = useAuth();
  const { employee, error, isLoading } = useEmployee();
  const [todayTasks, setTodayTasks] = useState<WorkAssignment[]>([]);

  const roles = useMemo(() => identity?.roles ?? [], [identity?.roles]);
  const isViewer = isTalentViewer(roles);
  const isAuthLoading = !isReady || Boolean(session && !identity);
  const isAdmin = roles.includes("admin");
  const isAttendanceEligible =
    !isAdmin &&
    !isViewer &&
    roles.some((r) => ["employee", "manager", "hr"].includes(r));
  const isWorkEligible =
    !isViewer && roles.some((r) => ["employee", "manager", "hr"].includes(r));
  const isManager = roles.includes("manager");
  const isHR = roles.includes("hr");

  useEffect(() => {
    if (isWorkEligible && roles.includes("employee")) {
      const timer = setTimeout(() => {
        void fetchMyAssignments("today")
          .then((tasks) => setTodayTasks(tasks.slice(0, 3)))
          .catch(() => {});
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isWorkEligible, roles]);

  if (isAuthLoading) {
    return (
      <EmployeeScreen title="Home">
        <ActivityIndicator color={colors.primary} />
      </EmployeeScreen>
    );
  }

  if (isViewer) {
    return <TalentViewerDashboard />;
  }

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
          message={error ?? "Your employee profile is not available yet."}
          title="Profile unavailable"
        />
      </EmployeeScreen>
    );
  }

  const canonicalName = `${employee.firstName} ${employee.lastName}`.trim();
  const name = canonicalName || employee.displayName || "Employee";

  return (
    <EmployeeScreen title="Home">
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.detail}>
            {employee.designation ?? "Employee"} · {employee.employeeCode}
          </Text>
        </View>
      </View>

      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Quick Access</Text>
        <View style={styles.quickLinks}>
          <Pressable
            onPress={() => router.push("/profile")}
            style={styles.quickLink}
          >
            <Text style={styles.quickLinkText}>Profile</Text>
          </Pressable>
          {isAdmin && (
            <>
              <Pressable
                onPress={() => router.push("/admin" as any)}
                style={styles.quickLink}
              >
                <Text style={styles.quickLinkText}>Admin</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/leave" as any)}
                style={styles.quickLink}
              >
                <Text style={styles.quickLinkText}>HR Leave</Text>
              </Pressable>
            </>
          )}
          {isManager && (
            <Pressable
              onPress={() => router.push("/team" as any)}
              style={styles.quickLink}
            >
              <Text style={styles.quickLinkText}>My Team</Text>
            </Pressable>
          )}
          {isWorkEligible && (
            <Pressable
              onPress={() => router.push("/(app)/(tabs)/work" as any)}
              style={styles.quickLink}
            >
              <Text style={styles.quickLinkText}>My Work</Text>
            </Pressable>
          )}
          {isAttendanceEligible && (
            <Pressable
              onPress={() => router.push("/attendance" as any)}
              style={styles.quickLink}
            >
              <Text style={styles.quickLinkText}>Attendance</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push("/talent")}
            style={styles.quickLink}
          >
            <Text style={styles.quickLinkText}>Talent ID</Text>
          </Pressable>
        </View>
      </View>

      {/* Today's Work Quick Access (Only for eligible roles) */}
      {isWorkEligible && (
        <View style={employeeStyles.card}>
          <View style={styles.cardHeader}>
            <Text style={employeeStyles.label}>Today&apos;s Work</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(app)/(tabs)/work" as any)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>View All Work ↗</Text>
            </Pressable>
          </View>
          {todayTasks.length === 0 ? (
            <Text style={employeeStyles.muted}>
              No daily assignments scheduled for today yet.
            </Text>
          ) : (
            <View style={styles.taskList}>
              {todayTasks.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push("/(app)/(tabs)/work" as any)}
                  style={styles.taskItem}
                >
                  <View style={styles.taskTitleRow}>
                    <Text numberOfLines={1} style={styles.taskTitle}>
                      {t.title}
                    </Text>
                    <Text style={styles.taskProgress}>
                      {t.progress_percent}%
                    </Text>
                  </View>
                  <Text style={styles.taskMeta}>
                    {t.status === "completed"
                      ? "Completed"
                      : t.status === "in_progress"
                        ? "In Progress"
                        : t.status === "blocked"
                          ? "Blocked"
                          : "Assigned"}
                    {t.due_time ? ` · Due ${t.due_time.slice(0, 5)}` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Attendance Quick Access (Only for eligible roles) */}
      {isAttendanceEligible && (
        <View style={employeeStyles.card}>
          <View style={styles.cardHeader}>
            <Text style={employeeStyles.label}>Today&apos;s Attendance</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/attendance" as any)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Open Attendance ↗</Text>
            </Pressable>
          </View>
          <Text style={employeeStyles.body}>
            Record your daily check-in and check-out with live camera photo
            verification.
          </Text>
        </View>
      )}

      {/* My Team Quick Access (Only for Managers) */}
      {isManager && (
        <View style={employeeStyles.card}>
          <View style={styles.cardHeader}>
            <Text style={employeeStyles.label}>My Team</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/team" as any)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Open Team Hub ↗</Text>
            </Pressable>
          </View>
          <Text style={employeeStyles.body}>
            Monitor your direct reports, today&apos;s shift attendance, leave
            requests, and task assignments.
          </Text>
        </View>
      )}

      {/* HR Operational Hub Quick Access (Only for HR) */}
      {isHR && (
        <View style={employeeStyles.card}>
          <View style={styles.cardHeader}>
            <Text style={employeeStyles.label}>HR & Organization Hub</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/hr" as any)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Open HR Hub ↗</Text>
            </Pressable>
          </View>
          <Text style={employeeStyles.body}>
            Organization directory, headcount metrics, employee lifecycle
            status, attendance audits, and talent reviews.
          </Text>
        </View>
      )}

      {/* Admin Operational Hub Quick Access (Only for Admin) */}
      {isAdmin && (
        <View style={employeeStyles.card}>
          <View style={styles.cardHeader}>
            <Text style={employeeStyles.label}>Admin & Organization Hub</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/admin" as any)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Open Admin Hub ↗</Text>
            </Pressable>
          </View>
          <Text style={employeeStyles.body}>
            System administration, organization structure, departments, teams,
            locations, and user roles.
          </Text>
        </View>
      )}

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
  hero: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: "800" },
  welcome: { color: colors.muted, ...typography.body },
  name: { color: colors.ink, fontSize: 23, fontWeight: "800" },
  detail: { color: colors.muted, fontSize: 14, marginTop: 2 },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionBtn: {
    paddingVertical: 2,
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  quickLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    fontWeight: "600",
  },
  taskList: {
    gap: spacing.xs,
    marginTop: 4,
  },
  taskItem: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    gap: 2,
  },
  taskTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taskTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    marginRight: spacing.sm,
  },
  taskProgress: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  taskMeta: {
    color: colors.muted,
    fontSize: 12,
  },
});
