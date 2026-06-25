-- 1. Profiles Table (linked to Supabase Auth users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null check (role in ('admin', 'student')) default 'student',
  full_name text,
  updated_at timestamp with time zone default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Allow public read-access to profiles"
  on public.profiles for select
  using (true);

create policy "Allow users to update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. Learning Pages Table
create table if not exists public.learning_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content jsonb not null default '[]'::jsonb, -- Array of blocks: [{id, type: 'text'|'youtube'|'pdf'|'quiz', value: ...}]
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on learning_pages
alter table public.learning_pages enable row level security;

-- Policies for learning_pages
create policy "Allow anyone to read learning pages"
  on public.learning_pages for select
  using (true);

create policy "Allow admins to insert learning pages"
  on public.learning_pages for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Allow admins to update learning pages"
  on public.learning_pages for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Allow admins to delete learning pages"
  on public.learning_pages for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 3. Quiz Submissions Table
create table if not exists public.quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.learning_pages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  answers jsonb not null, -- User's selected answers
  score integer not null,
  total_questions integer not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS on quiz_submissions
alter table public.quiz_submissions enable row level security;

-- Policies for quiz_submissions
create policy "Allow users to view their own submissions"
  on public.quiz_submissions for select
  using (auth.uid() = user_id);

create policy "Allow admins to view all submissions"
  on public.quiz_submissions for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Allow users to insert their own submissions"
  on public.quiz_submissions for insert
  with check (auth.uid() = user_id);

-- 4. Trigger to automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
