import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';

export default function RootLayout() {
  return <AuthProvider><RootNavigator /></AuthProvider>;
}
function RootNavigator() {
  const { identity, isReady, session } = useAuth();
  const canAccessApp = Boolean(session && identity?.status === 'active');
  if (!isReady) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={canAccessApp}><Stack.Screen name="(app)" /></Stack.Protected>
        <Stack.Protected guard={!canAccessApp}><Stack.Screen name="(auth)" /></Stack.Protected>
      </Stack>
    </>
  );
}
