/**
 * Phase 2 client types — mirror the API responses (M6: the server is the
 * source of truth; these are its documented shapes, exercised by the PG tests).
 */
export interface GroupSummary {
  id: string; type: string; name: string; status: string;
  memberCount: number; postsThisWeek: number; joined: boolean;
  enabled: boolean; label: string;
}

export interface Unseen { chatUnread: number; newPosts: number; newPhotos: number }

export interface GroupsHome {
  myGroups: Array<{ id: string; type: string; name: string; pinned: boolean; unseen: Unseen; memberCount: number; label: string }>;
  discovery: Array<{ id: string; type: string; name: string; memberCount: number; postsThisWeek: number; citySuggested: boolean }>;
}

export interface GroupProfile {
  id: string; type: string; name: string; description: string | null; status: string;
  memberCount: number; createdAt: string;
  my: { joined: boolean; isAdmin: boolean; feedMuted: boolean; notifyLevel: string };
  members: Array<{ id: string; display_name: string; is_admin: boolean }>;
}

export interface JoinRequest { id: string; member_id: string; display_name: string; created_at: string }

export interface ActivityItem {
  id: string; groupId: string | null; kind: string; body: string | null;
  author: string | null; isMine?: boolean; pinnedAt: string | null;
  commentsEnabled: boolean; createdAt: string;
  reactions: Record<string, number>; myReaction?: string | null;
  media: Array<{ id: string; kind: string }>;
  commentCount: number;
  poll: { options: Array<{ id: string; label: string; votes: number }>; myVote: string | null } | null;
  promotedFrom: { sourceGroupName?: string; name?: string; id?: string } | null;
}

export interface ActivityFeed { items: ActivityItem[]; groupStatus: string }

export interface CommentItem { id: string; body: string; parentId: string | null; author: string; authorId: string; isMine: boolean; createdAt: string }

export interface ChatThread {
  type: "group" | "dm"; id: string; name: string; groupType?: string | null;
  lastAt: string | null; preview: string; unread: number; pinned: boolean;
}

export interface ChatMessage {
  id: string; authorId: string; author: string; body: string | null;
  kind: string; mediaId: string | null; isMine: boolean;
  replyTo: { id: string; body: string | null; author: string | null } | null;
  editedAt: string | null; createdAt: string; pending?: boolean;
}

export interface NewsItem {
  id: string; body: string; author: string | null; createdAt: string;
  commentsEnabled: boolean; promotedFrom: { name: string; id: string } | null;
  reactions: Record<string, number>; myReaction: string | null;
}
export interface NewsResponse { items: NewsItem[]; mySetGroup: { id: string; name: string } | null }

export interface FeedItem {
  kind: string; id: string; body: string | null; author: string | null;
  createdAt: string; commentsEnabled: boolean;
  promotedFrom: { name: string; id: string } | null;
  commentCount?: number;
  groupId: string | null; groupName: string | null; groupType: string | null;
}
export interface FeedRail {
  key: string; title: string; kind: string;
  items: Array<Record<string, unknown>>;
}
export interface FeedResponse { items: FeedItem[]; rails: FeedRail[] }

export interface ReportItem {
  id: string; reason: string; status: string; created_at: string; reporter: string;
  post_id: string | null; message_id: string | null; post_body: string | null; group_name: string | null;
}

export interface MemberHit { id: string; display_name: string; verification: string; set_year: number | null }

export interface RecognitionMe {
  points: number;
  badges: Array<{ badge: string; title: string; description: string; awardedAt: string; awardedBy: string | null }>;
  streak: { current: number; longest: number };
}
