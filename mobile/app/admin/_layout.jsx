import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { LoadingState } from "../../components/RequestStates.jsx";
import Screen from "../../components/Screen.jsx";

// This screen-level check is a UX convenience only — it stops a non-admin
// from seeing admin screens flash on-device. It is NOT the security
// boundary: every admin API call below is independently protected by
// `protect + authorize('admin')` on the server, so this check being
// bypassed would still deny data access.
export default function AdminLayout() {
  const { isAdmin, booting, isAuthenticated } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();

  useEffect(() => {
    if (!booting && (!isAuthenticated || !isAdmin)) {
      router.replace("/");
    }
  }, [booting, isAuthenticated, isAdmin]);

  if (booting || !isAdmin) {
    return <Screen><LoadingState label="Checking access..." /></Screen>;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Admin Dashboard" }} />
      <Stack.Screen name="notes/new" options={{ title: "Add Note" }} />
      <Stack.Screen name="notes/[id]" options={{ title: "Edit Note" }} />
    </Stack>
  );
}
