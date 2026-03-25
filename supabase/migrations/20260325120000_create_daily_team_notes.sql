create table public.daily_team_notes (
  id uuid not null default gen_random_uuid() primary key,
  entry_date date not null,
  content text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint daily_team_notes_entry_date_key unique (entry_date)
);

alter table public.daily_team_notes enable row level security;

create policy "Team members can manage team notes"
  on public.daily_team_notes
  for all
  using (true)
  with check (true);
