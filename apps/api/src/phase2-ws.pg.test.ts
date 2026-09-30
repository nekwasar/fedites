/**
 * Realtime hub integration (2.3): WebSocket auth, room subscriptions,
 * message/typing/read broadcast. Boots the app on a real port and connects
 * genuine ws clients. Runs when TEST_DATABASE_URL is set.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";
import type { Server } from "node:http";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

interface WsClient {
  ws: import("ws").WebSocket;
  next: (timeoutMs?: number) => Promise<Record<string, unknown>>;
}

async function openClient(port: number, token: string, rooms: string[]): Promise<WsClient> {
  const { WebSocket } = await import("ws");
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  await new Promise<void>((resolve) => {
    const onReady = (data: import("ws").RawData): void => {
      if (JSON.parse(String(data)).type === "ready") {
        ws.off("message", onReady);
        resolve();
      }
    };
    ws.on("message", onReady);
  });
  const buffer: Array<Record<string, unknown>> = [];
  const waiters: Array<(v: Record<string, unknown>) => void> = [];
  ws.on("message", (data) => {
    const parsed = JSON.parse(String(data)) as Record<string, unknown>;
    const w = waiters.shift();
    if (w) w(parsed);
    else buffer.push(parsed);
  });
  for (const room of rooms) ws.send(JSON.stringify({ subscribe: room }));
  return {
    ws,
    next: (timeoutMs = 3000) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const buffered = buffer.shift();
        if (buffered) return resolve(buffered);
        const timer = setTimeout(() => reject(new Error("timed out waiting for event")), timeoutMs);
        waiters.push((v) => {
          clearTimeout(timer);
          resolve(v);
        });
      }),
  };
}

describe("phase 2 — realtime hub", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let port = 0;
  let server: Server | undefined;
  let set98 = "";
  let aliceToken = "";
  let bobToken = "";

  beforeAll(async () => {
    if (!url) return;
    pool = createPool(url);
    await migrate(pool);
    await seed(pool);
    const instanceId = (await pool.query<{ id: string }>("SELECT id FROM instances LIMIT 1")).rows[0]!.id;
    const members = await pool.query<{ id: string; email: string }>("SELECT id, email FROM members WHERE instance_id = $1", [instanceId]);
    for (const m of members.rows) {
      await pool.query("UPDATE members SET password_hash = $1 WHERE id = $2", [await hashPassword("demopass123"), m.id]);
    }
    set98 = (await pool.query<{ id: string }>("SELECT id FROM groups WHERE name = $1", ["Set '98"])).rows[0]!.id;
    app = await buildApp({ pool, defaultInstanceId: instanceId });
    server = app.server;
    await app.listen({ port: 0, host: "127.0.0.1" });
    port = (server!.address() as { port: number }).port;
    app.attachHub();

    const loginA = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "member1@example.test", password: "demopass123" } });
    const loginB = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "member2@example.test", password: "demopass123" } });
    const bearerOf = (res: { json: () => { token?: string } }): string => res.json().token ?? "";
    aliceToken = bearerOf(loginA);
    bobToken = bearerOf(loginB);
  });

  afterAll(async () => {
    if (url) {
      server?.close();
      await pool.end();
    }
  });

  run("bad tokens are refused", async () => {
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=garbage`);
    const code = await new Promise<number>((resolve) => {
      ws.on("close", (c) => resolve(c));
    });
    expect(code).toBe(4001);
  });

  run("messages, typing and read receipts broadcast to the group room", async () => {
    const alice = await openClient(port, aliceToken, [`group:${set98}`]);
    const bob = await openClient(port, bobToken, [`group:${set98}`]);

    // typing indicator arrives at the other member
    const typingPromise = bob.next();
    await app.inject({
      method: "POST", url: `/v1/chat/group/${set98}/typing`,
      headers: { authorization: `Bearer ${aliceToken}` }, payload: {},
    });
    const typing = (await typingPromise) as { type: string };
    expect(typing.type).toBe("typing");

    // message lands live
    const messagePromise = bob.next();
    const send = await app.inject({
      method: "POST", url: `/v1/chat/group/${set98}/messages`,
      headers: { authorization: `Bearer ${aliceToken}` }, payload: { body: "Saturday, 4pm. Bring the trophies." },
    });
    expect(send.statusCode).toBe(200);
    const event = (await messagePromise) as { type: string; message: { body: string } };
    expect(event.type).toBe("message.new");
    expect(event.message.body).toContain("Saturday");

    // read receipt reaches the sender (skip any buffered events, e.g. the
    // sender's own read watermark or the other member's typing)
    let read: { type: string } | undefined;
    const readPromise = (async (): Promise<{ type: string }> => {
      for (;;) {
        const e = (await alice.next()) as { type: string };
        if (e.type === "read") return e;
      }
    })();
    await app.inject({
      method: "POST", url: `/v1/chat/group/${set98}/read`,
      headers: { authorization: `Bearer ${bobToken}` }, payload: {},
    });
    read = await readPromise;
    expect(read.type).toBe("read");

    alice.ws.close();
    bob.ws.close();
  });
});
