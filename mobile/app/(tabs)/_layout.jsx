import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import Logo from "../../components/Logo.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";

const ICONS = {
  index: "home",
  notes: "book",
<<<<<<< HEAD
  projects: "briefcase",
=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
  playground: "code-slash",
  ai: "sparkles",
  profile: "person",
};

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerLeft: () => <View style={{ marginLeft: 12 }}><Logo size={26} /></View>,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name] || "ellipse"} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: false }} />
      <Tabs.Screen name="notes" options={{ title: "Notes" }} />
<<<<<<< HEAD
      <Tabs.Screen name="projects" options={{ title: "Projects" }} />
=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
      <Tabs.Screen name="playground" options={{ title: "Playground" }} />
      <Tabs.Screen name="ai" options={{ title: "AI" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
