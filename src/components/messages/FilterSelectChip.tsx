import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { colors, radius } from "@/theme/colors";

export type FilterSelectOption = {
  value: string;
  label: string;
};

type Props = {
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  /** When true, chip uses a soft filled style (selected / non-default). */
  emphasized?: boolean;
};

/**
 * Marketplace-style select chip: bordered pill + chevron that opens a picker sheet.
 */
export function FilterSelectChip({
  label,
  value,
  options,
  onChange,
  emphasized = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? options[0],
    [options, value],
  );
  const display = selected?.label ?? label;
  const active = emphasized || (value !== "all" && value !== "");

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
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
          maxWidth: 220,
        }}
      >
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
              maxHeight: "70%",
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
            <Text
              style={{
                color: colors.text,
                fontSize: 16,
                fontWeight: "700",
                paddingHorizontal: 20,
                paddingBottom: 10,
              }}
            >
              {label}
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 12,
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: isSelected
                        ? colors.accentGlow
                        : "transparent",
                      marginBottom: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? colors.accentDeep : colors.text,
                        fontSize: 15,
                        fontWeight: isSelected ? "700" : "500",
                        flex: 1,
                        paddingRight: 12,
                      }}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Check size={18} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
