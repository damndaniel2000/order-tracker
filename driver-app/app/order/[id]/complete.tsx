import { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  RadioButton,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { router, useLocalSearchParams } from "expo-router";
import { completeDelivery, uploadToCloudinary } from "@/lib/api";
import { stopBackgroundTracking } from "@/lib/backgroundLocation";
import { takeProofPhoto } from "@/lib/actions";
import { useAuth } from "@/lib/auth";

// The client's fixed list of failure reasons (from the manifest's REMARK
// column note) -- drivers must pick one; "Others" asks for a short detail.
const FAILURE_REASONS = [
  "Phone not reachable / switched off",
  "Customer not responding",
  "Customer not available",
  "Customer closed",
  "Customer does not require",
  "Defective not available",
  "Gate pass issue",
  "Incomplete or incorrect address",
  "Hold by shipper",
  "Others",
];
const OTHERS = "Others";

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function CompleteDeliveryScreen() {
  const { id, mode } = useLocalSearchParams<{
    id: string;
    mode?: "delivered" | "failed";
  }>();
  const outcome = mode === "failed" ? "failed" : "delivered";
  const { token } = useAuth();
  const theme = useTheme();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [reason, setReason] = useState("");
  const [otherDetails, setOtherDetails] = useState("");
  // "DEF YES / NO" on the manifest: was the defective unit collected?
  const [defective, setDefective] = useState<"" | "yes" | "no">("");
  const [deliveryTime, setDeliveryTime] = useState(currentTime);
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
      let remarks: string | undefined;
      if (outcome === "failed") {
        if (!reason) throw new Error("Choose a reason for the failed delivery.");
        if (reason === OTHERS) {
          if (!otherDetails.trim()) throw new Error("Describe the reason for \"Others\".");
          remarks = `${OTHERS} - ${otherDetails.trim()}`;
        } else {
          remarks = reason;
        }
      }
      const time = deliveryTime.trim();
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw new Error("Enter the time as HH:MM, e.g. 14:30.");
      }
      let photoUrl: string | undefined;
      if (outcome === "delivered") {
        if (!defective) throw new Error("Choose whether the defective unit was collected.");
        if (!photoUri) throw new Error("Take a proof-of-delivery photo first.");
        photoUrl = await uploadToCloudinary(token, photoUri);
      }

      await completeDelivery(token, id, {
        outcome,
        remarks,
        photoUrl,
        receiverName: outcome === "delivered" ? receiverName.trim() || undefined : undefined,
        deliveryTime: time,
        defectiveCollected: outcome === "delivered" ? defective === "yes" : undefined,
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="headlineSmall" style={styles.title}>
        {outcome === "delivered" ? "Proof of delivery" : "Delivery failed"}
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {outcome === "delivered"
          ? "Take a photo of the delivered package, then submit."
          : "Choose why the order could not be delivered."}
      </Text>

      {outcome === "delivered" ? (
        <>
          <Button mode="outlined" style={styles.secondaryButton} onPress={onTakePhoto}>
            {photoUri ? "Retake photo" : "Open camera"}
          </Button>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.preview} />
          ) : null}
          <TextInput
            mode="outlined"
            label="Received by"
            placeholder="Who received the package?"
            value={receiverName}
            onChangeText={setReceiverName}
            style={styles.input}
          />
          <Text variant="labelMedium" style={styles.reasonLabel}>
            Defective collected? (required)
          </Text>
          <SegmentedButtons
            value={defective}
            onValueChange={(v) => setDefective(v as "yes" | "no")}
            buttons={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </>
      ) : null}

      <TextInput
        mode="outlined"
        label={outcome === "delivered" ? "Delivery time (24h)" : "Attempt time (24h)"}
        placeholder="HH:MM"
        value={deliveryTime}
        onChangeText={setDeliveryTime}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={styles.input}
      />

      {outcome === "failed" ? (
        <>
          <Text variant="labelMedium" style={styles.reasonLabel}>
            Reason (required)
          </Text>
          <RadioButton.Group onValueChange={setReason} value={reason}>
            {FAILURE_REASONS.map((text, i) => (
              <RadioButton.Item
                key={text}
                value={text}
                label={`${i + 1}. ${text}`}
                position="leading"
                labelStyle={styles.reasonText}
                style={styles.reasonItem}
              />
            ))}
          </RadioButton.Group>
          {reason === OTHERS ? (
            <TextInput
              mode="outlined"
              label="Details (required)"
              placeholder="What happened?"
              value={otherDetails}
              onChangeText={setOtherDetails}
              style={styles.input}
            />
          ) : null}
        </>
      ) : null}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, paddingBottom: 40 },
  reasonLabel: { marginTop: 16, marginBottom: 4, color: "#64748B" },
  reasonItem: { paddingVertical: 2, paddingHorizontal: 0 },
  reasonText: { textAlign: "left" },
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
