/**
 * Event client types (M6: shapes mirrored from the API contracts exercised
 * by the PG tests).
 */
export interface EventListItem {
  id: string; title: string; startsAt: string; endsAt: string | null;
  venue: string | null; city: string | null; description: string | null;
  virtualLink: string | null; anniversary: boolean;
  groupId: string | null; groupName: string | null;
  goingCount: number; myResponse: "going" | "maybe" | "no" | null;
  organizer: boolean; createdAt: string;
}
export interface EventCreateBody {
  title: string; description?: string; startsAt: string; endsAt?: string;
  venue?: string; city?: string; groupId?: string; virtualLink?: string; anniversary?: boolean;
}
export interface EventUpdateBody extends Partial<EventCreateBody> { checkInOpen?: boolean }
export interface Ticket { payload: string; qrSvg: string; eventTitle: string; startsAt: string }
export interface EventTask { id: string; title: string; assignee: string | null; assigneeName: string | null; dueAt: string | null; done: boolean }
export interface BudgetItem { id: string; label: string; amountMinor: number; currency: string; kind: "planned" | "actual" }

export interface PhotoWallItem {
  id: string; mediaId: string; uploader: string; uploaderId: string;
  createdAt: string; tags: Array<{ memberId: string; name: string }>;
  taggedByMe: boolean; isMine: boolean;
}

export interface DuesAssessmentView { id: string; period: string; amountMinor: number; currency: string; dueDate: string; status: "due" | "paid" | "overdue" | "waived"; tierName: string | null; receiptNo: string | null }
export interface LedgerRow { id: string; kind: string; amountMinor: number; currency: string; memo: string | null; status: "pending" | "confirmed" | "voided"; receiptNo: string | null; createdAt: string }
export interface TierView { id: string; name: string; amountMinor: number; currency: string; cycle: string; perks: { voting?: boolean; eventPriority?: boolean; idMarking?: boolean } }
export interface MoneyOverview { dues: DuesAssessmentView[]; ledger: LedgerRow[]; myTier: TierView | null; owedMinor: number; currency: string }
export interface ReceiptView { receiptNo: string | null; payer: string; kind: string; amountMinor: number; currency: string; issuedAt: string; community: string }
export interface AdminDuesRow { id: string; memberName: string; period: string; amountMinor: number; currency: string; dueDate: string; status: string; receiptNo: string | null }
export interface TierCreateBody { name: string; amountMinor: number; currency: string; cycle?: string; perks?: { voting?: boolean; eventPriority?: boolean; idMarking?: boolean } }

export interface CampaignView { id: string; title: string; description: string | null; goalMinor: number; currency: string; raisedMinor: number; deadline: string | null; goalReached: boolean; progress: number; status: string }
export interface DonorWall { donors: Array<{ name: string; at: string }> }
export interface TransparentLedger { rows: Array<{ kind: string; amountMinor: number; currency: string; receiptNo: string | null; createdAt: string; campaign: string | null; payer: string | null }>; totals: Record<string, number> }
export interface DonationSchedule { id: string; amountMinor: number; currency: string; frequency: string; campaign: string | null; nextDate: string }

export interface P2pView { id: string; title: string; story: string | null; status: string; goalMinor: number; currency: string; raisedMinor: number; creator: string; mine: boolean }
export interface PledgeView { id: string; amountMinor: number; currency: string; status: string; promisedAt: string; dueDate: string | null; campaign: string | null }
export interface ReimbView { id: string; amountMinor: number; currency: string; memo: string; status: string; createdAt: string }
export interface SponsorView { sponsor_name: string; tier: string; recognition: string | null }
export interface ScholarshipView { id: string; name: string; description: string | null; endowedMinor: number; currency: string; status: string }
export interface Publication { id: string; period: string; totals: Record<string, { minor: number; count: number }>; row_count: number; published_at: string; published_by_name: string }

export interface Era { id: string; name: string; year_from: number | null; year_to: number | null }
export interface MemoryItem { id: string; mediaId: string; year: number | null; caption: string | null; status: string; era: string | null; uploader: string; mine: boolean }
export interface Yearbook { id: string; year: number; title: string | null; mediaId: string | null; entryCount: number }
export interface YearbookDetail { yearbook: { id: string; year: number; title: string | null; mediaId: string | null }; entries: Array<{ id: string; full_name: string; section: string | null }> }
export interface Honouree { id: string; display_name: string; citation: string; year: number | null }
export interface MemorialView { id: string; memberName: string; setYear: number | null; tribute: string | null; status: string; funeralDate: string | null }

export interface WikiPage { id: string; slug: string; title: string; locked: boolean; updated_at: string }

export interface JobRow { id: string; title: string; companyName: string; industry: string | null; city: string | null; country: string | null; employmentType: string; workMode: string; salary: { minMinor: number; maxMinor: number | null; currency: string } | null; applyBy: string | null; createdAt: string; poster: string; mine: boolean }
export interface BizRow { id: string; name: string; industry: string; description: string | null; city: string | null; promoOffer: string | null; owner: string; rating: number | null; reviewCount: number }
export interface MentorRow { memberId: string; name: string; expertise: string; bio: string | null; hasStandingLink: boolean; openSlots: number }
export interface ReferralRow { sent: Array<{ id: string; to: string; company: string; role: string; status: string; createdAt: string }>; received: Array<{ id: string; from: string; company: string; role: string; note: string | null; status: string; createdAt: string }> }
export interface EndorsementRow { skills: Array<{ skill: string; count: number; endorsers: string }> }
