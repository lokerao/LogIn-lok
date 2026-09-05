import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/constants/design-system";
import {
  fetchOrganizationTalentViewerRequests,
  reviewTalentViewerAccessRequest,
} from "@/features/talent-network/talent-network-service";
import type { OrganizationIncomingAccessRequest } from "@/types/talent-network";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function TalentViewerRequestsReviewModal({ visible, onClose }: Props) {
  const [requests, setRequests] = useState<OrganizationIncomingAccessRequest[]>(
    [],
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchOrganizationTalentViewerRequests();
      setRequests(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load Talent Viewer requests.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [visible, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  async function handleReview(
    req: OrganizationIncomingAccessRequest,
    status: "approved" | "rejected" | "suspended",
  ) {
    const actionLabel =
      status === "approved"
        ? "Approve"
        : status === "rejected"
          ? "Reject"
          : "Suspend";

    Alert.alert(
      `${actionLabel} Access Request`,
      `Are you sure you want to ${actionLabel.toLowerCase()} Talent Network access for ${req.viewer_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: actionLabel,
          style: status === "approved" ? "default" : "destructive",
          onPress: async () => {
            setProcessingId(req.id);
            try {
              const note = reviewNotes[req.id];
              await reviewTalentViewerAccessRequest(req.id, status, note);
              Alert.alert(
                "Access Updated",
                `Talent Network access for ${req.viewer_name} has been ${status}.`,
              );
              await loadData();
            } catch (err: unknown) {
              const msg =
                err instanceof Error ? err.message : "Review action failed.";
              Alert.alert("Action Failed", msg);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.title}>Talent Viewer Access Requests</Text>
              <Text style={styles.subtitle}>
                Review external requests to discover your organization&apos;s
                approved talent
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading requests...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                onPress={() => void loadData()}
                style={styles.retryBtn}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
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
              {requests.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📬</Text>
                  <Text style={styles.emptyTitle}>No Requests</Text>
                  <Text style={styles.emptyDesc}>
                    There are no incoming Talent Viewer access requests for your
                    organization at this time.
                  </Text>
                </View>
              ) : (
                requests.map((req) => {
                  const isProcessing = processingId === req.id;
                  const isPending = req.status === "pending";

                  return (
                    <View key={req.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {req.viewer_name.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.headerInfo}>
                          <Text style={styles.viewerName}>
                            {req.viewer_name}
                          </Text>
                          <Text style={styles.dateMeta}>
                            Requested:{" "}
                            {new Date(req.requested_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.badge,
                            req.status === "approved"
                              ? styles.badgeApproved
                              : req.status === "pending"
                                ? styles.badgePending
                                : req.status === "rejected"
                                  ? styles.badgeRejected
                                  : styles.badgeSuspended,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              req.status === "approved"
                                ? styles.badgeTextApproved
                                : req.status === "pending"
                                  ? styles.badgeTextPending
                                  : req.status === "rejected"
                                    ? styles.badgeTextRejected
                                    : styles.badgeTextSuspended,
                            ]}
                          >
                            {req.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Review audit info if reviewed */}
                      {Boolean(req.reviewed_at) && (
                        <View style={styles.reviewedBox}>
                          <Text style={styles.reviewedText}>
                            Reviewed on{" "}
                            {new Date(req.reviewed_at!).toLocaleDateString()}
                            {req.reviewed_by_name
                              ? ` by ${req.reviewed_by_name}`
                              : ""}
                          </Text>
                          {Boolean(req.reviewer_notes) && (
                            <Text style={styles.notesText}>
                              Note: &quot;{req.reviewer_notes}&quot;
                            </Text>
                          )}
                        </View>
                      )}

                      {/* Review actions & optional note input */}
                      {isPending ? (
                        <View style={styles.actionSection}>
                          <TextInput
                            accessibilityLabel="Review note"
                            onChangeText={(text) =>
                              setReviewNotes((prev) => ({
                                ...prev,
                                [req.id]: text,
                              }))
                            }
                            placeholder="Optional reviewer note..."
                            placeholderTextColor={colors.muted}
                            style={styles.noteInput}
                            value={reviewNotes[req.id] || ""}
                          />
                          <View style={styles.buttonRow}>
                            <Pressable
                              accessibilityRole="button"
                              disabled={isProcessing}
                              onPress={() => void handleReview(req, "rejected")}
                              style={[
                                styles.rejectBtn,
                                isProcessing && styles.btnDisabled,
                              ]}
                            >
                              <Text style={styles.rejectBtnText}>✕ Reject</Text>
                            </Pressable>

                            <Pressable
                              accessibilityRole="button"
                              disabled={isProcessing}
                              onPress={() => void handleReview(req, "approved")}
                              style={[
                                styles.approveBtn,
                                isProcessing && styles.btnDisabled,
                              ]}
                            >
                              <Text style={styles.approveBtnText}>
                                ✓ Approve
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : req.status === "approved" ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={isProcessing}
                          onPress={() => void handleReview(req, "suspended")}
                          style={styles.suspendBtn}
                        >
                          <Text style={styles.suspendBtnText}>
                            Suspend Access
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          disabled={isProcessing}
                          onPress={() => void handleReview(req, "approved")}
                          style={styles.reApproveBtn}
                        >
                          <Text style={styles.reApproveBtnText}>
                            Approve Access
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    minHeight: "50%",
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerTitleCol: {
    flex: 1,
    gap: 2,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
  },
  closeBtn: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  closeBtnText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  centerBox: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyDesc: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.white,
    borderColor: "#E2E8F0",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderColor: "#DDD6FE",
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarText: {
    color: "#6D28D9",
    fontSize: 16,
    fontWeight: "800",
  },
  headerInfo: {
    flex: 1,
    gap: 1,
  },
  viewerName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  dateMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  badgeApproved: { backgroundColor: "#DCFCE7" },
  badgeTextApproved: { color: "#166534" },
  badgePending: { backgroundColor: "#FEF3C7" },
  badgeTextPending: { color: "#92400E" },
  badgeRejected: { backgroundColor: "#FEE2E2" },
  badgeTextRejected: { color: "#991B1B" },
  badgeSuspended: { backgroundColor: "#FFEDD5" },
  badgeTextSuspended: { color: "#9A3412" },
  reviewedBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    gap: 2,
    padding: spacing.sm,
  },
  reviewedText: {
    color: colors.muted,
    fontSize: 11,
  },
  notesText: {
    color: colors.ink,
    fontSize: 11,
    fontStyle: "italic",
  },
  actionSection: {
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  noteInput: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 6,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rejectBtn: {
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 8,
  },
  rejectBtnText: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "700",
  },
  approveBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 8,
  },
  approveBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  suspendBtn: {
    alignItems: "center",
    backgroundColor: "#FFEDD5",
    borderRadius: 6,
    justifyContent: "center",
    paddingVertical: 6,
  },
  suspendBtnText: {
    color: "#9A3412",
    fontSize: 11,
    fontWeight: "700",
  },
  reApproveBtn: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    justifyContent: "center",
    paddingVertical: 6,
  },
  reApproveBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
