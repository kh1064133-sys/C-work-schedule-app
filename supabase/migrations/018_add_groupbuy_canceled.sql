alter table groupbuy_customers
  add column if not exists canceled boolean default false;
