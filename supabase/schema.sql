-- Boyz at the Back schema
-- Run once in Supabase SQL Editor

create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  avatar_url text,
  status text default 'online',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update to authenticated using (auth.uid() = id);

-- Groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Boyz at the Back',
  invite_code text unique not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
alter table public.groups enable row level security;
create policy "groups_all" on public.groups for all to authenticated using (true) with check (true);

-- Members
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;
create policy "members_all" on public.group_members for all to authenticated using (true) with check (true);

-- Channels
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  name text not null,
  position int default 0,
  created_at timestamptz default now()
);
alter table public.channels enable row level security;
create policy "channels_all" on public.channels for all to authenticated using (true) with check (true);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  content text,
  image_url text,
  reply_to uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz default now()
);
alter table public.messages enable row level security;
create policy "messages_all" on public.messages for all to authenticated using (true) with check (true);

-- Reactions
create table if not exists public.reactions (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (message_id, user_id, emoji)
);
alter table public.reactions enable row level security;
create policy "reactions_all" on public.reactions for all to authenticated using (true) with check (true);

-- DMs
create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);
alter table public.dm_conversations enable row level security;
create policy "dm_convos_all" on public.dm_conversations for all to authenticated using (true) with check (true);

create table if not exists public.dm_participants (
  conversation_id uuid references public.dm_conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);
alter table public.dm_participants enable row level security;
create policy "dm_parts_all" on public.dm_participants for all to authenticated using (true) with check (true);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.dm_conversations(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  content text,
  image_url text,
  created_at timestamptz default now()
);
alter table public.dm_messages enable row level security;
create policy "dm_msgs_all" on public.dm_messages for all to authenticated using (true) with check (true);

-- Realtime
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reactions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.dm_messages; exception when duplicate_object then null; end $$;

-- Storage
insert into storage.buckets (id, name, public) values ('chat-images', 'chat-images', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;

create policy "chat_images_read" on storage.objects for select using (bucket_id = 'chat-images');
create policy "chat_images_write" on storage.objects for insert to authenticated with check (bucket_id = 'chat-images');
create policy "avatars_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars_update" on storage.objects for update to authenticated using (bucket_id = 'avatars');
