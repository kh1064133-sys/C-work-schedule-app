alter table items
  add column if not exists sort_order integer default 0;

update items
set sort_order = ranked.row_number - 1
from (
  select id, row_number() over (partition by user_id order by name asc, created_at asc) as row_number
  from items
  where sort_order is null or sort_order = 0
) ranked
where items.id = ranked.id;

create index if not exists idx_items_user_sort_order on items(user_id, sort_order, name);
