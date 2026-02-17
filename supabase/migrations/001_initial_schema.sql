-- =============================================
-- 일정 및 매출 관리 시스템 DB 스키마
-- Supabase PostgreSQL
-- =============================================

-- UUID 확장 활성화
create extension if not exists "uuid-ossp";

-- =============================================
-- 테이블 생성
-- =============================================

-- 거래처 테이블
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  name text not null,
  type text check (type in ('apt', 'villa', 'officetel', 'house', 'etc')),
  address text,
  bunji text,
  households text,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 품목 테이블
create table if not exists items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  name text not null,
  price integer default 0,
  category text check (category in ('product', 'part', 'service', 'etc')),
  memo text,
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 스케줄 테이블
create table if not exists schedules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  date date not null,
  time_slot text not null,
  title text,
  unit text,
  memo text,
  schedule_type text check (schedule_type in ('sale', 'as', 'agency', 'group')),
  amount integer default 0,
  payment_method text check (payment_method in ('cash', 'card', 'vat')),
  is_done boolean default false,
  is_reserved boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(user_id, date, time_slot)
);

-- =============================================
-- 인덱스
-- =============================================

create index if not exists idx_schedules_user_date on schedules(user_id, date);
create index if not exists idx_schedules_date on schedules(date);
create index if not exists idx_schedules_pending on schedules(user_id, is_done) where is_done = false;
create index if not exists idx_clients_user on clients(user_id);
create index if not exists idx_clients_name on clients(name);
create index if not exists idx_items_user on items(user_id);
create index if not exists idx_items_name on items(name);

-- =============================================
-- updated_at 자동 갱신 트리거
-- =============================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_clients_updated_at
  before update on clients
  for each row execute function update_updated_at_column();

create trigger update_items_updated_at
  before update on items
  for each row execute function update_updated_at_column();

create trigger update_schedules_updated_at
  before update on schedules
  for each row execute function update_updated_at_column();

-- =============================================
-- Row Level Security (RLS)
-- 참고: 인증 없이 사용할 경우 아래 정책을 수정하세요
-- =============================================

-- RLS 활성화
alter table clients enable row level security;
alter table items enable row level security;
alter table schedules enable row level security;

-- 임시: 모든 사용자 접근 허용 (개발용)
-- 프로덕션에서는 auth.uid() 기반 정책으로 변경하세요

create policy "Allow all for clients" on clients
  for all using (true) with check (true);

create policy "Allow all for items" on items
  for all using (true) with check (true);

create policy "Allow all for schedules" on schedules
  for all using (true) with check (true);

-- =============================================
-- 프로덕션용 RLS 정책 (인증 적용 시 사용)
-- =============================================
/*
-- 위의 "Allow all" 정책을 삭제하고 아래 정책 적용

drop policy if exists "Allow all for clients" on clients;
drop policy if exists "Allow all for items" on items;
drop policy if exists "Allow all for schedules" on schedules;

create policy "Users can manage own clients" on clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own items" on items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own schedules" on schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
*/

-- =============================================
-- 뷰: 월별 매출 집계
-- =============================================

create or replace view monthly_sales as
select
  user_id,
  date_trunc('month', date)::date as month,
  sum(case when schedule_type = 'sale' then amount else 0 end) as sale_total,
  sum(case when schedule_type = 'as' then amount else 0 end) as as_total,
  sum(case when schedule_type = 'agency' then amount else 0 end) as agency_total,
  sum(case when schedule_type = 'group' then amount else 0 end) as group_total,
  sum(amount) as total,
  count(*) filter (where title is not null and title != '') as schedule_count,
  count(*) filter (where is_done = false and title is not null and title != '') as pending_count,
  sum(case when is_done = false and title is not null then amount else 0 end) as pending_amount,
  count(*) filter (where is_reserved = true) as reservation_count
from schedules
group by user_id, date_trunc('month', date);
