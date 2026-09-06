import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return <AuthProvider><RootNavigator /></AuthProvider>;
}
function RootNavigator() {
  const { identity, isReady, session, isRecoveringPassword } = useAuth();
  const canAccessApp = Boolean(
    session && identity?.status === 'active' && !isRecoveringPassword,
  );
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
