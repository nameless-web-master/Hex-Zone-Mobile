import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react-native";
import { DateField } from "@/components/ui/DateField";
import { colors, radius } from "@/theme/colors";

type Props = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
};

function shortDate(ymd: string): string {
  const trimmed = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function summaryLabel(dateFrom: string, dateTo: string): string {
  const from = shortDate(dateFrom);
  const to = shortDate(dateTo);
  if (from && to) return `${from}–${to}`;
  if (from) return `From ${from}`;
  if (to) return `To ${to}`;
  return "Date";
}

/**
 * Compact date-range chip that sits in the filter chip row.
 * Opens a sheet with From / To pickers instead of taking a full second row.
 */
export function DateRangeFilterChip({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const active = Boolean(dateFrom.trim() || dateTo.trim());
  const display = summaryLabel(dateFrom, dateTo);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Date range: ${display}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.accentGlow : "#FFFFFF",
          maxWidth: 160,
        }}
      >
        <CalendarIcon
          size={14}
          color={active ? colors.accentDeep : colors.textMuted}
        />
        <Text
          numberOfLines={1}
          style={{
            color: active ? colors.accentDeep : colors.text,
            fontSize: 14,
            fontWeight: "600",
            flexShrink: 1,
          }}
        >
          {display}
        </Text>
        <ChevronDown
          size={16}
          color={active ? colors.accentDeep : colors.textMuted}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 44, 92, 0.35)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 28,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                alignItems: "center",
                paddingTop: 10,
                paddingBottom: 8,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.borderStrong,
                }}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingBottom: 12,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Date range
              </Text>
              {active ? (
                <Pressable
                  onPress={() => {
                    onDateFromChange("");
                    onDateToChange("");
                  }}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      color: colors.accent,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Clear
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                paddingHorizontal: 16,
              }}
            >
              <DateField
                value={dateFrom}
                onChange={onDateFromChange}
                placeholder="From"
                compact
                maximumDate={
                  dateTo.trim() ? new Date(dateTo + "T23:59:59") : undefined
                }
              />
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                to
              </Text>
              <DateField
                value={dateTo}
                onChange={onDateToChange}
                placeholder="To"
                compact
                minimumDate={
                  dateFrom.trim() ? new Date(dateFrom + "T00:00:00") : undefined
                }
              />
            </View>

            <Pressable
              onPress={() => setOpen(false)}
              style={{
                marginTop: 16,
                marginHorizontal: 16,
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}
              >
                Done
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
