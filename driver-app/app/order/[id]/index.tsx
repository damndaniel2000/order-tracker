import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { fetchOrder, startDelivery } from "@/lib/api";
import { startBackgroundTracking } from "@/lib/backgroundLocation";
import { callPhone, openGoogleMaps } from "@/lib/actions";
import { useAuth } from "@/lib/auth";
import { STATUS_LABELS, type DriverOrderDetail } from "@/lib/types";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<DriverOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color="#4F46E5" />
        )}
      </View>
    );
  }

  const active = ["shipped", "out_for_delivery"].includes(order.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text style={styles.orderNumber}>{order.order_number}</Text>
        <Text style={styles.badge}>{STATUS_LABELS[order.status]}</Text>
      </View>

      <Text style={styles.section}>Customer</Text>
      <Text style={styles.value}>{order.customer_name}</Text>
      {order.customer_phone ? (
        <Pressable onPress={() => callPhone(order.customer_phone!)}>
          <Text style={styles.link}>{order.customer_phone}</Text>
        </Pressable>
      ) : (
        <Text style={styles.muted}>No phone on file</Text>
      )}

      <Text style={styles.section}>Address</Text>
      <Text style={styles.value}>{order.shipping_address}</Text>

      <Pressable
        style={styles.secondaryButton}
        onPress={() =>
          openGoogleMaps(
            order.delivery_lat,
            order.delivery_lng,
            order.shipping_address
          )
        }
      >
        <Text style={styles.secondaryButtonText}>Open in Google Maps</Text>
      </Pressable>

      <Text style={styles.section}>Items</Text>
      {(order.order_items ?? []).map((item) => (
        <Text key={item.id} style={styles.item}>
          {item.name} × {item.quantity}
        </Text>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {active && order.status === "shipped" ? (
        <Pressable
          style={[styles.primaryButton, busy && styles.disabled]}
          onPress={onStart}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Start delivery</Text>
          )}
        </Pressable>
      ) : null}

      {active ? (
        <>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push({
                pathname: "/order/[id]/complete",
                params: { id: order.id, mode: "delivered" },
              })
            }
          >
            <Text style={styles.primaryButtonText}>Mark delivered (photo)</Text>
          </Pressable>
          <Pressable
            style={styles.dangerButton}
            onPress={() =>
              router.push({
                pathname: "/order/[id]/complete",
                params: { id: order.id, mode: "failed" },
              })
            }
          >
            <Text style={styles.dangerButtonText}>Delivery failed</Text>
          </Pressable>
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
  orderNumber: { fontSize: 20, fontWeight: "700", fontFamily: "monospace" },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  section: {
    marginTop: 20,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  value: { fontSize: 16, color: "#0F172A", lineHeight: 22 },
  link: { marginTop: 6, color: "#4F46E5", fontSize: 16, fontWeight: "600" },
  muted: { color: "#94A3B8" },
  item: { color: "#334155", marginBottom: 4 },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#4F46E5", fontWeight: "700" },
  primaryButton: {
    marginTop: 16,
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  dangerButton: {
    marginTop: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  dangerButtonText: { color: "#B91C1C", fontWeight: "700" },
  disabled: { opacity: 0.6 },
  error: { color: "#B91C1C", marginTop: 12 },
});
