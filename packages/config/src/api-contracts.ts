/**
 * API contracts (M6): request/response schemas shared by the API (parsing)
 * and the clients (types via z.infer). Phase 1 identity rails.
 */
import { z } from "zod";

export const visibilitySchema = z.object({
  contact: z.enum(["private", "members"]).default("private"),
  birthday: z.enum(["private", "set", "members"]).default("private"),
});
export type Visibility = z.infer<typeof visibilitySchema>;

/* ------------------------------- auth ------------------------------- */

export const signupBodySchema = z.object({
  inviteCode: z.string().min(4).max(40),
  email: z.string().email(),
  password: z.string().min(1),
  displayName: z.string().min(2).max(80),
  setYear: z.number().int().min(1900).max(2100).optional(),
});
export type SignupBody = z.infer<typeof signupBodySchema>;

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const sessionMemberSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  verification: z.enum(["pending", "limited", "verified", "honorary", "rejected"]),
  roles: z.array(z.string()),
  totpEnabled: z.boolean(),
  email: z.string(),
  phone: z.string().nullable(),
});
export type SessionMember = z.infer<typeof sessionMemberSchema>;

export const sessionResponseSchema = z.object({ member: sessionMemberSchema.nullable() });
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/* --------------------------- verification --------------------------- */

export const decisionBodySchema = z.object({
  memberId: z.string().uuid(),
  decision: z.enum(["activate", "verify", "honorary", "reject"]),
  setYear: z.number().int().optional(),
});
export type DecisionBody = z.infer<typeof decisionBodySchema>;

export const queueItemSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  email: z.string(),
  verification: z.string(),
  set_year: z.number().nullable(),
  vouch_count: z.number(),
  created_at: z.string(),
});
export type QueueItem = z.infer<typeof queueItemSchema>;

export const verificationStatusSchema = z.object({
  verification: z.string(),
  vouchCount: z.number(),
  vouchesRequired: z.number(),
  setYear: z.number().nullable(),
});
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const inviteSchema = z.object({
  code: z.string(),
  used_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
});
export type Invite = z.infer<typeof inviteSchema>;

/* ------------------------------ profile ----------------------------- */

export const profileBodySchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  bio: z.string().max(500).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  profession: z.string().max(120).optional(),
  favoriteMemory: z.string().max(500).optional(),
  photoUrl: z.string().max(400).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  visibility: visibilitySchema.optional(),
});
export type ProfileBody = z.infer<typeof profileBodySchema>;

export const memberPublicSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  verification: z.string(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  profession: z.string().nullable(),
  photoUrl: z.string().nullable(),
  favoriteMemory: z.string().nullable(),
  setYear: z.number().nullable(),
  house: z.string().nullable(),
  contactVisible: z.boolean(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export type MemberPublic = z.infer<typeof memberPublicSchema>;

export const familyLinkSchema = z.object({
  id: z.string().uuid(),
  related_id: z.string().uuid(),
  relation: z.string(),
  name: z.string(),
});
export type FamilyLink = z.infer<typeof familyLinkSchema>;

export const idCardSchema = z.object({
  card: z.object({
    holder: z.string(),
    setYear: z.number().nullable(),
    house: z.string().nullable(),
    verification: z.string(),
    memberSince: z.string(),
    school: z.string(),
    profileUrl: z.string(),
  }),
  qrSvg: z.string(),
});
export type IdCard = z.infer<typeof idCardSchema>;

/* -------------------------- notifications --------------------------- */

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  title: z.string(),
  payload: z.record(z.string(), z.unknown()),
  read: z.boolean(),
  createdAt: z.string(),
});
export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const inboxSchema = z.object({
  items: z.array(notificationItemSchema),
  unread: z.number(),
});
export type Inbox = z.infer<typeof inboxSchema>;

/* ------------------------------ manage ------------------------------ */

export const manageOverviewSchema = z.object({
  stats: z.object({
    pending: z.string(),
    limited: z.string(),
    verified: z.string(),
    honorary: z.string(),
    groups: z.string(),
    events: z.string(),
  }),
});
export type ManageOverview = z.infer<typeof manageOverviewSchema>;

export const roleBodySchema = z.object({
  roleKey: z.enum(["president", "treasurer", "secretary", "moderator", "editor", "member"]),
});
export type RoleBody = z.infer<typeof roleBodySchema>;

/* ------------------------------- events ------------------------------ */

export const eventCreateSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  venue: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  groupId: z.string().uuid().optional(),
  virtualLink: z.string().url().max(400).optional(),
  anniversary: z.boolean().optional(),
});
export type EventCreateBody = z.infer<typeof eventCreateSchema>;

export const eventUpdateSchema = eventCreateSchema.partial().extend({
  checkInOpen: z.boolean().optional(),
});
export type EventUpdateBody = z.infer<typeof eventUpdateSchema>;

export const rsvpSchema = z.object({ response: z.enum(["going", "maybe", "no"]) });
export type RsvpBody = z.infer<typeof rsvpSchema>;

export interface EventListItem {
  id: string; title: string; startsAt: string; endsAt: string | null;
  venue: string | null; city: string | null; description: string | null;
  virtualLink: string | null; anniversary: boolean;
  groupId: string | null; groupName: string | null;
  goingCount: number; myResponse: "going" | "maybe" | "no" | null;
  organizer: boolean; createdAt: string;
}

export interface EventCounts { going: number; maybe: number; checkedIn: number }

export interface EventTask { id: string; title: string; assignee: string | null; assigneeName: string | null; dueAt: string | null; done: boolean }
export interface BudgetItem { id: string; label: string; amountMinor: number; currency: string; kind: "planned" | "actual" }

export const ticketSchema = z.object({
  payload: z.string(),
  qrSvg: z.string(),
  eventTitle: z.string(),
  startsAt: z.string(),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const ticketScanSchema = z.object({ code: z.string().min(20).max(300) });
export type TicketScan = z.infer<typeof ticketScanSchema>;

/* -------------------------------- money ------------------------------ */

export const tierCreateSchema = z.object({
  name: z.string().min(1).max(60),
  amountMinor: z.number().int().min(0),
  currency: z.string().length(3),
  cycle: z.enum(["annual", "semiannual", "quarterly", "monthly", "one-time"]).default("annual"),
  perks: z.object({
    voting: z.boolean().optional(),
    eventPriority: z.boolean().optional(),
    idMarking: z.boolean().optional(),
  }).default({}),
});
export type TierCreateBody = z.infer<typeof tierCreateSchema>;

export const markPaidSchema = z.object({
  reference: z.string().max(120).optional(),
});
export type MarkPaidBody = z.infer<typeof markPaidSchema>;

export const payDuesSchema = z.object({ tierId: z.string().uuid().optional() });
export type PayDuesBody = z.infer<typeof payDuesSchema>;

export interface DuesAssessmentView {
  id: string; period: string; amountMinor: number; currency: string;
  dueDate: string; status: "due" | "paid" | "overdue" | "waived";
  tierName: string | null; receiptNo: string | null;
}
export interface LedgerRow {
  id: string; kind: string; amountMinor: number; currency: string;
  memo: string | null; status: "pending" | "confirmed" | "voided";
  receiptNo: string | null; createdAt: string;
}
export interface TierView {
  id: string; name: string; amountMinor: number; currency: string; cycle: string;
  perks: { voting?: boolean; eventPriority?: boolean; idMarking?: boolean };
}
export interface PaymentIntentView {
  id: string; amountMinor: number; currency: string; purpose: string;
  provider: string; status: string; createdAt: string;
}
