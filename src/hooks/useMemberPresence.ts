import { useCallback, useEffect, useState } from "react";
import { getMembers } from "@/api/members";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { parseMemberPresenceSocketEvent } from "@/lib/messageSocket";

export type MemberPresenceMap = Record<number, boolean>;

/**
 * Live owner online/offline map seeded from /members and updated by
 * MEMBER_PRESENCE WebSocket frames.
 */
export function useMemberPresence(): {
  presence: MemberPresenceMap;
  isOnline: (ownerId: number | null | undefined) => boolean;
} {
  const { token } = useAuth();
  const [presence, setPresence] = useState<MemberPresenceMap>({});
  const { lastMessage } = useWebSocket({
    token,
    zoneIds: [],
    enabled: Boolean(token),
  });

  useEffect(() => {
    let active = true;
    void getMembers().then((res) => {
      if (!active || res.error) return;
      const next: MemberPresenceMap = {};
      for (const row of res.data ?? []) {
        const id = Number(row.id);
        if (!Number.isFinite(id) || id <= 0) continue;
        next[id] = row.online === true;
      }
      setPresence(next);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    const evt = parseMemberPresenceSocketEvent(lastMessage);
    if (!evt) return;
    setPresence((prev) => {
      if (prev[evt.ownerId] === evt.online) return prev;
      return { ...prev, [evt.ownerId]: evt.online };
    });
  }, [lastMessage]);

  const isOnline = useCallback(
    (ownerId: number | null | undefined) => {
      if (ownerId == null || !Number.isFinite(ownerId) || ownerId <= 0) {
        return false;
      }
      return presence[ownerId] === true;
    },
    [presence],
  );

  return { presence, isOnline };
}
