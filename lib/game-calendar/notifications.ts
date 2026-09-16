import { getDb, hasDatabaseUrl } from "@/lib/db";

export type GameCalendarNotification = {
  type:
    | "NEW_CHARACTER"
    | "NEW_SKIN"
    | "MAJOR_PATCH"
    | "HIGH_IMPORTANCE"
    | "TREND_SPIKE"
    | "STARTING_SOON"
    | "ENDING_SOON"
    | "BOT_FAILED"
    | "DATE_CONFLICT";
  title: string;
  message: string;
};

export interface NotificationProvider {
  readonly name: string;
  send(notification: GameCalendarNotification): Promise<void>;
}

export class InAppAdminNotificationProvider
  implements NotificationProvider
{
  readonly name = "in-app";

  async send(notification: GameCalendarNotification) {
    if (!hasDatabaseUrl()) return;
    const sql = getDb();
    await sql`
      insert into notifications (user_id, type, title, message)
      select id, ${`game_calendar_${notification.type.toLowerCase()}`},
        ${notification.title}, ${notification.message}
      from users
      where role = 'admin'
    `;
  }
}

export async function notifyCalendarAdmins(
  notification: GameCalendarNotification
) {
  const providers: NotificationProvider[] = [
    new InAppAdminNotificationProvider(),
  ];
  await Promise.allSettled(
    providers.map((provider) => provider.send(notification))
  );
}
