import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import type { AdminEmployeeListItem } from "@/types/admin";

interface AdminEmployeeCardProps {
  employee: AdminEmployeeListItem;
  onPress: () => void;
}

export function AdminEmployeeCard({
  employee,
  onPress,
}: AdminEmployeeCardProps) {
  const fullName =
    `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
    "Employee";
  const initials =
    `${employee.first_name?.[0] ?? ""}${employee.last_name?.[0] ?? ""}`.toUpperCase() ||
    fullName[0]?.toUpperCase() ||
    "E";

  const isPermActive = employee.employment_status === "active";
  const isPermTerminated = employee.employment_status === "terminated";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.code}>
            {employee.employee_code} · {employee.work_email}
          </Text>
          <Text style={styles.designation}>
            {employee.designation_name ?? "No Designation"}
            {employee.department_name ? ` · ${employee.department_name}` : ""}
          </Text>
          {employee.team_name ? (
            <Text style={styles.meta}>Team: {employee.team_name}</Text>
          ) : null}
          {employee.location_name ? (
            <Text style={styles.meta}>
              Location: {employee.location_name}
              {employee.location_city ? ` (${employee.location_city})` : ""}
            </Text>
          ) : null}
          {employee.manager_name ? (
            <Text style={styles.meta}>Reports to: {employee.manager_name}</Text>
          ) : null}
        </View>

        <View style={styles.badgeCol}>
          <View
            style={[
              styles.statusBadge,
              isPermActive
                ? styles.badgeActive
                : isPermTerminated
                  ? styles.badgeTerminated
                  : styles.badgeInactive,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isPermActive
                  ? styles.textActive
                  : isPermTerminated
                    ? styles.textTerminated
                    : styles.textInactive,
              ]}
            >
              {employee.employment_status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Role badges & action trigger */}
      <View style={styles.bottomRow}>
        <View style={styles.rolesRow}>
          {employee.roles.map((role) => (
            <View
              key={role}
              style={[
                styles.roleBadge,
                role === "admin"
                  ? styles.roleAdmin
                  : role === "hr"
                    ? styles.roleHR
                    : role === "manager"
                      ? styles.roleManager
                      : role === "recruiter"
                        ? styles.roleRecruiter
                        : styles.roleEmployee,
              ]}
            >
              <Text
                style={[
                  styles.roleBadgeText,
                  role === "admin"
                    ? styles.roleAdminText
                    : role === "hr"
                      ? styles.roleHRText
                      : role === "manager"
                        ? styles.roleManagerText
                        : role === "recruiter"
                          ? styles.roleRecruiterText
                          : styles.roleEmployeeText,
                ]}
              >
                {role.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>Configure Structure ›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardPressed: {
    backgroundColor: "#F8FAFC",
  },
  topRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  code: {
    color: colors.muted,
    fontSize: 12,
  },
  designation: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  meta: {
    color: colors.muted,
    fontSize: 11,
  },
  badgeCol: {
    alignItems: "flex-end",
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeActive: {
    backgroundColor: "#DCFCE7",
  },
  badgeInactive: {
    backgroundColor: "#F1F5F9",
  },
  badgeTerminated: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  textActive: {
    color: "#166534",
  },
  textInactive: {
    color: "#475569",
  },
  textTerminated: {
    color: "#991B1B",
  },
  bottomRow: {
    alignItems: "center",
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
  },
  rolesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleAdmin: { backgroundColor: "#F5F3FF" },
  roleHR: { backgroundColor: "#EFF6FF" },
  roleManager: { backgroundColor: "#ECFDF5" },
  roleEmployee: { backgroundColor: "#F8FAFC" },
  roleRecruiter: { backgroundColor: "#FFFBEB" },
  roleBadgeText: { fontSize: 9, fontWeight: "800" },
  roleAdminText: { color: "#6D28D9" },
  roleHRText: { color: "#1D4ED8" },
  roleManagerText: { color: "#047857" },
  roleEmployeeText: { color: "#475569" },
  roleRecruiterText: { color: "#B45309" },
  actionBtn: {
    alignItems: "center",
    flexDirection: "row",
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
});
