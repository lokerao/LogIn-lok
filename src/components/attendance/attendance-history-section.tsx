import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { employeeStyles } from "@/components/employee-screen";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { colors, radius, spacing } from "@/constants/design-system";
import {
    formatDate,
    formatDuration,
    formatTime,
} from "@/features/attendance/attendance-service";
import type { AttendanceRecord } from "@/types/attendance";
import { getVerificationStatusInfo } from "./employee-attendance-card";
import { PhotoViewModal } from "./photo-view-modal";

type Props = {
  history: AttendanceRecord[];
};

export function AttendanceHistorySection({ history }: Props) {
  const [viewPhotoPath, setViewPhotoPath] = useState<string | null>(null);
  const [photoTitle, setPhotoTitle] = useState<string>("");

  return (
    <View style={employeeStyles.card}>
      <View style={styles.headerRow}>
        <Text style={employeeStyles.label}>Attendance History</Text>
        <Text style={styles.countBadge}>{history.length} records</Text>
      </View>

      {history.length === 0 ? (
        <Text style={employeeStyles.muted}>
          No attendance history recorded yet.
        </Text>
      ) : (
        <View style={styles.list}>
          {history.map((record) => {
            const checkInStatus = getVerificationStatusInfo(
              record.check_in_verification_status,
            );
            const checkOutStatus = record.check_out_verification_status
              ? getVerificationStatusInfo(record.check_out_verification_status)
              : null;

            return (
              <View key={record.id} style={styles.historyCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.date}>
                    {formatDate(record.attendance_date)}
                  </Text>
                  <Text style={styles.duration}>
                    {formatDuration(record.check_in_at, record.check_out_at)}
                  </Text>
                </View>

                <View style={styles.eventsGrid}>
                  {/* Check-In Event */}
                  <View style={styles.eventItem}>
                    <Text style={styles.eventLabel}>Check-In</Text>
                    <Text style={styles.eventTime}>
                      {formatTime(record.check_in_at)}
                    </Text>
                    <StatusIndicator
                      style={styles.statusPill}
                      variant={checkInStatus.variant}
                    >
                      {checkInStatus.label}
                    </StatusIndicator>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setPhotoTitle(
                          `Check-In (${formatDate(record.attendance_date)})`,
                        );
                        setViewPhotoPath(record.check_in_photo_path);
                      }}
                      style={styles.photoBtn}
                    >
                      <Text style={styles.photoBtnText}>View Photo ↗</Text>
                    </Pressable>
                  </View>

                  {/* Check-Out Event */}
                  <View style={styles.eventItem}>
                    <Text style={styles.eventLabel}>Check-Out</Text>
                    <Text style={styles.eventTime}>
                      {formatTime(record.check_out_at ?? null)}
                    </Text>
                    {checkOutStatus ? (
                      <StatusIndicator
                        style={styles.statusPill}
                        variant={checkOutStatus.variant}
                      >
                        {checkOutStatus.label}
                      </StatusIndicator>
                    ) : (
                      <View style={styles.inProgressPill}>
                        <Text style={styles.inProgressText}>Active</Text>
                      </View>
                    )}
                    {Boolean(record.check_out_photo_path) && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setPhotoTitle(
                            `Check-Out (${formatDate(record.attendance_date)})`,
                          );
                          setViewPhotoPath(record.check_out_photo_path ?? null);
                        }}
                        style={styles.photoBtn}
                      >
                        <Text style={styles.photoBtnText}>View Photo ↗</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Review Notes if any */}
                {(record.check_in_review_notes ||
                  record.check_out_review_notes) && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesTitle}>Reviewer Notes</Text>
                    {Boolean(record.check_in_review_notes) && (
                      <Text style={styles.notesText}>
                        Check-in: {record.check_in_review_notes}
                      </Text>
                    )}
                    {Boolean(record.check_out_review_notes) && (
                      <Text style={styles.notesText}>
                        Check-out: {record.check_out_review_notes}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Photo Viewer Modal */}
      <PhotoViewModal
        onClose={() => setViewPhotoPath(null)}
        photoPath={viewPhotoPath}
        title={photoTitle}
        visible={Boolean(viewPhotoPath)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  countBadge: {
    backgroundColor: "#EEF2F6",
    borderRadius: radius.pill,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  historyCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    gap: spacing.xs,
    padding: spacing.md,
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  date: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  duration: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  eventsGrid: {
    borderTopColor: "#EEF1F6",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  eventItem: {
    flex: 1,
    gap: 3,
  },
  eventLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  eventTime: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  statusPill: {
    marginTop: 2,
  },
  inProgressPill: {
    alignSelf: "flex-start",
    backgroundColor: "#E0F2FE",
    borderRadius: radius.pill,
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inProgressText: {
    color: "#0369A1",
    fontSize: 11,
    fontWeight: "700",
  },
  photoBtn: {
    marginTop: 2,
    paddingVertical: 2,
  },
  photoBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  notesBox: {
    backgroundColor: "#FEF3EB",
    borderColor: "#FDBA74",
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 2,
    marginTop: 4,
    padding: spacing.sm,
  },
  notesTitle: {
    color: "#9A3412",
    fontSize: 11,
    fontWeight: "700",
  },
  notesText: {
    color: "#C2410C",
    fontSize: 12,
  },
});
