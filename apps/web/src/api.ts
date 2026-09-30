/**
 * Typed API client (M6): types come from @fedites/config api-contracts —
 * the same zod schemas the server parses with. Session rides the HttpOnly
 * cookie (credentials: include).
 */
import type { GroupSummary, GroupsHome, GroupProfile, JoinRequest, ActivityFeed, CommentItem, ChatThread, ChatMessage, MemberHit, NewsResponse, FeedResponse, ReportItem } from "./phase2-types.js";
import type { EventListItem, EventCreateBody, EventUpdateBody, Ticket, EventTask, BudgetItem } from "./events-types.js";
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
  /* ---------------------- Phase 2: the daily loop ---------------------- */

  /* groups (2.1) */
  browseGroups: (): Promise<{ groups: GroupSummary[] }> => call("/v1/groups"),
  groupsHome: (): Promise<GroupsHome> => call("/v1/groups/home"),
  group: (id: string): Promise<GroupProfile> => call(`/v1/groups/${id}`),
  createGroup: (b: { type: string; name: string; description?: string }): Promise<{ id: string; status: string }> => post("/v1/groups", b),
  approveGroup: (id: string): Promise<{ ok: boolean }> => post(`/v1/groups/${id}/approve`),
  joinGroup: (id: string): Promise<{ joined: boolean; requested?: boolean; notifyLevel?: string }> => post(`/v1/groups/${id}/join`),
  leaveGroup: (id: string): Promise<{ ok: boolean }> => post(`/v1/groups/${id}/leave`),
  joinRequests: (id: string): Promise<{ requests: JoinRequest[] }> => call(`/v1/groups/${id}/requests`),
  decideJoinRequest: (id: string, requestId: string, decision: "approve" | "reject"): Promise<{ ok: boolean }> => post(`/v1/groups/${id}/requests/${requestId}`, { decision }),
  makeGroupAdmin: (id: string, memberId: string, isAdmin: boolean): Promise<{ ok: boolean }> => post(`/v1/groups/${id}/admins`, { memberId, isAdmin }),
  feedMute: (id: string, muted: boolean): Promise<{ ok: boolean }> => post(`/v1/groups/${id}/feed-mute`, { muted }),
  visitGroup: (id: string, tab: "activity" | "chat"): Promise<{ ok: boolean }> => post(`/v1/groups/${id}/visit`, { tab }),

  /* activity (2.2) */
  groupActivity: (id: string, before?: string): Promise<ActivityFeed> => call(`/v1/groups/${id}/activity${before ? `?before=${encodeURIComponent(before)}` : ""}`),
  postActivity: (id: string, b: { kind: "post" | "photo" | "file"; body?: string; mediaIds?: string[] }): Promise<{ id: string }> => post(`/v1/groups/${id}/activity`, b),
  createPoll: (id: string, b: { body?: string; options: string[] }): Promise<{ id: string }> => post(`/v1/groups/${id}/poll`, b),
  votePoll: (postId: string, optionId: string): Promise<{ ok: boolean }> => post(`/v1/activity/${postId}/vote`, { optionId }),
  comments: (postId: string): Promise<{ comments: CommentItem[] }> => call(`/v1/activity/${postId}/comments`),
  addComment: (postId: string, body: string, parentId?: string): Promise<{ id: string }> => post(`/v1/activity/${postId}/comments`, { body, parentId }),
  react: (postId: string, emoji: string): Promise<{ reactions: Record<string, number>; myReaction: string | null }> => post(`/v1/activity/${postId}/reactions`, { emoji }),
  pinPost: (postId: string): Promise<{ pinned: boolean }> => post(`/v1/activity/${postId}/pin`),
  promoteToNews: (postId: string): Promise<{ id: string }> => post(`/v1/activity/${postId}/promote`),
  markActivitySeen: (id: string): Promise<{ ok: boolean }> => post(`/v1/groups/${id}/activity/seen`),
  searchMembers: (q: string): Promise<{ members: MemberHit[] }> => call(`/v1/members/search?q=${encodeURIComponent(q)}`),

  /* chat (2.3) */
  chatThreads: (): Promise<{ threads: ChatThread[] }> => call("/v1/chat/threads"),
  threadMessages: (type: "group" | "dm", id: string): Promise<{ messages: ChatMessage[] }> => call(`/v1/chat/${type}/${id}/messages`),
  sendGroupMessage: (groupId: string, b: { body?: string; mediaId?: string; replyToId?: string }): Promise<ChatMessage> => post(`/v1/chat/group/${groupId}/messages`, b),
  sendDm: (otherId: string, b: { body?: string; mediaId?: string; replyToId?: string }): Promise<ChatMessage> => post(`/v1/chat/dm/${otherId}/messages`, b),
  editMessage: (id: string, body: string): Promise<{ ok: boolean }> => patch(`/v1/chat/messages/${id}`, { body }),
  deleteMessage: (id: string): Promise<{ ok: boolean }> => del(`/v1/chat/messages/${id}`),
  markThreadRead: (type: "group" | "dm", id: string): Promise<{ ok: boolean }> => post(`/v1/chat/${type}/${id}/read`),
  sendTyping: (type: "group" | "dm", id: string): Promise<{ ok: boolean }> => post(`/v1/chat/${type}/${id}/typing`),
  pinToFeed: (messageId: string): Promise<{ id: string }> => post(`/v1/chat/messages/${messageId}/pin`),

  /* news (2.4) */
  news: (): Promise<NewsResponse> => call("/v1/news"),
  postNews: (b: { body: string; commentsEnabled?: boolean }): Promise<{ id: string }> => post("/v1/news", b),

  /* feed (2.5) */
  feed: (): Promise<FeedResponse> => call("/v1/feed"),
  dismissRail: (key: string): Promise<{ ok: boolean }> => post(`/v1/feed/rails/${key}/dismiss`),

  /* events (3.1 + 3.2) */
  eventsList: (): Promise<{ upcoming: EventListItem[]; past: EventListItem[] }> => call("/v1/events"),
  eventDetail: (id: string): Promise<EventListItem> => call(`/v1/events/${id}`),
  createEvent: (b: EventCreateBody): Promise<{ id: string }> => post("/v1/events", b),
  updateEvent: (id: string, b: EventUpdateBody): Promise<{ ok: boolean }> => patch(`/v1/events/${id}`, b),
  rsvp: (id: string, response: "going" | "maybe" | "no"): Promise<{ counts: { going: number; maybe: number; checkedIn: number } }> => post(`/v1/events/${id}/rsvp`, { response }),
  myTicket: (id: string): Promise<Ticket> => call(`/v1/events/${id}/my-ticket`),
  checkIn: (id: string, code: string): Promise<{ ok: boolean; duplicate: boolean; counts: { checkedIn: number } }> => post(`/v1/events/${id}/check-in`, { code }),
  liveCounts: (id: string): Promise<{ counts: { going: number; maybe: number; checkedIn: number }; checkInOpen: boolean }> => call(`/v1/events/${id}/live-counts`),
  eventAttendees: (id: string): Promise<{ attendees: Array<{ memberId: string; name: string; response: string; checkedIn: boolean }> }> => call(`/v1/events/${id}/attendees`),
  eventTasks: (id: string): Promise<{ tasks: EventTask[]; budget: BudgetItem[] }> => call(`/v1/events/${id}/tasks`),
  addEventTask: (id: string, b: { title: string; assignee?: string; dueAt?: string }): Promise<{ id: string }> => post(`/v1/events/${id}/tasks`, b),
  updateEventTask: (id: string, taskId: string, b: { done?: boolean; title?: string; assignee?: string | null }): Promise<{ ok: boolean }> => patch(`/v1/events/${id}/tasks/${taskId}`, b),
  addBudgetItem: (id: string, b: { label: string; amountMinor: number; currency: string; kind: "planned" | "actual" }): Promise<{ id: string }> => post(`/v1/events/${id}/budget`, b),

  /* moderation (2.6) */
  report: (b: { postId?: string; messageId?: string; reason: string }): Promise<{ id: string }> => post("/v1/reports", b),
  reports: (): Promise<{ reports: ReportItem[] }> => call("/v1/reports"),
  decideReport: (id: string, decision: "remove-content" | "dismiss" | "escalate", resolution?: string): Promise<{ ok: boolean }> => post(`/v1/reports/${id}`, { decision, resolution }),

  /* media */
  uploadMedia: async (file: File): Promise<{ id: string; kind: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/v1/media`, { method: "POST", credentials: "include", body: form });
    if (!res.ok) throw new ApiError(res.status, "Upload failed. Try a smaller file.");
    return (await res.json()) as { id: string; kind: string };
  },
};

export type { SessionMember };
