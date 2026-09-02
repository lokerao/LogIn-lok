import { colors, radius, spacing } from "@/constants/design-system";
import {
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";

export type StatusVariant = "approved" | "pending" | "rejected" | "default";

const variantStyles = {
  approved: {
    container: { backgroundColor: colors.accent },
    dot: { backgroundColor: colors.success },
    text: { color: colors.success },
  },
  pending: {
    container: { backgroundColor: "#FEF3EB" },
    dot: { backgroundColor: "#B54708" },
    text: { color: "#B54708" },
  },
  rejected: {
    container: { backgroundColor: "#FEE4E2" },
    dot: { backgroundColor: "#B42318" },
    text: { color: "#B42318" },
  },
  default: {
    container: { backgroundColor: colors.accent },
    dot: { backgroundColor: colors.success },
    text: { color: colors.success },
  },
};

export function StatusIndicator({
  children,
  variant = "default",
  style,
}: {
  children: string;
  variant?: StatusVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const selected = variantStyles[variant] ?? variantStyles.default;
  return (
    <View style={[styles.container, selected.container, style]}>
      <View style={[styles.dot, selected.dot]} />
      <Text style={[styles.text, selected.text]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    alignItems: "center",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
  },
});
