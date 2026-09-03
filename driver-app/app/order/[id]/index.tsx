import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { fetchOrder, startDelivery } from "@/lib/api";
import { startBackgroundTracking } from "@/lib/backgroundLocation";
import { openGoogleMaps } from "@/lib/actions";
import { useAuth } from "@/lib/auth";
import { type DriverOrderDetail } from "@/lib/types";
import { StatusChip } from "@/components/StatusChip";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<DriverOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const data = await fetchOrder(token, id);
      setOrder(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  useEffect(() => {
    if (!token || !id || order?.status !== "out_for_delivery") return;
    startBackgroundTracking(token, id).catch(() => {});
  }, [token, id, order?.status]);

  async function onStart() {
    if (!token || !id) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await startDelivery(token, id);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start delivery");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !order) {
    return (
      <View style={styles.center}>
        {error ? (
          <Text variant="bodyMedium" style={styles.error}>
            {error}
          </Text>
        ) : (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        )}
      </View>
    );
  }

  const active = ["arrived_at_hub", "out_for_delivery"].includes(order.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text variant="titleLarge" style={styles.orderNumber}>
          {order.order_number}
        </Text>
        <StatusChip status={order.status} />
      </View>

      <Text variant="labelSmall" style={styles.section}>
        Customer
      </Text>
      <Text variant="bodyLarge" style={styles.value}>
        {order.customer_name}
      </Text>

      <Text variant="labelSmall" style={styles.section}>
        Address
      </Text>
      <Text variant="bodyLarge" style={styles.value}>
        {order.shipping_address}
      </Text>

      <Button
        mode="outlined"
        style={styles.secondaryButton}
        onPress={() =>
          openGoogleMaps(
            order.delivery_lat,
            order.delivery_lng,
            order.shipping_address
          )
        }
      >
        Open in Google Maps
      </Button>

      <Text variant="labelSmall" style={styles.section}>
        Items
      </Text>
      {(order.order_items ?? []).map((item) => (
        <Text key={item.id} variant="bodyMedium" style={styles.item}>
          {item.name} × {item.quantity}
        </Text>
      ))}

      {error ? (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {active && order.status === "arrived_at_hub" ? (
        <Button
          mode="contained"
          onPress={onStart}
          loading={busy}
          disabled={busy}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
        >
          Start delivery
        </Button>
      ) : null}

      {active ? (
        <>
          <Button
            mode="contained"
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
            onPress={() =>
              router.push({
                pathname: "/order/[id]/complete",
                params: { id: order.id, mode: "delivered" },
              })
            }
          >
            Mark delivered (photo)
          </Button>
          <Button
            mode="outlined"
            textColor={theme.colors.error}
            style={[styles.dangerButton, { borderColor: theme.colors.error }]}
            contentStyle={styles.buttonContent}
            onPress={() =>
              router.push({
                pathname: "/order/[id]/complete",
                params: { id: order.id, mode: "failed" },
              })
            }
          >
            Delivery failed
          </Button>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: { fontFamily: "monospace", fontWeight: "700" },
  section: {
    marginTop: 20,
    marginBottom: 6,
    color: "#64748B",
    textTransform: "uppercase",
  },
  value: { color: "#0F172A" },
  item: { color: "#334155", marginBottom: 4 },
  secondaryButton: { marginTop: 12, borderRadius: 12 },
  primaryButton: { marginTop: 16, borderRadius: 12 },
  buttonContent: { paddingVertical: 4 },
  dangerButton: { marginTop: 10, borderRadius: 12 },
  error: { color: "#B91C1C", marginTop: 12 },
});
