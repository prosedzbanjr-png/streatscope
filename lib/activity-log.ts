import { getSupabase } from "./supabase";

export type ActivityAction =
  | "article_created"
  | "article_updated"
  | "article_submitted"
  | "article_published"
  | "article_scheduled"
  | "article_archived"
  | "article_restored"
  | "article_deleted"
  | "article_changes_requested"
  | "tip_status_changed"
  | "tip_archived"
  | "tip_restored"
  | "tip_deleted"
  | "recruitment_status_changed"
  | "staff_added"
  | "staff_updated"
  | "staff_role_changed"
  | "staff_toggled";

export async function logActivity(input: {
  actorEmail?: string | null;
  action: ActivityAction;
  entityType: "article" | "tip" | "recruitment" | "staff";
  entityId?: number | string | null;
  entityLabel?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const client = getSupabase();
    let actorEmail = input.actorEmail?.trim().toLowerCase() || "";
    if (!actorEmail) {
      const { data } = await client.auth.getUser();
      actorEmail = data.user?.email?.toLowerCase() || "unknown";
    }
    await client.from("activity_logs").insert({
      actor_email: actorEmail,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId == null ? null : String(input.entityId),
      entity_label: input.entityLabel || null,
      details: input.details || {},
    });
  } catch {
    // Log nie może blokować właściwej akcji redakcyjnej.
  }
}
