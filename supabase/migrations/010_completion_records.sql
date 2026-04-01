-- 스케줄에 입금 상태 필드 추가
alter table schedules add column if not exists is_paid boolean default false;

-- 완료 확인서 저장 테이블
create table if not exists completion_records (
  id uuid primary key default uuid_generate_v4(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  user_id uuid not null,
  apartment_name text,
  unit_number text,
  customer_name text,
  phone text,
  content text,
  amount integer default 0,
  signature_data text,
  record_type text default 'completion' check (record_type in ('completion', 'deposit')),
  payment_method text,
  memo text,
  created_at timestamptz default now()
);

create index if not exists idx_completion_records_schedule on completion_records(schedule_id);
create index if not exists idx_completion_records_user on completion_records(user_id);

-- RLS 비활성화 (인증 미구현 상태에서)
alter table completion_records enable row level security;
create policy "Allow all for completion_records" on completion_records for all using (true) with check (true);
