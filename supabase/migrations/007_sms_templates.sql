-- SMS 템플릿 테이블
create table if not exists sms_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  customer_id uuid not null,
  sms_num integer not null check (sms_num between 1 and 4),
  template_text text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, customer_id, sms_num)
);

-- RLS 정책
alter table sms_templates enable row level security;

create policy "Users can manage own sms_templates"
  on sms_templates for all
  using (true)
  with check (true);

-- 인덱스
create index if not exists idx_sms_templates_user_customer
  on sms_templates(user_id, customer_id);
