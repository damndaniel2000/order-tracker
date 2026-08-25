import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { fetchOrders } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STATUS_LABELS, type DriverOrder } from "@/lib/types";

export default function OrdersScreen() {
  const { token, driver } = useAuth();
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchOrders(token);
      setOrders(data.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading && orders.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hi {driver?.displayName ?? "Driver"}</Text>
      <Text style={styles.meta}>{orders.length} active deliveries</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No active orders assigned.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/order/${item.id}`)}
          >
            <View style={styles.row}>
              <Text style={styles.orderNumber}>{item.order_number}</Text>
              <Text style={styles.badge}>{STATUS_LABELS[item.status]}</Text>
            </View>
            <Text style={styles.customer}>{item.customer_name}</Text>
            <Text style={styles.address} numberOfLines={2}>
              {item.shipping_address}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  greeting: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  meta: { color: "#64748B", marginBottom: 12 },
  error: { color: "#B91C1C", marginBottom: 8 },
  empty: { textAlign: "center", color: "#94A3B8", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: { fontFamily: "monospace", fontWeight: "700", fontSize: 15 },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  customer: { marginTop: 8, fontWeight: "600", color: "#1E293B" },
  address: { marginTop: 4, color: "#64748B", fontSize: 13 },
});
