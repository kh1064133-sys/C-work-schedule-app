-- 공급자 회사에 입금계좌 정보 추가
alter table supplier_companies add column if not exists bank_name text default '';
alter table supplier_companies add column if not exists account_no text default '';
alter table supplier_companies add column if not exists account_holder text default '';
