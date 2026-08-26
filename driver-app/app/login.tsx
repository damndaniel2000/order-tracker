import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { Redirect, router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { requestDriverPermissions } from "@/lib/actions";

export default function LoginScreen() {
  const { token, loading, login } = useAuth();
  const [email, setEmail] = useState("driver@likhit.test");
  const [password, setPassword] = useState("TestDriver123!");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && token) return <Redirect href="/(tabs)" />;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await requestDriverPermissions();
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text variant="headlineMedium" style={styles.brand}>
          Likhit Driver
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Sign in to see your deliveries
        </Text>

        <TextInput
          mode="outlined"
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>

        <Button
          mode="contained"
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Sign in
        </Button>

        <Text variant="bodySmall" style={styles.hint}>
          Test: driver@likhit.test / TestDriver123!
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#EEF2FF",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
  },
  brand: { fontWeight: "700", color: "#312E81" },
  subtitle: { color: "#64748B", marginBottom: 12 },
  input: { marginTop: 8 },
  button: { marginTop: 16, borderRadius: 12 },
  buttonContent: { paddingVertical: 4 },
  hint: { marginTop: 12, color: "#94A3B8", textAlign: "center" },
});
