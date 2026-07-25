alter table groupbuy_customers
  add column if not exists on_hold boolean default false;
