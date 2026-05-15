
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_self_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);
create policy "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- learning_sessions
create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  topic text not null,
  target_role text,
  domain text,
  objective text,
  difficulty text not null default 'beginner',
  current_topic_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.learning_sessions(user_id, updated_at desc);
alter table public.learning_sessions enable row level security;
create policy "ls_owner_all" on public.learning_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger ls_updated before update on public.learning_sessions for each row execute function public.set_updated_at();

-- helper: is this session mine?
create or replace function public.is_session_owner(_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.learning_sessions where id = _session_id and user_id = auth.uid());
$$;

-- roadmaps (one per session)
create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.learning_sessions(id) on delete cascade,
  structure jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.roadmaps enable row level security;
create policy "roadmaps_owner_all" on public.roadmaps for all using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));

-- roadmap_progress
create table public.roadmap_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.learning_sessions(id) on delete cascade,
  topic_key text not null,
  status text not null default 'not_started',
  completed_at timestamptz,
  unique(session_id, topic_key)
);
alter table public.roadmap_progress enable row level security;
create policy "rp_owner_all" on public.roadmap_progress for all using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));

-- study_messages
create table public.study_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.learning_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  topic_key text,
  created_at timestamptz not null default now()
);
create index on public.study_messages(session_id, created_at);
alter table public.study_messages enable row level security;
create policy "sm_owner_all" on public.study_messages for all using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));

-- doubt_messages
create table public.doubt_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.learning_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  topic_key text,
  created_at timestamptz not null default now()
);
create index on public.doubt_messages(session_id, created_at);
alter table public.doubt_messages enable row level security;
create policy "dm_owner_all" on public.doubt_messages for all using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));

-- quizzes
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.learning_sessions(id) on delete cascade,
  topic_key text not null,
  topic_title text not null,
  questions jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.quizzes(session_id, created_at desc);
alter table public.quizzes enable row level security;
create policy "qz_owner_all" on public.quizzes for all using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));

-- quiz_results
create table public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  session_id uuid not null references public.learning_sessions(id) on delete cascade,
  answers jsonb not null,
  score numeric not null,
  total integer not null,
  weak_concepts text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.quiz_results(session_id, created_at desc);
alter table public.quiz_results enable row level security;
create policy "qr_owner_all" on public.quiz_results for all using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));
