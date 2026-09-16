import { getDb } from "@/lib/db";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read_at: Date | null;
  created_at: Date;
};

export async function listNotifications(userId: string, limit = 12) {
  const db = getDb();
  const rows = await db<NotificationRow[]>`
    select id, type, title, message, read_at, created_at
    from notifications
    where user_id = ${userId}
    order by created_at desc
    limit ${Math.min(Math.max(limit, 1), 30)}
  `;

  const [{ unread_count }] = await db<{ unread_count: number | string }[]>`
    select count(*) as unread_count
    from notifications
    where user_id = ${userId} and read_at is null
  `;

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unreadCount: Number(unread_count || 0),
  };
}

export async function markNotificationsRead({
  userId,
  notificationId,
}: {
  userId: string;
  notificationId?: string;
}) {
  const db = getDb();

  if (notificationId) {
    await db`
      update notifications
      set read_at = coalesce(read_at, now())
      where id = ${notificationId} and user_id = ${userId}
    `;
    return;
  }

  await db`
    update notifications
    set read_at = now()
    where user_id = ${userId} and read_at is null
  `;
}
