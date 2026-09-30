/**
 * Realtime hook (2.3): one WebSocket per session; rooms subscribed on demand.
 * Reconnects with backoff; consumers get typed events. Badges refresh from
 * the API (authoritative counts — I5), WS only wakes the UI.
 */
import { useEffect, useRef, useState } from "react";

export type RealtimeEvent =
  | { type: "message.new"; thread: string; threadId: string; message: unknown }
  | { type: "message.edited"; messageId: string; body: string; editedAt: string }
  | { type: "message.deleted"; messageId: string }
  | { type: "typing"; thread: string; threadId: string; memberId: string; name: string }
  | { type: "read"; thread: string; threadId: string; memberId: string; at: string }
  | { type: "post.new"; groupId: string; postId: string }
  | { type: "comment.new"; groupId: string; postId: string }
  | { type: "news.new" }
  | { type: string; [k: string]: unknown };

export function useRealtime(apiUrl: string, signedIn: boolean, rooms: string[]): RealtimeEvent | null {
  const [event, setEvent] = useState<RealtimeEvent | null>(null);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let closed = false;
    let retry = 0;

    const connect = (): void => {
      const ws = new WebSocket(`${apiUrl.replace(/^http/, "ws")}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        for (const room of roomsRef.current) ws.send(JSON.stringify({ subscribe: room }));
      };
      ws.onmessage = (e) => {
        try {
          const parsed = JSON.parse(String(e.data)) as RealtimeEvent;
          if (parsed.type !== "ready") setEvent(parsed);
        } catch { /* ignore bad frames */ }
      };
      ws.onclose = () => {
        if (closed) return;
        setTimeout(connect, Math.min(1000 * 2 ** retry++, 15_000));
      };
    };
    connect();
    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, [apiUrl, signedIn]);

  return event;
}
