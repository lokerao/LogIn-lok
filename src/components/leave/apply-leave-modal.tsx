import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";

import { colors, radius, spacing, typography } from "@/constants/design-system";
import {
    fetchLeaveTypes,
    formatLeaveDays,
    isValidDateString,
    previewDays,
    submitLeaveRequest,
} from "@/features/leave/leave-service";
import type { LeaveType } from "@/types/leave";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

export function ApplyLeaveModal({ visible, onClose, onSubmitted }: Props) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submission lock — prevents double-tap
  const submitLock = useRef(false);

  const selectedType = leaveTypes.find((t) => t.id === selectedTypeId);
  const preview = previewDays(startDate, endDate, isHalfDay);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setLoadingTypes(true);
      fetchLeaveTypes()
        .then((types) => {
          setLeaveTypes(types);
          setSelectedTypeId((prev) => (prev ? prev : (types[0]?.id ?? "")));
        })
        .catch(() => setError("Could not load leave types. Please try again."))
        .finally(() => setLoadingTypes(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [visible]);

  function resetForm() {
    setSelectedTypeId(leaveTypes[0]?.id ?? "");
    setStartDate("");
    setEndDate("");
    setIsHalfDay(false);
    setReason("");
    setError(null);
    submitLock.current = false;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function validate(): string | null {
    if (!selectedTypeId) return "Please select a leave type.";
    if (!isValidDateString(startDate))
      return "Enter a valid start date (YYYY-MM-DD).";
    if (!isValidDateString(endDate))
      return "Enter a valid end date (YYYY-MM-DD).";
    if (endDate < startDate) return "End date cannot be before start date.";
    if (isHalfDay && startDate !== endDate)
      return "Half-day leave must be a single day.";
    if (isHalfDay && selectedType && !selectedType.allows_half_day)
      return `${selectedType.name} does not support half-day requests.`;
    if (reason.trim().length < 5)
      return "Please provide a reason (at least 5 characters).";
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await submitLeaveRequest({
        leaveTypeId: selectedTypeId,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        reason: reason.trim(),
        isHalfDay,
      });
      resetForm();
      onSubmitted();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not submit leave request.";
      setError(msg);
      submitLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  function confirmSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    const typeName = selectedType?.name ?? "Leave";
    const daysText = preview !== null ? formatLeaveDays(preview) : "?";
    Alert.alert(
      "Confirm Leave Request",
      `Submit ${typeName} request for ${daysText} from ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}?`,
      [
        { text: "Edit", style: "cancel" },
        { text: "Submit", onPress: () => void handleSubmit() },
      ],
    );
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Apply for Leave</Text>
            <Pressable
              accessibilityLabel="Close"
              onPress={handleClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {loadingTypes && <ActivityIndicator color={colors.primary} />}

            {/* Leave Type Picker */}
            {leaveTypes.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>Leave Type</Text>
                <View style={styles.typeList}>
                  {leaveTypes.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        setSelectedTypeId(t.id);
                        setIsHalfDay(false);
                      }}
                      style={[
                        styles.typeChip,
                        t.id === selectedTypeId && styles.typeChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          t.id === selectedTypeId && styles.typeChipTextActive,
                        ]}
                      >
                        {t.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Dates */}
            <View style={styles.row}>
              <View style={[styles.field, styles.flex1]}>
                <Text style={styles.label}>Start Date</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="numeric"
                  maxLength={10}
                  onChangeText={(v) => {
                    setStartDate(v);
                    if (isHalfDay) setEndDate(v);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={startDate}
                />
              </View>
              {!isHalfDay && (
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>End Date</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="numeric"
                    maxLength={10}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    value={endDate}
                  />
                </View>
              )}
            </View>

            {/* Half Day Toggle */}
            {selectedType?.allows_half_day && (
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Half Day</Text>
                <Switch
                  onValueChange={(v) => {
                    setIsHalfDay(v);
                    if (v) setEndDate(startDate);
                  }}
                  thumbColor={isHalfDay ? colors.white : colors.muted}
                  trackColor={{ false: "#EEF1F6", true: colors.primary }}
                  value={isHalfDay}
                />
              </View>
            )}

            {/* Duration Preview */}
            {preview !== null && (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>
                  Requesting {formatLeaveDays(preview)}
                </Text>
              </View>
            )}

            {/* Reason */}
            <View style={styles.field}>
              <Text style={styles.label}>Reason</Text>
              <TextInput
                maxLength={1000}
                multiline
                numberOfLines={4}
                onChangeText={setReason}
                placeholder="Briefly explain why you need this leave…"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textarea]}
                textAlignVertical="top"
                value={reason}
              />
              <Text style={styles.charCount}>{reason.trim().length}/1000</Text>
            </View>

            {/* Error */}
            {Boolean(error) && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit */}
            <Pressable
              disabled={submitting}
              onPress={confirmSubmit}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.submitBtnPressed,
                submitting && styles.submitBtnDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitText}>Submit Request</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(23,34,53,0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#EEF1F6",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  closeBtn: { padding: spacing.xs },
  closeTxt: { color: colors.muted, fontSize: 18 },
  body: { gap: spacing.md, padding: spacing.lg },
  field: { gap: spacing.xs },
  flex1: { flex: 1 },
  row: { flexDirection: "row", gap: spacing.md },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: "#DEE4EF",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  textarea: { height: 96, paddingTop: 12 },
  charCount: { color: colors.muted, fontSize: 12, textAlign: "right" },
  typeList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeChip: {
    backgroundColor: colors.canvas,
    borderColor: "#DEE4EF",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  typeChipTextActive: { color: colors.white },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  toggleLabel: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  previewBox: {
    alignItems: "center",
    backgroundColor: "#EFF4FF",
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  previewText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  errorBox: {
    backgroundColor: "#FEE4E2",
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: { color: "#B42318", fontSize: 14 },
  submitBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  submitBtnPressed: { backgroundColor: colors.primaryPressed },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: colors.white, ...typography.button },
});
