/**
 * Pure renderer for placeholder screens — exported for tests.
 * Typographic empty states only (G4): headline, invitation, action.
 */
export interface PlaceholderProps {
  title: string;
  job: string;
  emptyTitle: string;
  emptyBody: string;
  cta: string | null;
}

export function Placeholder(p: PlaceholderProps): string {
  return [
    `<main>`,
    `<h1 class="screen-title">${p.title}</h1>`,
    `<div class="micro">${p.job}</div>`,
    `<section class="empty">`,
    `<h2>${p.emptyTitle}</h2>`,
    `<p>${p.emptyBody}</p>`,
    p.cta !== null ? `<button type="button" class="btn btn--filled press">${p.cta}</button>` : "",
    `</section>`,
    `</main>`,
  ].join("");
}
