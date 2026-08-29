import { Stack } from 'expo-router';
import { EmployeeProvider } from '@/features/employee/employee-provider';
export default function EmployeeLayout() { return <EmployeeProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack></EmployeeProvider>; }
