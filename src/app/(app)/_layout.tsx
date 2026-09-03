import { EmployeeProvider } from "@/features/employee/employee-provider";
import { Stack } from "expo-router";
export default function EmployeeLayout() {
  return (
    <EmployeeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="leave" />
      </Stack>
    </EmployeeProvider>
  );
}
