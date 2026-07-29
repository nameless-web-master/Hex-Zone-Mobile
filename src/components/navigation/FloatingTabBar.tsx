import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter, type Href } from "expo-router";
import { Home, Plus, QrCode, UserPlus, Users } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useBottomSafeInset } from "@/hooks/useBottomSafeInset";
import { colors } from "@/theme/colors";

type TabOptionsWithHref = BottomTabBarProps["descriptors"][string]["options"] & {
  href?: string | null;
};

function iconForRoute(name: string, color: string, size: number) {
  switch (name) {
    case "index":
      return <Home size={size} color={color} strokeWidth={2.25} />;
    case "members":
      return <Users size={size} color={color} strokeWidth={2.25} />;
    case "access-admin":
      return <QrCode size={size} color={color} strokeWidth={2.25} />;
    case "guest":
      return <UserPlus size={size} color={color} strokeWidth={2.25} />;
    default:
      return <Home size={size} color={color} strokeWidth={2.25} />;
  }
}

/** Pill height + gap above the home-indicator / nav bar. */
export const FLOATING_TAB_BAR_HEIGHT = 56;

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const bottomInset = useBottomSafeInset();
  const router = useRouter();
  const { user } = useAuth();

  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key].options as TabOptionsWithHref;
    if (options.href === null) return false;
    if (options.tabBarButton === null) return false;
    const itemStyle = options.tabBarItemStyle as { display?: string } | undefined;
    if (itemStyle?.display === "none") return false;
    return true;
  });

  const openNewMessage = () => {
    router.push({
      pathname: "/(tabs)/messages",
      params: {
        compose: "1",
        n: String(Date.now()),
      },
    } as unknown as Href);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(bottomInset, 8) + 6,
        paddingHorizontal: 16,
        backgroundColor: "transparent",
      }}
    >
      {/* Centered nav pill */}
      <View
        pointerEvents="box-none"
        style={{
          alignItems: "center",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            backgroundColor: "#FFFFFF",
            borderRadius: 999,
            paddingVertical: 8,
            paddingHorizontal: 6,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#0F2C5C",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 14,
            elevation: 10,
          }}
        >
          {visibleRoutes.map((route) => {
            const focused = state.index === state.routes.indexOf(route);
            const { options } = descriptors[route.key];
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : typeof options.title === "string"
                  ? options.title
                  : route.name;
            const color = focused ? colors.accent : colors.textDim;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                onLongPress={() => {
                  navigation.emit({
                    type: "tabLongPress",
                    target: route.key,
                  });
                }}
                style={{
                  minWidth: 64,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: focused ? colors.accentGlow : "transparent",
                }}
              >
                {iconForRoute(route.name, color, 20)}
                <Text
                  style={{
                    color,
                    fontSize: 10,
                    fontWeight: focused ? "700" : "600",
                  }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Same baseline, pinned to the right */}
      {user ? (
        <Pressable
          onPress={openNewMessage}
          accessibilityRole="button"
          accessibilityLabel="New message"
          style={{
            position: "absolute",
            right: 16,
            bottom: Math.max(bottomInset, 8) + 6,
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Space to keep content above the floating pill (includes typical safe inset).
 * Prefer `useFloatingTabBarInset()` when the safe area is available.
 */
export const FLOATING_TAB_BAR_CONTENT_INSET = 78;

export function useFloatingTabBarInset(): number {
  const bottomInset = useBottomSafeInset();
  return FLOATING_TAB_BAR_HEIGHT + Math.max(bottomInset, 8) + 14;
}
