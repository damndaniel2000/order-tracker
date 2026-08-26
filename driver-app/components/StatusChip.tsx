import { Chip, useTheme } from "react-native-paper";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

export function StatusChip({ status }: { status: OrderStatus }) {
  const theme = useTheme();

  return (
    <Chip
      compact
      style={{ backgroundColor: theme.colors.primaryContainer }}
      textStyle={{ color: theme.colors.onPrimaryContainer, fontWeight: "600" }}
    >
      {STATUS_LABELS[status]}
    </Chip>
  );
}
