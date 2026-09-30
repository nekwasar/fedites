/**
 * Policy endpoint — the server refusing is law (M5). Clients may hide buttons,
 * but enforcement lives here and reads the instance behavior config.
 */
import type { FastifyInstance } from "fastify";
import type { InstanceConfig } from "@fedites/config";
import { evaluate, type Action, type PolicySubject } from "./policy.js";

interface MemberRow {
  id: string;
  verification: string;
  roles: string[];
  group_admin_groups: string[];
  vouch_count: number;
}

export async function policyRoutes(
  app: FastifyInstance,
  opts: { loadConfig: (instanceId: string) => Promise<InstanceConfig> },
): Promise<void> {
  app.post<{
    Body: { instanceId: string; action: Action; member: MemberRow };
  }>("/v1/policy/check", async (request, reply) => {
    const { instanceId, action, member } = request.body;
    let config: InstanceConfig;
    try {
      config = await opts.loadConfig(instanceId);
    } catch {
      return reply.status(404).send({ error: "instance not found" });
    }

    const subject: PolicySubject = {
      verified: member.verification === "verified",
      honorary: member.verification === "honorary",
      roles: member.roles,
      groupAdminOf: member.group_admin_groups,
      vouchCount: member.vouch_count,
    };

    const knownActions: readonly string[] = [
      "dm.send","money.pay","event.rsvp","event.create","group.post","news.comment","vote.cast","face.search",
    ];
    if (!knownActions.includes(action)) {
      return reply.status(400).send({ error: `unknown action: ${String(action)}` });
    }

    return evaluate(config, action, subject);
  });
}
