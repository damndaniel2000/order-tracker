import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text, useTheme } from "react-native-paper";
import { router, useFocusEffect } from "expo-router";
import { fetchOrders } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type DriverOrder } from "@/lib/types";
import { StatusChip } from "@/components/StatusChip";

export default function OrdersScreen() {
  const { token, driver } = useAuth();
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

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
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.greeting}>
        Hi {driver?.displayName ?? "Driver"}
      </Text>
      <Text variant="bodyMedium" style={styles.meta}>
        {orders.length} active deliveries
      </Text>
      {error ? (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
        ListEmptyComponent={
          <Text variant="bodyMedium" style={styles.empty}>
            No active orders assigned.
          </Text>
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            mode="outlined"
            onPress={() => router.push(`/order/${item.id}`)}
          >
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleSmall" style={styles.orderNumber}>
                  {item.order_number}
                </Text>
                <StatusChip status={item.status} />
              </View>
              <Text variant="titleSmall" style={styles.customer}>
                {item.customer_name}
              </Text>
              <Text variant="bodySmall" style={styles.address} numberOfLines={2}>
                {item.shipping_address}
              </Text>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  greeting: { fontWeight: "700", color: "#0F172A" },
  meta: { color: "#64748B", marginBottom: 12 },
  error: { color: "#B91C1C", marginBottom: 8 },
  empty: { textAlign: "center", color: "#94A3B8", marginTop: 40 },
  card: { marginBottom: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: { fontFamily: "monospace", fontWeight: "700" },
  customer: { marginTop: 8, color: "#1E293B" },
  address: { marginTop: 4, color: "#64748B" },
});
