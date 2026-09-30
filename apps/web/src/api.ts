/**
 * Typed API client (M6): types come from @fedites/config api-contracts —
 * the same zod schemas the server parses with. Session rides the HttpOnly
 * cookie (credentials: include).
 */
import type {
  SignupBody,
  LoginBody,
  SessionResponse,
  SessionMember,
  QueueItem,
  VerificationStatus,
  Invite,
  ProfileBody,
  MemberPublic,
  FamilyLink,
  IdCard,
  Inbox,
  ManageOverview,
  DecisionBody,
  RoleBody,
} from "@fedites/config";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, typeof body.error === "string" ? body.error : `Request failed (${res.status})`);
  return body as T;
}

const post = <T>(path: string, payload?: unknown): Promise<T> =>
  call<T>(path, { method: "POST", body: JSON.stringify(payload ?? {}) });
const patch = <T>(path: string, payload: unknown): Promise<T> =>
  call<T>(path, { method: "PATCH", body: JSON.stringify(payload) });
const del = <T>(path: string): Promise<T> => call<T>(path, { method: "DELETE" });

export const Api = {
  /* auth (1.1) */
  signup: (b: SignupBody): Promise<{ memberId: string; status: string }> => post("/v1/auth/signup", b),
  login: (b: LoginBody): Promise<{ token?: string }> => post("/v1/auth/login", b),
  logout: (): Promise<{ ok: boolean }> => post("/v1/auth/logout"),
  session: (): Promise<SessionResponse> => call("/v1/auth/session"),
  totpSetup: (): Promise<{ secret: string; otpauthUrl: string }> => post("/v1/auth/2fa/setup"),
  totpEnable: (code: string): Promise<{ ok: boolean }> => post("/v1/auth/2fa/enable", { code }),
  totpDisable: (code: string): Promise<{ ok: boolean }> => post("/v1/auth/2fa/disable", { code }),

  /* verification (1.2) */
  invites: (): Promise<{ invites: Invite[] }> => call("/v1/invites"),
  createInvite: (): Promise<{ code: string; expiresInDays: number }> => post("/v1/invites", {}),
  queue: (): Promise<{ queue: QueueItem[] }> => call("/v1/verification/queue"),
  decide: (b: DecisionBody): Promise<{ ok: boolean; status: string }> => post("/v1/verification/decision", b),
  vouch: (memberId: string): Promise<{ ok: boolean; vouchCount: number; verified: boolean }> => post("/v1/verification/vouch", { memberId }),
  verificationStatus: (): Promise<VerificationStatus> => call("/v1/verification/status"),

  /* profile (1.3) */
  updateProfile: (b: ProfileBody): Promise<{ ok: boolean }> => patch("/v1/me", b),
  member: (id: string): Promise<MemberPublic> => call(`/v1/members/${id}`),
  revealContact: (id: string): Promise<{ email: string; phone: string | null }> => post(`/v1/members/${id}/reveal-contact`),
  familyLinks: (): Promise<{ links: FamilyLink[] }> => call("/v1/me/family-links"),
  addFamilyLink: (relatedEmail: string, relation: string): Promise<{ ok: boolean }> => post("/v1/me/family-links", { relatedEmail, relation }),
  removeFamilyLink: (linkId: string): Promise<{ ok: boolean }> => del(`/v1/me/family-links/${linkId}`),
  idCard: (): Promise<IdCard> => call("/v1/me/id"),

  /* notifications + manage (1.4) */
  inbox: (): Promise<Inbox> => call("/v1/notifications"),
  markRead: (id: string): Promise<{ ok: boolean }> => post(`/v1/notifications/${id}/read`),
  markAllRead: (): Promise<{ ok: boolean }> => post("/v1/notifications/read-all"),
  manageOverview: (): Promise<ManageOverview> => call("/v1/manage/overview"),
  roles: (memberId: string): Promise<{ roles: string[] }> => call(`/v1/members/${memberId}/roles`),
  setRole: (memberId: string, b: RoleBody): Promise<{ ok: boolean }> => post(`/v1/members/${memberId}/roles`, b),
  removeRole: (memberId: string, roleKey: string): Promise<{ ok: boolean }> => del(`/v1/members/${memberId}/roles/${roleKey}`),
};

export type { SessionMember };
