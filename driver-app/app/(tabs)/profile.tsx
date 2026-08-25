import { Pressable, StyleSheet, Text, View } from "react-native";
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
      <Text style={styles.title}>{driver?.displayName}</Text>
      <Text style={styles.meta}>{driver?.email}</Text>
      <Text style={styles.meta}>API: {API_URL}</Text>

      <Pressable style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#F8FAFC" },
  title: { fontSize: 24, fontWeight: "700", color: "#0F172A" },
  meta: { color: "#64748B", marginTop: 6 },
  button: {
    marginTop: 32,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
