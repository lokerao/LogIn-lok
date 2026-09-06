import DateTimePicker, {
    DateTimePickerAndroid,
    type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
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
    backendStringToDate,
    dateToBackendString,
    fetchLeaveTypes,
    formatLeaveDays,
    getTodayDateObject,
    getTodayDateString,
    isValidDateString,
    previewDays,
    submitLeaveRequest,
    toDisplayDate,
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

  // Field-specific validation errors for inline display
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [endDateError, setEndDateError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);

  // Calendar picker state for iOS / fallback modal
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);

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
    setStartDateError(null);
    setEndDateError(null);
    setReasonError(null);
    setActivePicker(null);
    submitLock.current = false;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleDateSelected(field: "start" | "end", date: Date) {
    const yyyymmdd = dateToBackendString(date);
    const today = getTodayDateString();

    if (field === "start") {
      if (yyyymmdd < today) {
        setStartDateError("Leave cannot be requested for past dates.");
      } else {
        setStartDateError(null);
      }
      setStartDate(yyyymmdd);
      if (isHalfDay) {
        setEndDate(yyyymmdd);
        setEndDateError(null);
      } else if (endDate && endDate < yyyymmdd) {
        setEndDate(yyyymmdd);
        setEndDateError(null);
      }
    } else {
      if (yyyymmdd < today) {
      } else if (startDate && yyyymmdd < startDate) {
        setEndDateError("End date cannot be before start date.");
      } else {
        setEndDateError(null);
      }
      setEndDate(yyyymmdd);
    }
    setActivePicker(null);
  }

  function openDatePicker(field: "start" | "end") {
    const isStart = field === "start";
    const currentVal = isStart
      ? startDate
        ? backendStringToDate(startDate)
        : getTodayDateObject()
      : endDate
        ? backendStringToDate(endDate)
        : startDate
          ? backendStringToDate(startDate)
          : getTodayDateObject();

    const minDate = isStart
      ? getTodayDateObject()
      : startDate
        ? backendStringToDate(startDate)
        : getTodayDateObject();

    if (Platform.OS === "android") {
      try {
        DateTimePickerAndroid.open({
          value: currentVal,
          mode: "date",
          minimumDate: minDate,
          onValueChange: (
            _event: DateTimePickerChangeEvent,
            selectedDate: Date,
          ) => {
            handleDateSelected(field, selectedDate);
          },
          onDismiss: () => {
            setActivePicker(null);
          },
        });
        return;
      } catch {
        // Fallback to activePicker modal if native module is unavailable
      }
    }

    setActivePicker(field);
  }

  function validate(): boolean {
    let isValid = true;
    setStartDateError(null);
    setEndDateError(null);
    setReasonError(null);
    setError(null);

    if (!selectedTypeId) {
      setError("Please select a leave type.");
      return false;
    }

    const today = getTodayDateString();

    if (!startDate || !isValidDateString(startDate)) {
      setStartDateError("Please select a start date.");
      isValid = false;
    } else if (startDate < today) {
      setStartDateError("Leave cannot be requested for past dates.");
      isValid = false;
    }

    if (!isHalfDay) {
      if (!endDate || !isValidDateString(endDate)) {
        setEndDateError("Please select an end date.");
        isValid = false;
      } else if (endDate < today) {
        setEndDateError("Leave cannot be requested for past dates.");
        isValid = false;
      } else if (startDate && endDate < startDate) {
        setEndDateError("End date cannot be before start date.");
        isValid = false;
      }
    } else if (startDate && isHalfDay) {
      if (selectedType && !selectedType.allows_half_day) {
        setError(`${selectedType.name} does not support half-day requests.`);
        isValid = false;
      }
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError("Please enter a reason for your leave.");
      isValid = false;
    } else if (trimmedReason.length < 5) {
      setReasonError("Please provide a reason (at least 5 characters).");
      isValid = false;
    } else if (trimmedReason.length > 1000) {
      setReasonError("Reason cannot exceed 1000 characters.");
      isValid = false;
    }

    return isValid;
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await submitLeaveRequest({
        leaveTypeId: selectedTypeId,
        startDate: startDate.trim(),
        endDate: (isHalfDay ? startDate : endDate).trim(),
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
    if (!validate()) return;
    const typeName = selectedType?.name ?? "Leave";
    const daysText = preview !== null ? formatLeaveDays(preview) : "?";
    const startDisplay = toDisplayDate(startDate);
    const endDisplay = toDisplayDate(endDate);
    Alert.alert(
      "Confirm Leave Request",
      `Submit ${typeName} request for ${daysText} from ${startDisplay}${!isHalfDay && startDisplay !== endDisplay ? ` to ${endDisplay}` : ""}?`,
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
                <Pressable
                  accessibilityLabel="Select start date"
                  accessibilityRole="button"
                  onPress={() => openDatePicker("start")}
                  style={({ pressed }) => [
                    styles.datePickerBtn,
                    pressed && styles.datePickerBtnPressed,
                    Boolean(startDateError) && styles.inputError,
                  ]}
                >
                  <Text
                    style={[
                      styles.datePickerText,
                      !startDate && styles.datePickerPlaceholder,
                    ]}
                  >
                    {startDate ? toDisplayDate(startDate) : "DD-MM-YYYY"}
                  </Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </Pressable>
                {Boolean(startDateError) && (
                  <Text style={styles.fieldErrorText}>{startDateError}</Text>
                )}
              </View>
              {!isHalfDay && (
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>End Date</Text>
                  <Pressable
                    accessibilityLabel="Select end date"
                    accessibilityRole="button"
                    onPress={() => openDatePicker("end")}
                    style={({ pressed }) => [
                      styles.datePickerBtn,
                      pressed && styles.datePickerBtnPressed,
                      Boolean(endDateError) && styles.inputError,
                    ]}
                  >
                    <Text
                      style={[
                        styles.datePickerText,
                        !endDate && styles.datePickerPlaceholder,
                      ]}
                    >
                      {endDate ? toDisplayDate(endDate) : "DD-MM-YYYY"}
                    </Text>
                    <Text style={styles.calendarIcon}>📅</Text>
                  </Pressable>
                  {Boolean(endDateError) && (
                    <Text style={styles.fieldErrorText}>{endDateError}</Text>
                  )}
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
                    if (v) {
                      setEndDate(startDate);
                      setEndDateError(null);
                    }
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
                onChangeText={(v) => {
                  setReason(v);
                  if (reasonError && v.trim().length >= 5) {
                    setReasonError(null);
                  }
                }}
                placeholder="Briefly explain why you need this leave…"
                placeholderTextColor={colors.muted}
                style={[
                  styles.input,
                  styles.textarea,
                  Boolean(reasonError) && styles.inputError,
                ]}
                textAlignVertical="top"
                value={reason}
              />
              {Boolean(reasonError) && (
                <Text style={styles.fieldErrorText}>{reasonError}</Text>
              )}
              <Text style={styles.charCount}>{reason.trim().length}/1000</Text>
            </View>

            {/* General Error */}
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

      {/* iOS / Fallback Calendar Picker Modal */}
      {activePicker && Platform.OS !== "android" && (
        <Modal
          animationType="fade"
          onRequestClose={() => setActivePicker(null)}
          transparent
          visible={Boolean(activePicker)}
        >
          <View style={styles.iosPickerBackdrop}>
            <View style={styles.iosPickerSheet}>
              <View style={styles.iosPickerHeader}>
                <Text style={styles.iosPickerTitle}>
                  Select {activePicker === "start" ? "Start Date" : "End Date"}
                </Text>
                <Pressable onPress={() => setActivePicker(null)}>
                  <Text style={styles.iosPickerDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={
                  activePicker === "start"
                    ? getTodayDateObject()
                    : startDate
                      ? backendStringToDate(startDate)
                      : getTodayDateObject()
                }
                mode="date"
                onDismiss={() => {
                  setActivePicker(null);
                }}
                onValueChange={(
                  _event: DateTimePickerChangeEvent,
                  selectedDate: Date,
                ) => {
                  handleDateSelected(activePicker, selectedDate);
                }}
                value={
                  activePicker === "start"
                    ? startDate
                      ? backendStringToDate(startDate)
                      : getTodayDateObject()
                    : endDate
                      ? backendStringToDate(endDate)
                      : startDate
                        ? backendStringToDate(startDate)
                        : getTodayDateObject()
                }
              />
            </View>
          </View>
        </Modal>
      )}
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
  datePickerBtn: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: "#DEE4EF",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  datePickerBtnPressed: {
    backgroundColor: "#EDF1F7",
  },
  datePickerText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "500",
  },
  datePickerPlaceholder: {
    color: colors.muted,
  },
  calendarIcon: {
    fontSize: 16,
  },
  inputError: {
    borderColor: "#B42318",
  },
  fieldErrorText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  iosPickerBackdrop: {
    backgroundColor: "rgba(23,34,53,0.45)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  iosPickerSheet: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  iosPickerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  iosPickerTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  iosPickerDone: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});
