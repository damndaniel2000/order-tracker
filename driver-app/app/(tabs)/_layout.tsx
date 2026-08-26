import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Redirect, Tabs } from "expo-router";
import { useTheme } from "react-native-paper";
import { useAuth } from "@/lib/auth";

export default function TabLayout() {
  const { token, loading } = useAuth();
  const theme = useTheme();

  if (!loading && !token) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: theme.colors.onPrimary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "My orders",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="truck" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="user" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
