import { StyleSheet, Text, View } from "react-native";

import { employeeStyles } from "@/components/employee-screen";
import { colors, radius, spacing } from "@/constants/design-system";
import type { LeaveBalance } from "@/types/leave";

function BalanceBar({ used, allocated }: { used: number; allocated: number }) {
  const pct = allocated > 0 ? Math.min(used / allocated, 1) : 0;
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { flex: pct }]} />
      <View style={{ flex: Math.max(0, 1 - pct) }} />
    </View>
  );
}

function BalanceRow({ balance }: { balance: LeaveBalance }) {
  const typeName = balance.leave_types?.name ?? "Leave";
  const available = balance.available_days;
  const used = balance.used_days;
  const allocated = balance.allocated_days;
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.typeName}>{typeName}</Text>
        <Text style={styles.availableText}>
          <Text style={styles.availableNum}>{available}</Text>
          <Text style={styles.availableOf}> / {allocated} left</Text>
        </Text>
      </View>
      <BalanceBar used={used} allocated={allocated} />
      <Text style={styles.usedText}>{used} used this year</Text>
    </View>
  );
}

export function LeaveBalanceCard({ balances }: { balances: LeaveBalance[] }) {
  if (balances.length === 0) {
    return (
      <View style={employeeStyles.card}>
        <Text style={employeeStyles.label}>Leave Balances</Text>
        <Text style={employeeStyles.muted}>
          No leave balances have been configured for your account yet. Please
          contact HR.
        </Text>
      </View>
    );
  }
  return (
    <View style={employeeStyles.card}>
      <Text style={employeeStyles.label}>
        Leave Balances — {new Date().getFullYear()}
      </Text>
      {balances.map((b) => (
        <BalanceRow key={b.id} balance={b} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopColor: "#EEF1F6",
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  typeName: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  availableText: {},
  availableNum: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  availableOf: { color: colors.muted, fontSize: 13 },
  barBg: {
    backgroundColor: "#EEF1F6",
    borderRadius: radius.pill,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
  },
  barFill: { backgroundColor: colors.primary },
  usedText: { color: colors.muted, fontSize: 12 },
});
