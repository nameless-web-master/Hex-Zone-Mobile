import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { RecentServicesSection } from "@/components/dashboard/RecentServicesSection";
import { useAuth } from "@/context/AuthContext";
import { useFloatingTabBarInset } from "@/components/navigation/FloatingTabBar";

export default function RecentServicesScreen() {
  const { ownerZoneId } = useAuth();
  const tabBarInset = useFloatingTabBarInset();

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScreenHeader
          title="Recent services"
          subtitle="Latest SERVICE broadcasts for your zone"
          showBack
        />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: tabBarInset,
          }}
        >
          <RecentServicesSection
            zoneId={ownerZoneId || undefined}
            variant="page"
          />
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

