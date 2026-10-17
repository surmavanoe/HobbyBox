-- HOBBYBOX P0: media metadata, profiles, library, social fields, RLS.
-- Idempotent: safe to run more than once in the Supabase SQL editor.

-- 1. Media metadata used by cards and filters.
alter table public.media_items
  add column if not exists poster_url text,
  add column if not exists release_year integer,
  add column if not exists genres text[],
  add column if not exists runtime_minutes integer,
  add column if not exists episode_count integer,
  add column if not exists page_count integer,
  add column if not exists issue_count integer,
  add column if not exists external_source text,
  add column if not exists external_url text,
  add column if not exists average_rating numeric(3, 1),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists media_items_format_idx
  on public.media_items (format);
create index if not exists media_items_release_year_idx
  on public.media_items (release_year);
create index if not exists media_items_genres_gin_idx
  on public.media_items using gin (genres);

-- 2. Public profiles for the social graph.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 3. One current library row per user/media item.
create table if not exists public.library_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_item_id uuid not null references public.media_items (id) on delete cascade,
  status text not null check (status in ('planned', 'in_progress', 'completed', 'dropped')),
  rating integer check (rating between 1 and 5),
  review text,
  progress numeric,
  is_rewatch boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, media_item_id)
);

create index if not exists library_entries_user_idx
  on public.library_entries (user_id, updated_at desc);
create index if not exists library_entries_media_idx
  on public.library_entries (media_item_id);
create index if not exists library_entries_status_idx
  on public.library_entries (user_id, status);

-- 4. Friend requests need a state.
alter table public.friendships
  add column if not exists status text not null default 'accepted'
    check (status in ('pending', 'accepted', 'blocked'));

create unique index if not exists friendships_pair_idx
  on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));
create index if not exists friendships_user_status_idx
  on public.friendships (user_id, status);
create index if not exists friendships_friend_status_idx
  on public.friendships (friend_id, status);

-- 5. Review visibility and rewatch markers.
alter table public.reviews
  add column if not exists is_rewatch boolean not null default false,
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'friends', 'private'));

create index if not exists reviews_media_idx
  on public.reviews (media_item_id, created_at desc);
create index if not exists reviews_user_idx
  on public.reviews (user_id, created_at desc);

-- 6. Updated-at trigger for library rows.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists library_entries_set_updated_at on public.library_entries;
create trigger library_entries_set_updated_at
  before update on public.library_entries
  for each row
  execute function public.set_updated_at();

-- 7. Auto-create a profile for new auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 8. Row-level security.
alter table public.media_items enable row level security;
alter table public.profiles enable row level security;
alter table public.library_entries enable row level security;
alter table public.reviews enable row level security;
alter table public.friendships enable row level security;

drop policy if exists media_items_public_read on public.media_items;
create policy media_items_public_read
  on public.media_items
  for select
  to anon, authenticated
  using (true);

drop policy if exists profiles_authenticated_read on public.profiles;
create policy profiles_authenticated_read
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists library_entries_own_all on public.library_entries;
create policy library_entries_own_all
  on public.library_entries
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read
  on public.reviews
  for select
  to anon, authenticated
  using (visibility = 'public' or user_id = auth.uid());

drop policy if exists reviews_own_write on public.reviews;
create policy reviews_own_write
  on public.reviews
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists friendships_own_read on public.friendships;
create policy friendships_own_read
  on public.friendships
  for select
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists friendships_own_write on public.friendships;
create policy friendships_own_write
  on public.friendships
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 9. Table grants for PostgREST.
grant select on public.media_items to anon, authenticated;
grant select, insert, update, delete on public.library_entries to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select on public.reviews to anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;

notify pgrst, 'reload schema';
