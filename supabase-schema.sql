-- ====================================================================
-- SCHEMA BASE DE DONNEES DAR (SUPABASE)
-- Espace Familial : Authentification, Messagerie Privée & Agenda Partagé
-- ====================================================================

-- 1. Table des profils des membres de la famille
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Table des conversations (Chat WhatsApp familial)
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  name text, -- null pour un message privé direct entre 2 personnes
  is_group boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Table des participants aux conversations
create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (conversation_id, user_id)
);

-- 4. Table des messages
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete set null not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Table des événements de l'Agenda partagé
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone,
  all_day boolean default false,
  category text default 'general' check (category in ('general', 'famille', 'anniversaire', 'ecole', 'sante', 'sortie', 'travail')),
  color text default '#ee7318',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- ACTIVATION DU TEMPS RÉEL (REALTIME SUPABASE)
-- ====================================================================
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.events;

-- ====================================================================
-- SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ====================================================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;

-- Politiques Profils
create policy "Lecture profils pour authentifiés" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Mise à jour profil soi-même ou admin" on public.profiles
  for update using (
    auth.uid() = id or 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Insertion profil" on public.profiles
  for insert with check (auth.role() = 'authenticated');

-- Politiques Conversations & Participants
create policy "Lecture conversations" on public.conversations
  for select using (auth.role() = 'authenticated');

create policy "Création conversations" on public.conversations
  for insert with check (auth.role() = 'authenticated');

create policy "Lecture participants" on public.conversation_participants
  for select using (auth.role() = 'authenticated');

create policy "Insertion participants" on public.conversation_participants
  for insert with check (auth.role() = 'authenticated');

-- Politiques Messages
create policy "Lecture messages" on public.messages
  for select using (auth.role() = 'authenticated');

create policy "Envoi messages" on public.messages
  for insert with check (auth.role() = 'authenticated' and auth.uid() = sender_id);

-- Politiques Agenda
create policy "Lecture agenda" on public.events
  for select using (auth.role() = 'authenticated');

create policy "Création agenda" on public.events
  for insert with check (auth.role() = 'authenticated');

create policy "Modification agenda" on public.events
  for update using (auth.role() = 'authenticated');

create policy "Suppression agenda" on public.events
  for delete using (auth.role() = 'authenticated');

-- ====================================================================
-- TRIGGER : INSCRIPTION AUTOMATIQUE
-- Le premier inscrit devient automatiquement ADMIN et APPROUVÉ !
-- Les suivants sont 'pending' en attente de validation admin.
-- ====================================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_count int;
  family_conv_id uuid;
begin
  select count(*) into user_count from public.profiles;

  -- 1. Créer le profil
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when user_count = 0 then 'admin' else 'member' end,
    case when user_count = 0 then 'approved' else 'pending' end
  );

  -- 2. Créer ou récupérer le groupe général "Toute la Famille"
  select id into family_conv_id from public.conversations where name = 'Toute la Famille' limit 1;
  if family_conv_id is null then
    insert into public.conversations (name, is_group, created_by)
    values ('Toute la Famille', true, new.id)
    returning id into family_conv_id;
  end if;

  -- 3. Ajouter l'utilisateur au groupe général
  insert into public.conversation_participants (conversation_id, user_id)
  values (family_conv_id, new.id)
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ====================================================================
-- 6. Table des Recettes Partagées dans le Cloud
-- ====================================================================
create table if not exists public.recipes (
  id text primary key,
  title text not null,
  category text default 'plat',
  default_servings integer default 4,
  prep_time_minutes integer default 15,
  cook_time_minutes integer default 20,
  image_url text,
  ingredients jsonb default '[]'::jsonb,
  steps jsonb default '[]'::jsonb,
  notes text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.recipes enable row level security;
drop policy if exists "Lecture recettes" on public.recipes;
create policy "Lecture recettes" on public.recipes for select using (auth.role() = 'authenticated');
drop policy if exists "Ajout recettes" on public.recipes;
create policy "Ajout recettes" on public.recipes for insert with check (auth.role() = 'authenticated');
drop policy if exists "Maj recettes" on public.recipes;
create policy "Maj recettes" on public.recipes for update using (auth.role() = 'authenticated');
drop policy if exists "Suppression recettes" on public.recipes;
create policy "Suppression recettes" on public.recipes for delete using (auth.role() = 'authenticated');
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'recipes') then
    alter publication supabase_realtime add table public.recipes;
  end if;
end $$;

-- ====================================================================
-- 7. Table de l'État Cuisine Partagé (Planning 2 semaines & Courses)
-- ====================================================================
create table if not exists public.family_kitchen (
  id text primary key default 'main',
  weekly_plan jsonb default '{}'::jsonb,
  custom_shopping_items jsonb default '[]'::jsonb,
  checked_items jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.family_kitchen enable row level security;
drop policy if exists "Gestion kitchen" on public.family_kitchen;
create policy "Gestion kitchen" on public.family_kitchen for all using (auth.role() = 'authenticated');
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'family_kitchen') then
    alter publication supabase_realtime add table public.family_kitchen;
  end if;
end $$;

-- ====================================================================
-- 8. Table des Alertes Familiales (Bannière temporaire urgente)
-- ====================================================================
create table if not exists public.family_alerts (
  id uuid default gen_random_uuid() primary key,
  message text not null,
  level text default 'warning' check (level in ('info', 'warning', 'urgent')),
  author_name text,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_active boolean default true,
  is_recurring boolean default false,
  recurrence_days jsonb default '[]'::jsonb,
  time_start text,
  time_end text
);

alter table public.family_alerts add column if not exists is_recurring boolean default false;
alter table public.family_alerts add column if not exists recurrence_days jsonb default '[]'::jsonb;
alter table public.family_alerts add column if not exists time_start text;
alter table public.family_alerts add column if not exists time_end text;

alter table public.family_alerts enable row level security;
drop policy if exists "Lecture alertes" on public.family_alerts;
create policy "Lecture alertes" on public.family_alerts for select using (auth.role() = 'authenticated');
drop policy if exists "Creation alertes" on public.family_alerts;
create policy "Creation alertes" on public.family_alerts for insert with check (auth.role() = 'authenticated');
drop policy if exists "Maj alertes" on public.family_alerts;
create policy "Maj alertes" on public.family_alerts for update using (auth.role() = 'authenticated');
drop policy if exists "Suppression alertes" on public.family_alerts;
create policy "Suppression alertes" on public.family_alerts for delete using (auth.role() = 'authenticated');
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'family_alerts') then
    alter publication supabase_realtime add table public.family_alerts;
  end if;
end $$;

-- ====================================================================
-- 9. Table des Tâches Familiales (To-Do List partagée avec affectation)
-- ====================================================================
create table if not exists public.family_tasks (
  id text primary key,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_name text,
  assigned_avatar text,
  priority text default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  completed boolean default false,
  completed_at timestamp with time zone,
  completed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.family_tasks enable row level security;
drop policy if exists "Lecture taches" on public.family_tasks;
create policy "Lecture taches" on public.family_tasks for select using (auth.role() = 'authenticated');
drop policy if exists "Creation taches" on public.family_tasks;
create policy "Creation taches" on public.family_tasks for insert with check (auth.role() = 'authenticated');
drop policy if exists "Maj taches" on public.family_tasks;
create policy "Maj taches" on public.family_tasks for update using (auth.role() = 'authenticated');
drop policy if exists "Suppression taches" on public.family_tasks;
create policy "Suppression taches" on public.family_tasks for delete using (auth.role() = 'authenticated');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'family_tasks') then
    alter publication supabase_realtime add table public.family_tasks;
  end if;
end $$;

-- ====================================================================
-- 10. Politiques de suppression pour les conversations (sauf Toute la Famille)
-- ====================================================================
drop policy if exists "Suppression conversations" on public.conversations;
create policy "Suppression conversations" on public.conversations
  for delete using (auth.role() = 'authenticated' and lower(coalesce(name, '')) != 'toute la famille');

drop policy if exists "Suppression participants" on public.conversation_participants;
create policy "Suppression participants" on public.conversation_participants
  for delete using (auth.role() = 'authenticated');

drop policy if exists "Suppression messages" on public.messages;
create policy "Suppression messages" on public.messages
  for delete using (auth.role() = 'authenticated');

