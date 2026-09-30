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
