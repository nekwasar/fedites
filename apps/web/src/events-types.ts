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
