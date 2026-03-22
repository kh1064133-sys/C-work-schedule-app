-- SMS 발송 상태 추적 테이블
create table if not exists sms_sent_status (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  customer_id uuid not null,
  sms_num integer not null check (sms_num between 1 and 4),
  sent_at timestamptz not null default now(),
  unique(user_id, customer_id, sms_num)
);

alter table sms_sent_status enable row level security;

create policy "Users can manage own sms_sent_status"
  on sms_sent_status for all
  using (true)
  with check (true);

create index if not exists idx_sms_sent_status_user
  on sms_sent_status(user_id, customer_id);
