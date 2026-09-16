-- Private human support chat for active VIP subscribers.

create table if not exists support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 160),
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'resolved')
  ),
  user_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'admin')),
  body text not null default '' check (char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create table if not exists support_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references support_messages(id) on delete cascade,
  uploaded_by_user_id uuid not null references users(id) on delete cascade,
  image_url text not null,
  blob_pathname text not null,
  content_type text not null check (
    content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  original_filename text,
  created_at timestamptz not null default now()
);

create index if not exists support_conversations_user_activity_idx
  on support_conversations(user_id, last_message_at desc);

create index if not exists support_conversations_admin_queue_idx
  on support_conversations(status, last_message_at desc);

create index if not exists support_messages_conversation_created_idx
  on support_messages(conversation_id, created_at asc);

create index if not exists notifications_user_unread_idx
  on notifications(user_id, created_at desc)
  where read_at is null;
