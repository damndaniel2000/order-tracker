import { Stack } from "expo-router";

export default function OrderLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Order detail" }} />
      <Stack.Screen
        name="complete"
        options={{ title: "Complete delivery", presentation: "modal" }}
      />
    </Stack>
  );
}
