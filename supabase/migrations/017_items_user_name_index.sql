-- Speed up item list/search queries that scope rows by the app user id
-- and then sort by item name.
create index if not exists idx_items_user_name on items(user_id, name);
