import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import { fetchHREmployeeDetails } from "@/features/hr/hr-service";
import type { HREmployeeFullDetails } from "@/types/hr";
import { HRStatusModal } from "./hr-status-modal";

interface HREmployeeDetailsModalProps {
  visible: boolean;
  employeeId: string | null;
  onClose: () => void;
  onStatusChanged: () => void;
}

type DetailTab = "organization" | "attendance" | "leave" | "work" | "talent";

export function HREmployeeDetailsModal({
  visible,
  employeeId,
  onClose,
  onStatusChanged,
}: HREmployeeDetailsModalProps) {
  const [details, setDetails] = useState<HREmployeeFullDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("organization");
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHREmployeeDetails(employeeId);
      setDetails(data);
    } catch (err: any) {
      setError(err.message || "Could not load employee details.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (visible && employeeId) {
      const timer = setTimeout(() => void loadDetails(), 0);
      return () => clearTimeout(timer);
    }
  }, [visible, employeeId, loadDetails]);

  if (!visible) return null;

  const emp = details?.employee;
  const fullName = emp
    ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() ||
      emp.display_name ||
      "Employee"
    : "";
  const initials = fullName
    ? `${emp?.first_name?.[0] ?? ""}${emp?.last_name?.[0] ?? ""}`.toUpperCase() ||
      fullName[0]?.toUpperCase() ||
      "E"
    : "";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || "E"}</Text>
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.empName}>
                  {fullName || "Employee Details"}
                </Text>
                <Text style={styles.empCode}>{emp?.employee_code}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Quick Lifecycle Action Bar */}
          {emp && (
            <View style={styles.lifecycleBar}>
              <View style={styles.statusGroup}>
                <View style={styles.statusRowHeader}>
                  <Text style={styles.statusMetaLabel}>Employment: </Text>
                  <View
                    style={[
                      styles.statusPill,
                      emp.employment_status === "active"
                        ? styles.pillActive
                        : emp.employment_status === "terminated"
                          ? styles.pillTerminated
                          : styles.pillInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        emp.employment_status === "active"
                          ? styles.pillTextActive
                          : emp.employment_status === "terminated"
                            ? styles.pillTextTerminated
                            : styles.pillTextInactive,
                      ]}
                    >
                      {emp.employment_status.toUpperCase()}
                    </Text>
                  </View>
                  {emp.working_on_leave ? (
                    <View style={styles.workingOnLeaveBadge}>
                      <Text style={styles.workingOnLeaveBadgeText}>
                        ⚡ Working on Leave
                      </Text>
                    </View>
                  ) : emp.has_approved_leave_today ? (
                    <View style={styles.onLeaveBadge}>
                      <Text style={styles.onLeaveBadgeText}>🏖 On Leave</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.permStatusSubText}>
                  Today&apos;s Attendance:{" "}
                  {emp.employment_status !== "active"
                    ? "Check-in Blocked"
                    : emp.today_attendance_status === "checked_in"
                      ? `CHECKED IN / WORKING${emp.today_check_in_time ? ` (${emp.today_check_in_time})` : ""}`
                      : emp.today_attendance_status === "checked_out"
                        ? `CHECKED OUT${emp.today_check_out_time ? ` (${emp.today_check_out_time})` : ""}`
                        : "NOT CHECKED IN"}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => setStatusModalVisible(true)}
                style={styles.changeStatusBtn}
              >
                <Text style={styles.changeStatusBtnText}>Manage Lifecycle</Text>
              </Pressable>
            </View>
          )}

          {/* Tab Switcher */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab("organization")}
              style={[
                styles.tabBtn,
                activeTab === "organization" && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "organization" && styles.tabBtnTextActive,
                ]}
              >
                Profile
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("attendance")}
              style={[
                styles.tabBtn,
                activeTab === "attendance" && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "attendance" && styles.tabBtnTextActive,
                ]}
              >
                Attendance
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("leave")}
              style={[
                styles.tabBtn,
                activeTab === "leave" && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "leave" && styles.tabBtnTextActive,
                ]}
              >
                Leaves
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("work")}
              style={[
                styles.tabBtn,
                activeTab === "work" && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "work" && styles.tabBtnTextActive,
                ]}
              >
                Work
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("talent")}
              style={[
                styles.tabBtn,
                activeTab === "talent" && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "talent" && styles.tabBtnTextActive,
                ]}
              >
                Talent
              </Text>
            </Pressable>
          </View>

          {/* Body Content */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading employee record...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={loadDetails}
                style={styles.retryBtn}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : details ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* TAB 1: Organization & Identity */}
              {activeTab === "organization" && (
                <View style={styles.tabContent}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                      Organizational Placement
                    </Text>
                    <View style={styles.row}>
                      <Text style={styles.label}>Department</Text>
                      <Text style={styles.val}>
                        {emp?.department ?? "Unassigned"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Team</Text>
                      <Text style={styles.val}>
                        {emp?.team ?? "Unassigned"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Designation</Text>
                      <Text style={styles.val}>
                        {emp?.designation ?? "Unassigned"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Direct Manager</Text>
                      <Text style={styles.val}>
                        {emp?.manager_name
                          ? `${emp.manager_name} (${emp.manager_code})`
                          : "None"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Location</Text>
                      <Text style={styles.val}>
                        {emp?.location ?? "Unassigned"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                      Contact & Employment Details
                    </Text>
                    <View style={styles.row}>
                      <Text style={styles.label}>Work Email</Text>
                      <Text style={styles.val}>{emp?.work_email}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Phone</Text>
                      <Text style={styles.val}>
                        {emp?.phone ?? "Not provided"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>
                        Permanent Employment Status
                      </Text>
                      <Text style={[styles.val, { fontWeight: "700" }]}>
                        {emp?.employment_status?.toUpperCase() ?? "ACTIVE"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Today&apos;s Attendance</Text>
                      <Text style={styles.val}>
                        {emp?.employment_status !== "active"
                          ? "Not available / Check-in blocked"
                          : emp?.today_attendance_status === "checked_in"
                            ? `Checked In / Working${emp?.today_check_in_time ? ` (${emp.today_check_in_time})` : ""}`
                            : emp?.today_attendance_status === "checked_out"
                              ? `Checked Out${emp?.today_check_out_time ? ` (${emp.today_check_out_time})` : ""}`
                              : "Not Checked In"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Today&apos;s Leave</Text>
                      <Text style={styles.val}>
                        {emp?.working_on_leave
                          ? "On Leave (⚡ Working on Leave)"
                          : emp?.has_approved_leave_today ||
                              emp?.today_leave_status === "on_leave"
                            ? "On Leave"
                            : "None"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Employment Type</Text>
                      <Text style={styles.val}>
                        {emp?.employment_type.replace("_", " ")}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Joining Date</Text>
                      <Text style={styles.val}>
                        {emp?.joining_date ?? "Not recorded"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 2: Attendance History */}
              {activeTab === "attendance" && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabSectionTitle}>
                    Recent Attendance Logs (Last 10)
                  </Text>
                  {details.attendance_history.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No attendance records logged yet.
                    </Text>
                  ) : (
                    details.attendance_history.map((att) => (
                      <View key={att.id} style={styles.logCard}>
                        <View style={styles.logHeader}>
                          <Text style={styles.logDate}>
                            {att.attendance_date}
                          </Text>
                          <View
                            style={[
                              styles.miniPill,
                              att.check_in_verification_status === "approved"
                                ? styles.miniPillSuccess
                                : att.check_in_verification_status ===
                                    "rejected"
                                  ? styles.miniPillDanger
                                  : styles.miniPillWarning,
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniPillText,
                                att.check_in_verification_status === "approved"
                                  ? styles.miniTextSuccess
                                  : att.check_in_verification_status ===
                                      "rejected"
                                    ? styles.miniTextDanger
                                    : styles.miniTextWarning,
                              ]}
                            >
                              {att.check_in_verification_status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.logMetaRow}>
                          <Text style={styles.logTime}>
                            In:{" "}
                            {new Date(att.check_in_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                          <Text style={styles.logTime}>
                            Out:{" "}
                            {att.check_out_at
                              ? new Date(att.check_out_at).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : "Active session"}
                          </Text>
                        </View>
                        {att.leave_reconciled && (
                          <View style={styles.reconciledBanner}>
                            <Text style={styles.reconciledBannerText}>
                              ✓ Leave Reconciled · Balance Restored
                            </Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 3: Leave Management */}
              {activeTab === "leave" && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabSectionTitle}>
                    Current Year Leave Balances
                  </Text>
                  {details.leave_balances.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No leave balances allocated for current year.
                    </Text>
                  ) : (
                    <View style={styles.balanceGrid}>
                      {details.leave_balances.map((b) => (
                        <View key={b.leave_type_name} style={styles.balCard}>
                          <Text style={styles.balType}>
                            {b.leave_type_name}
                          </Text>
                          <Text style={styles.balDays}>
                            {b.available_days} Days
                          </Text>
                          <Text style={styles.balSub}>
                            Used: {b.used_days} / {b.allocated_days}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text
                    style={[styles.tabSectionTitle, { marginTop: spacing.md }]}
                  >
                    Recent Leave Requests
                  </Text>
                  {details.leave_requests.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No leave requests submitted.
                    </Text>
                  ) : (
                    details.leave_requests.map((lr) => (
                      <View key={lr.id} style={styles.logCard}>
                        <View style={styles.logHeader}>
                          <Text style={styles.logDate}>
                            {lr.start_date} to {lr.end_date}
                          </Text>
                          <View
                            style={[
                              styles.miniPill,
                              lr.status === "approved"
                                ? styles.miniPillSuccess
                                : lr.status === "rejected"
                                  ? styles.miniPillDanger
                                  : styles.miniPillWarning,
                            ]}
                          >
                            <Text style={styles.miniPillText}>
                              {lr.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.logSubText}>
                          {lr.leave_type_name} · {lr.requested_days} day(s){" "}
                          {lr.is_half_day ? "(Half Day)" : ""}
                        </Text>
                        {lr.reason && (
                          <Text style={styles.logReason}>
                            Reason: {lr.reason}
                          </Text>
                        )}
                        {(lr.reviewer_notes || lr.review_notes) && (
                          <Text style={styles.logReason}>
                            Notes: {lr.reviewer_notes || lr.review_notes}
                          </Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 4: Work Assignments */}
              {activeTab === "work" && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabSectionTitle}>
                    Recent Work Assignments
                  </Text>
                  {details.work_assignments.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No work assignments recorded.
                    </Text>
                  ) : (
                    details.work_assignments.map((wk) => (
                      <View key={wk.id} style={styles.logCard}>
                        <View style={styles.logHeader}>
                          <Text style={styles.taskTitle}>{wk.title}</Text>
                          <View style={styles.miniPill}>
                            <Text style={styles.miniPillText}>
                              {wk.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.logSubText}>
                          Date: {wk.work_date} · Priority:{" "}
                          {wk.priority.toUpperCase()} · Progress:{" "}
                          {wk.progress_percent}%
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 5: Talent Profile */}
              {activeTab === "talent" && (
                <View style={styles.tabContent}>
                  {details.talent_profile ? (
                    <View style={styles.talentWrap}>
                      <View style={styles.card}>
                        <View style={styles.logHeader}>
                          <Text style={styles.cardTitle}>
                            Professional Talent Card
                          </Text>
                          <View
                            style={[
                              styles.miniPill,
                              details.talent_profile.review_status ===
                              "approved"
                                ? styles.miniPillSuccess
                                : styles.miniPillWarning,
                            ]}
                          >
                            <Text style={styles.miniPillText}>
                              {details.talent_profile.review_status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.row}>
                          <Text style={styles.label}>Talent ID</Text>
                          <Text style={styles.val}>
                            {details.talent_profile.talent_id}
                          </Text>
                        </View>
                        <View style={styles.row}>
                          <Text style={styles.label}>Professional Title</Text>
                          <Text style={styles.val}>
                            {details.talent_profile.professional_title ??
                              "Not set"}
                          </Text>
                        </View>
                        {details.talent_profile.summary && (
                          <View style={styles.summaryWrap}>
                            <Text style={styles.label}>Summary</Text>
                            <Text style={styles.summaryBody}>
                              {details.talent_profile.summary}
                            </Text>
                          </View>
                        )}
                        <View style={styles.statGrid}>
                          <View style={styles.statBox}>
                            <Text style={styles.statNum}>
                              {details.talent_profile.skills_count}
                            </Text>
                            <Text style={styles.statLabel}>Skills</Text>
                          </View>
                          <View style={styles.statBox}>
                            <Text style={styles.statNum}>
                              {details.talent_profile.experiences_count}
                            </Text>
                            <Text style={styles.statLabel}>Experience</Text>
                          </View>
                          <View style={styles.statBox}>
                            <Text style={styles.statNum}>
                              {details.talent_profile.projects_count}
                            </Text>
                            <Text style={styles.statLabel}>Projects</Text>
                          </View>
                          <View style={styles.statBox}>
                            <Text style={styles.statNum}>
                              {details.talent_profile.certifications_count}
                            </Text>
                            <Text style={styles.statLabel}>Certs</Text>
                          </View>
                        </View>
                      </View>

                      {/* Skills Detail */}
                      {details.talent_profile.skills &&
                        details.talent_profile.skills.length > 0 && (
                          <View style={styles.talentSubSection}>
                            <Text style={styles.talentSubTitle}>
                              Skills ({details.talent_profile.skills.length})
                            </Text>
                            {details.talent_profile.skills.map((s) => (
                              <View key={s.id} style={styles.talentItemCard}>
                                <View style={styles.talentItemHeader}>
                                  <Text style={styles.talentItemTitle}>
                                    {s.name}
                                  </Text>
                                  <Text style={styles.talentItemMeta}>
                                    {s.proficiency.toUpperCase()}
                                  </Text>
                                </View>
                                {s.category && (
                                  <Text style={styles.talentItemSub}>
                                    {s.category}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                      {/* Experience Detail */}
                      {details.talent_profile.experiences &&
                        details.talent_profile.experiences.length > 0 && (
                          <View style={styles.talentSubSection}>
                            <Text style={styles.talentSubTitle}>
                              Experience (
                              {details.talent_profile.experiences.length})
                            </Text>
                            {details.talent_profile.experiences.map((exp) => (
                              <View key={exp.id} style={styles.talentItemCard}>
                                <Text style={styles.talentItemTitle}>
                                  {exp.job_title}
                                </Text>
                                <Text style={styles.talentItemSub}>
                                  {exp.company}
                                  {exp.employment_type
                                    ? ` · ${exp.employment_type}`
                                    : ""}
                                </Text>
                                <Text style={styles.talentItemMeta}>
                                  {exp.start_date} —{" "}
                                  {exp.is_current
                                    ? "Present"
                                    : (exp.end_date ?? "N/A")}
                                </Text>
                                {exp.description && (
                                  <Text style={styles.talentItemDesc}>
                                    {exp.description}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                      {/* Education Detail */}
                      {details.talent_profile.education &&
                        details.talent_profile.education.length > 0 && (
                          <View style={styles.talentSubSection}>
                            <Text style={styles.talentSubTitle}>
                              Education (
                              {details.talent_profile.education.length})
                            </Text>
                            {details.talent_profile.education.map((edu) => (
                              <View key={edu.id} style={styles.talentItemCard}>
                                <Text style={styles.talentItemTitle}>
                                  {edu.qualification}
                                  {edu.field_of_study
                                    ? ` in ${edu.field_of_study}`
                                    : ""}
                                </Text>
                                <Text style={styles.talentItemSub}>
                                  {edu.institution}
                                </Text>
                                {(edu.start_date || edu.end_date) && (
                                  <Text style={styles.talentItemMeta}>
                                    {edu.start_date ?? "N/A"} —{" "}
                                    {edu.end_date ?? "Present"}
                                  </Text>
                                )}
                                {edu.description && (
                                  <Text style={styles.talentItemDesc}>
                                    {edu.description}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                      {/* Certifications Detail */}
                      {details.talent_profile.certifications &&
                        details.talent_profile.certifications.length > 0 && (
                          <View style={styles.talentSubSection}>
                            <Text style={styles.talentSubTitle}>
                              Certifications (
                              {details.talent_profile.certifications.length})
                            </Text>
                            {details.talent_profile.certifications.map((c) => (
                              <View key={c.id} style={styles.talentItemCard}>
                                <Text style={styles.talentItemTitle}>
                                  {c.name}
                                </Text>
                                <Text style={styles.talentItemSub}>
                                  Issued by {c.issuer}
                                </Text>
                                {(c.issue_date || c.expiry_date) && (
                                  <Text style={styles.talentItemMeta}>
                                    Issued: {c.issue_date ?? "N/A"}
                                    {c.expiry_date
                                      ? ` · Expires: ${c.expiry_date}`
                                      : ""}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                      {/* Projects Detail */}
                      {details.talent_profile.projects &&
                        details.talent_profile.projects.length > 0 && (
                          <View style={styles.talentSubSection}>
                            <Text style={styles.talentSubTitle}>
                              Projects ({details.talent_profile.projects.length}
                              )
                            </Text>
                            {details.talent_profile.projects.map((p) => (
                              <View key={p.id} style={styles.talentItemCard}>
                                <Text style={styles.talentItemTitle}>
                                  {p.name}
                                </Text>
                                {p.role && (
                                  <Text style={styles.talentItemSub}>
                                    Role: {p.role}
                                  </Text>
                                )}
                                {(p.start_date || p.end_date) && (
                                  <Text style={styles.talentItemMeta}>
                                    {p.start_date ?? "N/A"} —{" "}
                                    {p.is_current
                                      ? "Present"
                                      : (p.end_date ?? "N/A")}
                                  </Text>
                                )}
                                {p.description && (
                                  <Text style={styles.talentItemDesc}>
                                    {p.description}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                      {/* Achievements Detail */}
                      {details.talent_profile.achievements &&
                        details.talent_profile.achievements.length > 0 && (
                          <View style={styles.talentSubSection}>
                            <Text style={styles.talentSubTitle}>
                              Achievements (
                              {details.talent_profile.achievements.length})
                            </Text>
                            {details.talent_profile.achievements.map((ach) => (
                              <View key={ach.id} style={styles.talentItemCard}>
                                <Text style={styles.talentItemTitle}>
                                  {ach.title}
                                </Text>
                                {ach.issuer && (
                                  <Text style={styles.talentItemSub}>
                                    Awarded by {ach.issuer}
                                  </Text>
                                )}
                                {ach.achieved_on && (
                                  <Text style={styles.talentItemMeta}>
                                    Date: {ach.achieved_on}
                                  </Text>
                                )}
                                {ach.description && (
                                  <Text style={styles.talentItemDesc}>
                                    {ach.description}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>
                      No talent profile created by this employee yet.
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>

      {/* Lifecycle Status Change Modal */}
      {emp && (
        <HRStatusModal
          currentStatus={emp.employment_status}
          currentWorkforceStatus={emp.current_workforce_status}
          employeeCode={emp.employee_code}
          employeeId={emp.id}
          employeeName={fullName}
          hasApprovedLeaveToday={emp.has_approved_leave_today}
          onClose={() => setStatusModalVisible(false)}
          onSuccess={() => {
            loadDetails();
            onStatusChanged();
          }}
          visible={statusModalVisible}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    height: "90%",
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  headerInfo: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  headerTextCol: {
    gap: 2,
  },
  empName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  empCode: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "700",
  },
  lifecycleBar: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  statusGroup: {
    gap: 2,
  },
  statusRowHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  permStatusSubText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  statusMetaLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillActive: {
    backgroundColor: colors.accent,
  },
  pillTextActive: {
    color: colors.success,
  },
  pillOnLeave: {
    backgroundColor: "#FEF08A",
  },
  pillTextOnLeave: {
    color: "#854D0E",
  },
  pillInactive: {
    backgroundColor: "#E2E8F0",
  },
  pillTextInactive: {
    color: colors.muted,
  },
  pillTerminated: {
    backgroundColor: "#FEE2E2",
  },
  pillTextTerminated: {
    color: "#991B1B",
  },
  workingOnLeaveBadge: {
    backgroundColor: "#FEF08A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  workingOnLeaveBadgeText: {
    color: "#854D0E",
    fontSize: 10,
    fontWeight: "700",
  },
  onLeaveBadge: {
    backgroundColor: "#FEF9C3",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  onLeaveBadgeText: {
    color: "#854D0E",
    fontSize: 10,
    fontWeight: "700",
  },
  reconciledBanner: {
    backgroundColor: "#DCFCE7",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  reconciledBannerText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "700",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  changeStatusBtn: {
    backgroundColor: colors.white,
    borderColor: "#CBD5E1",
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  changeStatusBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabBtnText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  scrollContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  tabContent: {
    gap: spacing.sm,
  },
  tabSectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: "#F1F5F9",
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
  val: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  summaryWrap: {
    marginTop: 6,
    gap: 2,
  },
  summaryBody: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  statGrid: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 8,
  },
  statBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 6,
  },
  statNum: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 1,
  },
  logCard: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm + 2,
    gap: 4,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logDate: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  logMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  logTime: {
    color: colors.muted,
    fontSize: 12,
  },
  logSubText: {
    color: colors.muted,
    fontSize: 12,
  },
  logReason: {
    color: colors.ink,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  taskTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  miniPill: {
    backgroundColor: "#E2E8F0",
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  miniPillSuccess: {
    backgroundColor: colors.accent,
  },
  miniPillDanger: {
    backgroundColor: "#FEE2E2",
  },
  miniPillWarning: {
    backgroundColor: "#FEF08A",
  },
  miniPillText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "700",
  },
  miniTextSuccess: {
    color: colors.success,
  },
  miniTextDanger: {
    color: "#DC2626",
  },
  miniTextWarning: {
    color: "#854D0E",
  },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  balCard: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minWidth: "45%",
    padding: spacing.sm,
    gap: 2,
  },
  balType: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  balDays: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  balSub: {
    color: colors.muted,
    fontSize: 11,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  talentWrap: {
    gap: spacing.md,
  },
  talentSubSection: {
    marginTop: spacing.xs,
  },
  talentSubTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  talentItemCard: {
    backgroundColor: colors.canvas,
    borderColor: "#E2E8F0",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.xs,
    gap: 2,
  },
  talentItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  talentItemTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  talentItemMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  talentItemSub: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "500",
  },
  talentItemDesc: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
