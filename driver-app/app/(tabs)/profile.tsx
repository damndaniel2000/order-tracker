import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/config";

export default function ProfileScreen() {
  const { driver, logout } = useAuth();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {driver?.displayName}
      </Text>
      <Text variant="bodyMedium" style={styles.meta}>
        {driver?.email}
      </Text>
      <Text variant="bodyMedium" style={styles.meta}>
        API: {API_URL}
      </Text>

      <Button
        mode="contained"
        buttonColor="#0F172A"
        onPress={onLogout}
        style={styles.button}
        contentStyle={styles.buttonContent}
      >
        Log out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#F8FAFC" },
  title: { fontWeight: "700", color: "#0F172A" },
  meta: { color: "#64748B", marginTop: 6 },
  button: { marginTop: 32, borderRadius: 12 },
  buttonContent: { paddingVertical: 4 },
});
