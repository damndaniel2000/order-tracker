import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
      <Text style={styles.title}>
        {outcome === "delivered" ? "Proof of delivery" : "Delivery failed"}
      </Text>
      <Text style={styles.subtitle}>
        {outcome === "delivered"
          ? "Take a photo of the delivered package, then submit."
          : "Explain why the order could not be delivered."}
      </Text>

      {outcome === "delivered" ? (
        <>
          <Pressable style={styles.secondaryButton} onPress={onTakePhoto}>
            <Text style={styles.secondaryButtonText}>
              {photoUri ? "Retake photo" : "Open camera"}
            </Text>
          </Pressable>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.preview} />
          ) : null}
        </>
      ) : null}

      <Text style={styles.label}>
        Remarks {outcome === "failed" ? "(required)" : "(optional)"}
      </Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={4}
        placeholder={
          outcome === "failed"
            ? "Customer not home, wrong address, refused..."
            : "Left with neighbor, porch, etc."
        }
        value={remarks}
        onChangeText={setRemarks}
        textAlignVertical="top"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[
          styles.primaryButton,
          outcome === "failed" && styles.dangerButton,
          busy && styles.disabled,
        ]}
        onPress={onSubmit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {outcome === "delivered" ? "Submit delivered" : "Submit failed"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F8FAFC" },
  title: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  subtitle: { marginTop: 6, color: "#64748B", marginBottom: 16 },
  label: {
    marginTop: 16,
    marginBottom: 6,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    backgroundColor: "#fff",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#4F46E5", fontWeight: "700" },
  preview: {
    marginTop: 12,
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButton: { backgroundColor: "#B91C1C" },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  error: { color: "#B91C1C", marginTop: 12 },
});
