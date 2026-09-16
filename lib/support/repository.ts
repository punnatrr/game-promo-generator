import { getDb } from "@/lib/db";
import type { TransactionSql } from "postgres";
import type { UploadedSupportImage } from "./image-storage";

export type SupportConversationStatus = "open" | "in_progress" | "resolved";

type ConversationRow = {
  id: string;
  subject: string;
  status: SupportConversationStatus;
  user_id: string;
  user_email: string;
  user_display_name: string | null;
  last_message_preview: string | null;
  last_message_at: Date;
  unread_count: number | string;
  created_at: Date;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_role: "user" | "admin";
  sender_name: string | null;
  body: string;
  created_at: Date;
  attachments: Array<{
    id: string;
    contentType: string;
    originalFilename: string | null;
    sizeBytes: number;
  }> | string;
};

export type SupportAttachmentInput = UploadedSupportImage;

function mapConversation(row: ConversationRow, includeUser: boolean) {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    lastMessagePreview: row.last_message_preview || "ส่งรูปภาพ",
    lastMessageAt: row.last_message_at,
    unreadCount: Number(row.unread_count || 0),
    createdAt: row.created_at,
    ...(includeUser
      ? {
          user: {
            id: row.user_id,
            email: row.user_email,
            displayName: row.user_display_name,
          },
        }
      : {}),
  };
}

function mapMessage(row: MessageRow) {
  const attachments =
    typeof row.attachments === "string"
      ? (JSON.parse(row.attachments) as MessageRow["attachments"])
      : row.attachments;

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    body: row.body,
    createdAt: row.created_at,
    attachments,
  };
}

export async function listUserSupportConversations(userId: string) {
  const db = getDb();
  const rows = await db<ConversationRow[]>`
    select
      conversation.id,
      conversation.subject,
      conversation.status,
      conversation.user_id,
      owner.email as user_email,
      owner.display_name as user_display_name,
      latest.body as last_message_preview,
      conversation.last_message_at,
      conversation.created_at,
      count(unread.id) as unread_count
    from support_conversations conversation
    join users owner on owner.id = conversation.user_id
    left join lateral (
      select body
      from support_messages
      where conversation_id = conversation.id
      order by created_at desc
      limit 1
    ) latest on true
    left join support_messages unread
      on unread.conversation_id = conversation.id
      and unread.sender_role = 'admin'
      and unread.created_at > coalesce(conversation.user_last_read_at, '-infinity'::timestamptz)
    where conversation.user_id = ${userId}
    group by conversation.id, owner.id, latest.body
    order by conversation.last_message_at desc
  `;

  return rows.map((row) => mapConversation(row, false));
}

export async function listAdminSupportConversations() {
  const db = getDb();
  const rows = await db<ConversationRow[]>`
    select
      conversation.id,
      conversation.subject,
      conversation.status,
      conversation.user_id,
      owner.email as user_email,
      owner.display_name as user_display_name,
      latest.body as last_message_preview,
      conversation.last_message_at,
      conversation.created_at,
      count(unread.id) as unread_count
    from support_conversations conversation
    join users owner on owner.id = conversation.user_id
    left join lateral (
      select body
      from support_messages
      where conversation_id = conversation.id
      order by created_at desc
      limit 1
    ) latest on true
    left join support_messages unread
      on unread.conversation_id = conversation.id
      and unread.sender_role = 'user'
      and unread.created_at > coalesce(conversation.admin_last_read_at, '-infinity'::timestamptz)
    group by conversation.id, owner.id, latest.body
    order by
      case conversation.status when 'open' then 0 when 'in_progress' then 1 else 2 end,
      conversation.last_message_at desc
  `;

  return rows.map((row) => mapConversation(row, true));
}

export async function getSupportConversationForViewer({
  conversationId,
  userId,
  isAdmin,
}: {
  conversationId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const db = getDb();
  const [row] = await db<ConversationRow[]>`
    select
      conversation.id,
      conversation.subject,
      conversation.status,
      conversation.user_id,
      owner.email as user_email,
      owner.display_name as user_display_name,
      latest.body as last_message_preview,
      conversation.last_message_at,
      conversation.created_at,
      0 as unread_count
    from support_conversations conversation
    join users owner on owner.id = conversation.user_id
    left join lateral (
      select body
      from support_messages
      where conversation_id = conversation.id
      order by created_at desc
      limit 1
    ) latest on true
    where conversation.id = ${conversationId}
      and (${isAdmin} or conversation.user_id = ${userId})
    limit 1
  `;

  return row ? mapConversation(row, isAdmin) : null;
}

export async function listSupportMessages({
  conversationId,
  userId,
  isAdmin,
}: {
  conversationId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const db = getDb();
  const conversation = await getSupportConversationForViewer({
    conversationId,
    userId,
    isAdmin,
  });
  if (!conversation) return null;

  const rows = await db<MessageRow[]>`
    select
      message.id,
      message.conversation_id,
      message.sender_user_id,
      message.sender_role,
      sender.display_name as sender_name,
      message.body,
      message.created_at,
      coalesce(
        json_agg(
          json_build_object(
            'id', attachment.id,
            'contentType', attachment.content_type,
            'originalFilename', attachment.original_filename,
            'sizeBytes', attachment.size_bytes
          ) order by attachment.created_at asc
        ) filter (where attachment.id is not null),
        '[]'::json
      ) as attachments
    from support_messages message
    join users sender on sender.id = message.sender_user_id
    left join support_attachments attachment on attachment.message_id = message.id
    where message.conversation_id = ${conversationId}
    group by message.id, sender.id
    order by message.created_at asc
  `;

  if (isAdmin) {
    await db`
      update support_conversations
      set admin_last_read_at = now()
      where id = ${conversationId}
    `;
  } else {
    await db`
      update support_conversations
      set user_last_read_at = now()
      where id = ${conversationId}
    `;
  }

  return {
    conversation,
    messages: rows.map(mapMessage),
  };
}

async function insertAttachments({
  transaction,
  messageId,
  uploadedByUserId,
  attachments,
}: {
  transaction: TransactionSql;
  messageId: string;
  uploadedByUserId: string;
  attachments: SupportAttachmentInput[];
}) {
  for (const attachment of attachments) {
    await transaction`
      insert into support_attachments (
        message_id,
        uploaded_by_user_id,
        image_url,
        blob_pathname,
        content_type,
        size_bytes,
        original_filename
      ) values (
        ${messageId},
        ${uploadedByUserId},
        ${attachment.url},
        ${attachment.pathname},
        ${attachment.contentType},
        ${attachment.sizeBytes},
        ${attachment.originalFilename}
      )
    `;
  }
}

export async function createSupportConversation({
  conversationId,
  userId,
  subject,
  body,
  attachments,
}: {
  conversationId: string;
  userId: string;
  subject: string;
  body: string;
  attachments: SupportAttachmentInput[];
}) {
  const db = getDb();
  const configuredAdminEmails = process.env.ADMIN_EMAILS || "";

  await db.begin(async (transaction) => {
    await transaction`
      insert into support_conversations (
        id, user_id, subject, status, user_last_read_at, last_message_at
      ) values (
        ${conversationId}, ${userId}, ${subject}, 'open', now(), now()
      )
    `;

    const [message] = await transaction<{ id: string }[]>`
      insert into support_messages (
        conversation_id, sender_user_id, sender_role, body
      ) values (
        ${conversationId}, ${userId}, 'user', ${body}
      )
      returning id
    `;

    await insertAttachments({
      transaction,
      messageId: message.id,
      uploadedByUserId: userId,
      attachments,
    });

    await transaction`
      insert into notifications (user_id, type, title, message)
      select
        id,
        'support_user_message',
        'มีข้อความ VIP Support ใหม่',
        ${subject}
      from users
      where role = 'admin'
        or lower(email) in (
          select trim(configured.email)
          from unnest(string_to_array(lower(${configuredAdminEmails}), ',')) as configured(email)
          where trim(configured.email) <> ''
        )
    `;
  });

  return conversationId;
}

export async function addSupportMessage({
  conversationId,
  senderUserId,
  senderRole,
  body,
  attachments,
}: {
  conversationId: string;
  senderUserId: string;
  senderRole: "user" | "admin";
  body: string;
  attachments: SupportAttachmentInput[];
}) {
  const db = getDb();
  const configuredAdminEmails = process.env.ADMIN_EMAILS || "";

  await db.begin(async (transaction) => {
    const [message] = await transaction<{ id: string }[]>`
      insert into support_messages (
        conversation_id, sender_user_id, sender_role, body
      ) values (
        ${conversationId}, ${senderUserId}, ${senderRole}, ${body}
      )
      returning id
    `;

    await insertAttachments({
      transaction,
      messageId: message.id,
      uploadedByUserId: senderUserId,
      attachments,
    });

    await transaction`
      update support_conversations
      set
        last_message_at = now(),
        updated_at = now(),
        status = case
          when ${senderRole} = 'user' then 'open'
          when status = 'open' then 'in_progress'
          else status
        end,
        user_last_read_at = case
          when ${senderRole} = 'user' then now()
          else user_last_read_at
        end,
        admin_last_read_at = case
          when ${senderRole} = 'admin' then now()
          else admin_last_read_at
        end
      where id = ${conversationId}
    `;

    if (senderRole === "admin") {
      await transaction`
        insert into notifications (user_id, type, title, message)
        select
          user_id,
          'support_admin_reply',
          'แอดมินตอบกลับแล้ว',
          left(${body || "แอดมินส่งรูปภาพกลับมา"}, 240)
        from support_conversations
        where id = ${conversationId}
      `;
    } else {
      await transaction`
        insert into notifications (user_id, type, title, message)
        select
          id,
          'support_user_message',
          'มีข้อความ VIP Support ใหม่',
          left(${body || "ลูกค้าส่งรูปภาพมา"}, 240)
        from users
        where role = 'admin'
          or lower(email) in (
            select trim(configured.email)
            from unnest(string_to_array(lower(${configuredAdminEmails}), ',')) as configured(email)
            where trim(configured.email) <> ''
          )
      `;
    }
  });
}

export async function updateSupportConversationStatus({
  conversationId,
  status,
  adminUserId,
}: {
  conversationId: string;
  status: SupportConversationStatus;
  adminUserId: string;
}) {
  const db = getDb();
  return db.begin(async (transaction) => {
    const [row] = await transaction<{ id: string; user_id: string; subject: string }[]>`
      update support_conversations
      set status = ${status}, updated_at = now(), admin_last_read_at = now()
      where id = ${conversationId}
      returning id, user_id, subject
    `;

    if (!row) return null;

    await transaction`
      insert into admin_actions (
        admin_user_id, action, target_type, target_id, metadata
      ) values (
        ${adminUserId},
        'support_status_changed',
        'support_conversation',
        ${conversationId},
        jsonb_build_object('status', ${status})
      )
    `;

    if (status === "resolved") {
      await transaction`
        insert into notifications (user_id, type, title, message)
        values (
          ${row.user_id},
          'support_resolved',
          'เคสของคุณได้รับการแก้ไขแล้ว',
          ${row.subject}
        )
      `;
    }

    return row;
  });
}

export async function getSupportAttachmentForViewer({
  attachmentId,
  userId,
  isAdmin,
}: {
  attachmentId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const db = getDb();
  const [row] = await db<{
    image_url: string;
    content_type: string;
    size_bytes: number;
    original_filename: string | null;
  }[]>`
    select
      attachment.image_url,
      attachment.content_type,
      attachment.size_bytes,
      attachment.original_filename
    from support_attachments attachment
    join support_messages message on message.id = attachment.message_id
    join support_conversations conversation on conversation.id = message.conversation_id
    where attachment.id = ${attachmentId}
      and (${isAdmin} or conversation.user_id = ${userId})
    limit 1
  `;

  return row || null;
}
