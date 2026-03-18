-- 공동구매 고객 테이블
create table if not exists groupbuy_customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  install_date text default '',
  day_of_week text default '',
  time text default '',
  dong text default '',
  ho text default '',
  contact text default '',
  content text default '',
  amount integer default 0,
  payment_method text default '',
  note text default '',
  reserved boolean default false,
  completed boolean default false,
  deposited boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_groupbuy_user on groupbuy_customers(user_id);

alter table groupbuy_customers enable row level security;

create policy "Allow all for groupbuy_customers" on groupbuy_customers
  for all using (true) with check (true);
