import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar as CalendarIcon } from "lucide-react-native";
import { Calendar } from "react-native-calendars";
import { colors } from "@/theme/colors";

function parseYmd(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(value: string): string {
  const date = parseYmd(value);
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type DateFieldProps = {
  value: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  /** Narrower chip for filter rows; hides the under-field Clear spacer. */
  compact?: boolean;
};

export function DateField({
  value,
  onChange,
  placeholder = "Select date",
  maximumDate,
  minimumDate,
  compact = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const label = formatDisplay(value);
  const hasValue = Boolean(label);
  const current = value.trim() || toYmd(new Date());

  const markedDates = useMemo(() => {
    if (!value.trim()) return {};
    return {
      [value.trim()]: {
        selected: true,
        selectedColor: colors.accent,
        selectedTextColor: "#FFFFFF",
      },
    };
  }, [value]);

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        style={({ pressed }) => [
          styles.field,
          compact ? styles.fieldCompact : null,
          pressed ? styles.fieldPressed : null,
        ]}
      >
        <View style={styles.fieldInner}>
          <CalendarIcon size={compact ? 14 : 16} color={colors.accent} strokeWidth={2.2} />
          <Text
            style={[
              styles.value,
              compact ? styles.valueCompact : null,
              !hasValue && styles.placeholder,
            ]}
            numberOfLines={1}
          >
            {hasValue ? (compact ? shortDisplay(value) : label) : placeholder}
          </Text>
        </View>
      </Pressable>

      {!compact ? (
        hasValue ? (
          <Pressable
            onPress={() => onChange("")}
            hitSlop={8}
            accessibilityLabel={`Clear ${placeholder}`}
            style={styles.clearBtn}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : (
          <View style={styles.clearSpacer} />
        )
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{placeholder}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <Calendar
              current={current}
              markedDates={markedDates}
              onDayPress={(day) => {
                onChange(day.dateString);
                setOpen(false);
              }}
              minDate={minimumDate ? toYmd(minimumDate) : undefined}
              maxDate={maximumDate ? toYmd(maximumDate) : undefined}
              enableSwipeMonths
              theme={{
                backgroundColor: "#FFFFFF",
                calendarBackground: "#FFFFFF",
                textSectionTitleColor: colors.textMuted,
                selectedDayBackgroundColor: colors.accent,
                selectedDayTextColor: "#FFFFFF",
                todayTextColor: colors.accent,
                dayTextColor: colors.text,
                textDisabledColor: colors.textDim,
                arrowColor: colors.accent,
                monthTextColor: colors.text,
                textDayFontWeight: "600",
                textMonthFontWeight: "700",
                textDayHeaderFontWeight: "700",
                textDayFontSize: 14,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 12,
              }}
              style={styles.calendar}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function shortDisplay(value: string): string {
  const date = parseYmd(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
  },
  wrapCompact: {
    flex: 1,
    minWidth: 96,
    maxWidth: 140,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldCompact: {
    borderRadius: 9999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldPressed: {
    opacity: 0.85,
  },
  fieldInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  value: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  valueCompact: {
    fontSize: 13,
  },
  placeholder: {
    color: colors.textDim,
    fontWeight: "500",
  },
  clearBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 2,
    minHeight: 16,
  },
  clearSpacer: {
    height: 20,
  },
  clearText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "600",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 44, 92, 0.28)",
  },
  sheet: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    paddingBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  calendar: {
    borderRadius: 12,
  },
});
