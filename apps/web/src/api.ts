/**
 * Typed API client (M6): types come from @fedites/config api-contracts —
 * the same zod schemas the server parses with. Session rides the HttpOnly
 * cookie (credentials: include).
 */
import type { GroupSummary, GroupsHome, GroupProfile, JoinRequest, ActivityFeed, CommentItem, ChatThread, ChatMessage, MemberHit, NewsResponse, FeedResponse, ReportItem, RecognitionMe } from "./phase2-types.js";
import type { EventListItem, EventCreateBody, EventUpdateBody, Ticket, EventTask, BudgetItem, PhotoWallItem, MoneyOverview, ReceiptView, TierView, TierCreateBody, AdminDuesRow, CampaignView, DonorWall, TransparentLedger, DonationSchedule, P2pView, PledgeView, ReimbView, SponsorView, ScholarshipView, Publication, Era, MemoryItem, Yearbook, YearbookDetail, MemorialView, WikiPage } from "./events-types.js";
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
const put = <T>(path: string, payload: unknown): Promise<T> =>
  call<T>(path, { method: "PUT", body: JSON.stringify(payload) });
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

  /* photo wall + face finder (3.3) */
  eventPhotos: (id: string): Promise<{ photos: PhotoWallItem[] }> => call(`/v1/events/${id}/photos`),
  uploadEventPhoto: async (eventId: string, file: File): Promise<{ id: string }> => {
    const media = await Api.uploadMedia(file);
    return post(`/v1/events/${eventId}/photos`, { mediaId: media.id });
  },
  tagPhoto: (eventId: string, photoId: string, memberId: string): Promise<{ ok: boolean }> => post(`/v1/events/${eventId}/photos/${photoId}/tags`, { memberId }),
  faceStatus: (): Promise<{ optIn: boolean; enrolled: boolean }> => call("/v1/me/face/status"),
  faceOptIn: (enabled: boolean): Promise<{ ok: boolean }> => post("/v1/me/face/opt-in", { enabled }),
  faceEnroll: async (file: File): Promise<{ ok: boolean; provider: string }> => {
    const media = await Api.uploadMedia(file);
    return post("/v1/me/face/reference", { mediaId: media.id });
  },
  faceDelete: (): Promise<{ ok: boolean }> => del("/v1/me/face/reference"),
  findMe: (eventId: string): Promise<{ matches: Array<{ photoId: string; mediaId: string; score: number }> }> => call(`/v1/events/${eventId}/find-me`),

  /* recognition + personalization (3.4) */
  myRecognition: (): Promise<RecognitionMe> => call("/v1/recognition/me"),
  memberRecognition: (id: string): Promise<{ badges: Array<{ badge: string; title: string; awardedAt: string }> }> => call(`/v1/members/${id}/recognition`),
  awardBadge: (memberId: string, badge: string): Promise<{ ok: boolean }> => post("/v1/recognition/award", { memberId, badge }),
  getIntents: (): Promise<{ intents: string[]; options: string[] }> => call("/v1/me/intents"),
  setIntents: (intents: string[]): Promise<{ ok: boolean }> => post("/v1/me/intents", { intents }),
  getNotifyPrefs: (): Promise<{ prefs: { mentions: string; events: string; news: string } }> => call("/v1/me/notification-prefs"),
  setNotifyPrefs: (b: { mentions?: string; events?: string; news?: string }): Promise<{ ok: boolean }> => post("/v1/me/notification-prefs", b),
  tuneGroup: (id: string, more: boolean): Promise<{ affinity: number }> => post(`/v1/groups/${id}/tune`, { more }),

  /* money (Phase 4 batch 1) */
  moneyOverview: (): Promise<MoneyOverview> => call("/v1/money/overview"),
  payDues: (assessmentId: string): Promise<{ intentId: string; provider: string; status: string }> => post(`/v1/money/dues/${assessmentId}/pay`, {}),
  receipt: (ledgerId: string): Promise<ReceiptView> => call(`/v1/money/receipts/${ledgerId}`),
  moneyTiers: (): Promise<{ tiers: TierView[] }> => call("/v1/money/tiers"),
  createTier: (b: TierCreateBody): Promise<{ id: string }> => post("/v1/manage/money/tiers", b),
  assignTier: (memberId: string, tierId: string): Promise<{ ok: boolean }> => post(`/v1/manage/money/members/${memberId}/tier`, { tierId }),
  runAssessments: (b: { period: string; amountMinor?: number; tierId?: string | null; currency?: string; dueDate?: string }): Promise<{ created: number }> => post("/v1/manage/money/assessments/run", b),
  adminDues: (status?: string): Promise<{ assessments: AdminDuesRow[] }> => call(`/v1/manage/money/dues${status ? `?status=${status}` : ""}`),
  markDuesPaid: (assessmentId: string, reference?: string): Promise<{ receiptNo: string; ledgerId: string }> => post(`/v1/manage/money/dues/${assessmentId}/mark-paid`, { reference }),
  waiveDues: (assessmentId: string): Promise<{ ok: boolean }> => post(`/v1/manage/money/dues/${assessmentId}/waive`, {}),
  runReminders: (): Promise<{ sent: number }> => post("/v1/manage/money/reminders/run", {}),

  /* giving (4.3) */
  campaigns: (): Promise<{ campaigns: CampaignView[] }> => call("/v1/money/campaigns"),
  campaignDonors: (id: string): Promise<DonorWall> => call(`/v1/money/campaigns/${id}/donors`),
  donate: (b: { amountMinor: number; currency: string; campaignId?: string; anonymous: boolean }): Promise<{ intentId: string; provider: string; status: string }> => post("/v1/money/donate", b),
  createSchedule: (amountMinor: number, currency: string, frequency: "monthly" | "quarterly" | "annually", campaignId?: string): Promise<{ id: string }> => post("/v1/money/schedules", { amountMinor, currency, frequency, campaignId }),
  cancelSchedule: (id: string): Promise<{ ok: boolean }> => del(`/v1/money/schedules/${id}`),
  transparentLedger: (): Promise<TransparentLedger> => call("/v1/money/transparent-ledger"),
  createCampaign: (b: { title: string; description?: string; goalMinor: number; currency: string; deadline?: string }): Promise<{ id: string }> => post("/v1/manage/money/campaigns", b),
  closeCampaign: (id: string): Promise<{ ok: boolean }> => post(`/v1/manage/money/campaigns/${id}/close`, {}),
  moneyIntents: (): Promise<{ intents: Array<{ id: string; memberName: string; amountMinor: number; currency: string; purpose: string; campaign: string | null }> }> => call("/v1/manage/money/intents"),
  schedules: (): Promise<{ schedules: DonationSchedule[] }> => call("/v1/money/schedules"),
  confirmIntent: (id: string, reference?: string): Promise<{ receiptNo: string; ledgerId: string }> => post(`/v1/manage/money/intents/${id}/confirm`, { reference }),

  /* structured giving (4.4) */
  createP2p: (b: { title: string; story?: string; goalMinor: number; currency: string }): Promise<{ id: string }> => post("/v1/money/p2p", b),
  listP2p: (): Promise<{ fundraisers: P2pView[] }> => call("/v1/money/p2p"),
  giveP2p: (id: string, b: { amountMinor: number; currency: string }): Promise<{ intentId: string }> => post(`/v1/money/p2p/${id}/donate`, b),
  p2pQueue: (): Promise<{ pending: Array<{ id: string; title: string; story: string | null; goal_minor: string; currency: string; creator_name: string }> }> => call("/v1/manage/money/p2p"),
  decideP2p: (id: string, decision: "approve" | "reject"): Promise<{ ok: boolean }> => post(`/v1/manage/money/p2p/${id}`, { decision }),
  createPledge: (b: { amountMinor: number; currency: string; dueDate?: string }): Promise<{ id: string }> => post("/v1/money/pledges", b),
  myPledges: (): Promise<{ pledges: PledgeView[] }> => call("/v1/money/pledges"),
  fulfilPledge: (id: string): Promise<{ intentId: string }> => post(`/v1/money/pledges/${id}/fulfil`, {}),
  nudgePledges: (): Promise<{ sent: number }> => post("/v1/manage/money/pledges/nudge-run", {}),
  submitReimbursement: (b: { amountMinor: number; currency: string; memo: string; receiptMediaId?: string }): Promise<{ id: string }> => post("/v1/money/reimbursements", b),
  myReimbursements: (): Promise<{ claims: ReimbView[] }> => call("/v1/money/reimbursements"),
  reimbursementQueue: (): Promise<{ claims: Array<{ id: string; member_name: string; amount_minor: string; currency: string; memo: string; receipt_media: string | null }> }> => call("/v1/manage/money/reimbursements"),
  decideReimbursement: (id: string, decision: "approve" | "reject"): Promise<{ ok: boolean }> => post(`/v1/manage/money/reimbursements/${id}`, { decision }),
  sponsors: (): Promise<{ sponsors: SponsorView[] }> => call("/v1/money/sponsors"),
  recordSponsorship: (b: { sponsorName: string; tier: string; amountMinor: number; currency: string; recognition?: string }): Promise<{ id: string }> => post("/v1/manage/money/sponsorships", b),
  confirmSponsorship: (id: string): Promise<{ ok: boolean }> => post(`/v1/manage/money/sponsorships/${id}/confirm`, {}),
  listScholarships: (): Promise<{ scholarships: ScholarshipView[] }> => call("/v1/money/scholarships"),
  createScholarship: (b: { name: string; description?: string; endowedMinor: number; currency: string }): Promise<{ id: string }> => post("/v1/manage/money/scholarships", b),
  applyScholarship: (id: string, b: { studentName: string; studentClass?: string; statement: string }): Promise<{ id: string }> => post(`/v1/money/scholarships/${id}/apply`, b),
  scholarshipApplications: (id: string): Promise<{ applications: Array<{ id: string; student_name: string; student_class: string | null; statement: string; submitted_by_name: string; status: string }> }> => call(`/v1/manage/money/scholarships/${id}/applications`),
  decideApplication: (id: string, decision: "screen" | "select" | "reject" | "disburse", amountMinor?: number): Promise<{ ok: boolean }> => post(`/v1/manage/money/applications/${id}`, { decision, amountMinor }),
  publishLedger: (period: string): Promise<{ id: string }> => post("/v1/manage/money/ledger/publish", { period }),
  publications: (): Promise<{ publications: Publication[] }> => call("/v1/money/publications"),
  tribute: (b: { amountMinor: number; currency: string; tributeName: string; tributeKind: "memory" | "honor" | "birthday"; anonymous: boolean }): Promise<{ intentId: string }> => post("/v1/money/tribute", b),
  tributeQueue: (): Promise<{ intents: Array<{ id: string }> }> => call("/v1/manage/money/intents"),

  /* memory lane (5.1) */
  memoryEras: (): Promise<{ eras: Era[] }> => call("/v1/memory/eras"),
  throwbacks: (eraId?: string): Promise<{ items: MemoryItem[] }> => call(`/v1/memory/throwbacks${eraId ? `?eraId=${eraId}` : ""}`),
  addThrowback: (b: { mediaId: string; eraId?: string; year?: number; caption?: string }): Promise<{ id: string; status: string }> => post("/v1/memory/throwbacks", b),
  yearbooks: (): Promise<{ yearbooks: Yearbook[] }> => call("/v1/memory/yearbooks"),
  yearbook: (id: string, q: string): Promise<YearbookDetail> => call(`/v1/memory/yearbooks/${id}?q=${encodeURIComponent(q)}`),
  createYearbook: (b: { year: number; title?: string }): Promise<{ id: string }> => post("/v1/manage/memory/yearbooks", b),
  importYearbookNames: (id: string, csv: string): Promise<{ imported: number }> => post(`/v1/manage/memory/yearbooks/${id}/names-csv`, { csv }),
  hallOfFame: (): Promise<{ honourees: Array<{ id: string; display_name: string; citation: string; year: number | null }> }> => call("/v1/memory/hall-of-fame"),
  addHonouree: (b: { name: string; citation: string; year?: number; memberId?: string }): Promise<{ id: string }> => post("/v1/manage/memory/hall-of-fame", b),
  onThisDay: (): Promise<{ memories: Array<{ id: string; kind: string; body: string | null; caption: string | null; year: number | null; mediaId: string | null }> }> => call("/v1/memory/on-this-day"),
  memorials: (): Promise<{ memorials: MemorialView[] }> => call("/v1/memory/memorials"),
  memorialCondolences: (id: string): Promise<{ condolences: Array<{ id: string; message: string; attending: boolean; name: string }> }> => call(`/v1/memory/memorials/${id}`),
  leaveCondolence: (id: string, message: string, attending: boolean): Promise<{ id: string }> => post(`/v1/memory/memorials/${id}/condolences`, { message, attending }),
  memoryQueue: (): Promise<{ pending: Array<{ id: string; media_id: string; caption: string | null; uploader_name: string }> }> => call("/v1/manage/memory/queue"),
  decideMemoryItem: (id: string, decision: "approve" | "decline"): Promise<{ ok: boolean }> => post(`/v1/manage/memory/queue/${id}`, { decision }),
  memorialRequests: (): Promise<{ requests: Array<{ id: string; member_name: string; requested_by_name: string }> }> => call("/v1/manage/memory/memorials"),
  decideMemorial: (id: string, decision: "approve" | "decline"): Promise<{ ok: boolean }> => post(`/v1/manage/memory/memorials/${id}`, { decision }),
  createEra: (b: { name: string; yearFrom?: number; yearTo?: number }): Promise<{ id: string }> => post("/v1/manage/memory/eras", b),

  /* knowledge (5.2) */
  wikiPages: (q: string): Promise<{ pages: WikiPage[] }> => call(`/v1/wiki/pages${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  wikiPage: (slug: string): Promise<{ page: { id: string; slug: string; title: string; locked: boolean; body: string; lastAuthor: string; updatedAt: string }; history: Array<{ id: string; author_name: string; note: string | null; created_at: string }> }> => call(`/v1/wiki/pages/${encodeURIComponent(slug)}`),
  saveWikiPage: (slug: string, b: { body: string; note?: string }): Promise<{ ok: boolean }> => put(`/v1/wiki/pages/${encodeURIComponent(slug)}`, b),
  revertWikiPage: (slug: string, revisionId: string): Promise<{ ok: boolean }> => post(`/v1/wiki/pages/${encodeURIComponent(slug)}/revert/${revisionId}`, {}),
  slang: (q: string): Promise<{ terms: Array<{ id: string; term: string; meaning: string; example: string | null }> }> => call(`/v1/slang${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  submitSlang: (b: { term: string; meaning: string; example?: string }): Promise<{ id: string; status: string }> => post("/v1/slang", b),
  timeline: (): Promise<{ events: Array<{ id: string; year: number; title: string; story: string | null }> }> => call("/v1/timeline"),
  spotlights: (): Promise<{ spotlights: Array<{ id: string; member_name: string; interview: string; published_at: string }> }> => call("/v1/spotlights"),
  articles: (): Promise<{ articles: Array<{ id: string; title: string; body: string; author_name: string; published_at: string }> }> => call("/v1/articles"),
  submitArticle: (b: { title: string; body: string }): Promise<{ id: string; status: string }> => post("/v1/articles", b),
  articleQueue: (): Promise<{ submitted: Array<{ id: string; title: string; author_name: string }> }> => call("/v1/manage/articles"),
  decideArticle: (id: string, decision: "publish" | "decline"): Promise<{ ok: boolean }> => post(`/v1/manage/articles/${id}`, { decision }),
  slangQueue: (): Promise<{ pending: Array<{ id: string; term: string; meaning: string; submitted_by_name: string }> }> => call("/v1/manage/slang"),
  decideSlang: (id: string, decision: "approve" | "decline"): Promise<{ ok: boolean }> => post(`/v1/manage/slang/${id}`, { decision }),

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
