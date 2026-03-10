-- =============================================
-- 견적서 공급자 정보 테이블
-- =============================================

create table if not exists supplier_companies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  company_index integer not null default 1,
  name text default '',
  ceo text default '',
  biz_no text default '',
  address text default '',
  tel text default '',
  email text default '',
  is_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, company_index)
);

create index if not exists idx_supplier_companies_user on supplier_companies(user_id);

create trigger update_supplier_companies_updated_at
  before update on supplier_companies
  for each row execute function update_updated_at_column();

alter table supplier_companies enable row level security;

create policy "Allow all for supplier_companies" on supplier_companies
  for all using (true) with check (true);
