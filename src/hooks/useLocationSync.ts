import { useEffect } from "react";
import { readDeviceLocation } from "@/lib/expoLocation";
import { updateLocation } from "@/api/members";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "./useWebSocket";

/** How often we push GPS to the server for in-zone recipient matching. */
const SYNC_INTERVAL_MS = 30_000;

/**
 * Periodically publishes the device's GPS position to the server.
 * Prefers WebSocket **`LOCATION_UPDATE`** when connected; falls back to
 * **`POST /members/location`** when the socket is closed.
 */
export function useLocationSync(enabled: boolean) {
  const { token } = useAuth();
  const { status, sendMessage } = useWebSocket({
    token: enabled ? token : null,
    zoneIds: [],
    enabled: enabled && Boolean(token),
  });

  useEffect(() => {
    if (!enabled || !token) return;

    let cancelled = false;
    const push = async () => {
      const result = await readDeviceLocation({
        timeoutMs: 8000,
        allowLastKnown: false,
      });
      if (cancelled || !result) return;
      const latitude = result.coords.latitude;
      const longitude = result.coords.longitude;
      const sent =
        status === "open" &&
        sendMessage({
          type: "LOCATION_UPDATE",
          latitude,
          longitude,
        });
      if (!sent) {
        await updateLocation({ latitude, longitude });
      }
    };

    void push();
    const id = setInterval(() => {
      void push();
    }, SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, token, status, sendMessage]);
}
