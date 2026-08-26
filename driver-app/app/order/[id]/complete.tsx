import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput, useTheme } from "react-native-paper";
import { router, useLocalSearchParams } from "expo-router";
import { completeDelivery, uploadToCloudinary } from "@/lib/api";
import { stopBackgroundTracking } from "@/lib/backgroundLocation";
import { takeProofPhoto } from "@/lib/actions";
import { useAuth } from "@/lib/auth";

export default function CompleteDeliveryScreen() {
  const { id, mode } = useLocalSearchParams<{
    id: string;
    mode?: "delivered" | "failed";
  }>();
  const outcome = mode === "failed" ? "failed" : "delivered";
  const { token } = useAuth();
  const theme = useTheme();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onTakePhoto() {
    setError(null);
    try {
      const uri = await takeProofPhoto();
      if (uri) setPhotoUri(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera failed");
    }
  }

  async function onSubmit() {
    if (!token || !id) return;
    setBusy(true);
    setError(null);
    try {
      let photoUrl: string | undefined;
      if (outcome === "delivered") {
        if (!photoUri) throw new Error("Take a proof-of-delivery photo first.");
        photoUrl = await uploadToCloudinary(token, photoUri);
      } else if (!remarks.trim()) {
        throw new Error("Remarks are required when delivery fails.");
      }

      await completeDelivery(token, id, {
        outcome,
        remarks: remarks.trim() || undefined,
        photoUrl,
      });
      await stopBackgroundTracking();
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete delivery");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {outcome === "delivered" ? "Proof of delivery" : "Delivery failed"}
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {outcome === "delivered"
          ? "Take a photo of the delivered package, then submit."
          : "Explain why the order could not be delivered."}
      </Text>

      {outcome === "delivered" ? (
        <>
          <Button mode="outlined" style={styles.secondaryButton} onPress={onTakePhoto}>
            {photoUri ? "Retake photo" : "Open camera"}
          </Button>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.preview} />
          ) : null}
        </>
      ) : null}

      <TextInput
        mode="outlined"
        label={`Remarks ${outcome === "failed" ? "(required)" : "(optional)"}`}
        multiline
        numberOfLines={4}
        placeholder={
          outcome === "failed"
            ? "Customer not home, wrong address, refused..."
            : "Left with neighbor, porch, etc."
        }
        value={remarks}
        onChangeText={setRemarks}
        style={styles.input}
      />

      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      <Button
        mode="contained"
        buttonColor={outcome === "failed" ? theme.colors.error : undefined}
        onPress={onSubmit}
        loading={busy}
        disabled={busy}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
      >
        {outcome === "delivered" ? "Submit delivered" : "Submit failed"}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F8FAFC" },
  title: { fontWeight: "700", color: "#0F172A" },
  subtitle: { marginTop: 6, color: "#64748B", marginBottom: 16 },
  input: { marginTop: 16 },
  secondaryButton: { borderRadius: 12 },
  preview: {
    marginTop: 12,
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  primaryButton: { marginTop: 8, borderRadius: 12 },
  buttonContent: { paddingVertical: 4 },
});
