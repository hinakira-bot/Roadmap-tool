-- =============================================
-- ロードマップツール データベーススキーマ
-- Supabaseの SQL Editor で実行してください
-- =============================================

-- プロフィール
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text not null default '',
  is_admin boolean not null default false,
  created_at timestamp with time zone default now()
);

-- ロードマップ
create table roadmaps (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null default '',
  total_days integer not null default 7,
  created_by uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  is_published boolean not null default false
);

-- ロードマップの日
create table roadmap_days (
  id uuid default gen_random_uuid() primary key,
  roadmap_id uuid references roadmaps(id) on delete cascade not null,
  day_number integer not null,
  title text not null,
  description text not null default '',
  unique(roadmap_id, day_number)
);

-- 各日のタスク
create table day_tasks (
  id uuid default gen_random_uuid() primary key,
  day_id uuid references roadmap_days(id) on delete cascade not null,
  title text not null,
  description text not null default '',
  order_index integer not null default 0
);

-- ユーザーの進捗
create table user_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  roadmap_id uuid references roadmaps(id) on delete cascade not null,
  task_id uuid references day_tasks(id) on delete cascade not null,
  completed_at timestamp with time zone default now(),
  unique(user_id, task_id)
);

-- インデックス
create index idx_roadmap_days_roadmap on roadmap_days(roadmap_id);
create index idx_day_tasks_day on day_tasks(day_id);
create index idx_user_progress_user_roadmap on user_progress(user_id, roadmap_id);

-- RLS (Row Level Security)
alter table profiles enable row level security;
alter table roadmaps enable row level security;
alter table roadmap_days enable row level security;
alter table day_tasks enable row level security;
alter table user_progress enable row level security;

-- プロフィールポリシー
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Admins can view all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- ロードマップポリシー
create policy "Anyone can view published roadmaps" on roadmaps for select using (is_published = true);
create policy "Admins can do anything with roadmaps" on roadmaps for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- ロードマップ日ポリシー
create policy "Anyone can view days of published roadmaps" on roadmap_days for select using (
  exists (select 1 from roadmaps where id = roadmap_id and is_published = true)
);
create policy "Admins can do anything with days" on roadmap_days for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- タスクポリシー
create policy "Anyone can view tasks of published roadmaps" on day_tasks for select using (
  exists (
    select 1 from roadmap_days rd
    join roadmaps r on r.id = rd.roadmap_id
    where rd.id = day_id and r.is_published = true
  )
);
create policy "Admins can do anything with tasks" on day_tasks for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- 進捗ポリシー
create policy "Users can manage own progress" on user_progress for all using (auth.uid() = user_id);
create policy "Admins can view all progress" on user_progress for select using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- 新規ユーザー登録時に自動的にプロフィールを作成するトリガー
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
