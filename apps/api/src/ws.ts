/**
 * Realtime hub (2.3): WebSockets with session-token auth. Rooms:
 *   group:<groupId>  — every group's chat + activity events
 *   dm:<a>:<b>       — sorted pair
 *   member:<id>      — personal (notifications, receipts)
 * Clients receive: message.new / message.edited / message.deleted /
 * typing / read / post.new / notification. Server pings to keep alive.
 */
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import { loadSessionMember } from "./sessions.js";
import type { Pool } from "pg";

interface Client {
  socket: WebSocket;
  memberId: string;
  instanceId: string;
  rooms: Set<string>;
}

export class Hub {
  private clients = new Set<Client>();

  attach(server: Server, pool: Pool): WebSocketServer {
    const wss = new WebSocketServer({ server, path: "/ws" });
    wss.on("connection", (socket, request) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        socket.close(4001, "sign in required");
        return;
      }
      // Frames may arrive before auth resolves; buffer them.
      const pendingFrames: string[] = [];
      let registered = false;
      socket.on("message", (data) => {
        if (!registered) {
          pendingFrames.push(String(data));
          return;
        }
      });
      void loadSessionMember(pool, token).then((member) => {
        if (!member) {
          socket.close(4001, "sign in required");
          return;
        }
        const client: Client = { socket, memberId: member.id, instanceId: member.instanceId, rooms: new Set([`member:${member.id}`]) };
        this.clients.add(client);
        socket.on("pong", () => { /* liveness only */ });
        socket.on("close", () => this.clients.delete(client));
        socket.on("error", () => this.clients.delete(client));
        socket.on("message", (data) => {
          // Clients only send room subscriptions here; all real actions go
          // through the HTTP API (M5 — enforcement stays at the API).
          try {
            const parsed = JSON.parse(String(data)) as { subscribe?: string };
            if (typeof parsed.subscribe === "string" && /^[\w:.-]+$/.test(parsed.subscribe)) {
              client.rooms.add(parsed.subscribe);
            }
          } catch {
            socket.close(4002, "bad frame");
          }
        });
        // Replay frames that arrived during auth, then signal readiness.
        for (const frame of pendingFrames.splice(0)) {
          socket.emit("message", Buffer.from(frame));
        }
        registered = true;
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: "ready" }));
      });
    });

    const interval = setInterval(() => {
      for (const c of this.clients) {
        if (c.socket.readyState === c.socket.OPEN) c.socket.ping();
      }
    }, 30_000);
    wss.on("close", () => clearInterval(interval));
    return wss;
  }

  /** Members of an instance currently connected (presence truth). */
  connectedMembers(instanceId: string): string[] {
    const ids = new Set<string>();
    for (const c of this.clients) {
      if (c.instanceId === instanceId && c.socket.readyState === c.socket.OPEN) ids.add(c.memberId);
    }
    return [...ids];
  }

  /** Send one event to every connected client (e.g. F6 goal moment). */
  broadcastAll(event: Record<string, unknown>): void {
    const payload = JSON.stringify(event);
    for (const c of this.clients) {
      if (c.socket.readyState === c.socket.OPEN) c.socket.send(payload);
    }
  }

  /** Broadcast an event to every room; recipients must be authenticated clients. */
  broadcast(rooms: string[], event: Record<string, unknown>): void {
    const payload = JSON.stringify(event);
    for (const c of this.clients) {
      if (c.socket.readyState !== c.socket.OPEN) continue;
      if (rooms.some((r) => c.rooms.has(r))) {
        c.socket.send(payload);
      }
    }
  }

  /** Room names for a DM pair (sorted so both members share one room). */
  static dmRoom(a: string, b: string): string {
    return `dm:${[a, b].sort().join(":")}`;
  }

  static groupRoom(groupId: string): string {
    return `group:${groupId}`;
  }

  static memberRoom(memberId: string): string {
    return `member:${memberId}`;
  }
}

/** Compute the rooms a member should hear a thread event in. */
export function threadRooms(thread: { type: "group" | "dm"; groupId?: string; a?: string; b?: string }): string[] {
  if (thread.type === "group" && thread.groupId) return [Hub.groupRoom(thread.groupId)];
  if (thread.a && thread.b) return [Hub.dmRoom(thread.a, thread.b)];
  return [];
}
