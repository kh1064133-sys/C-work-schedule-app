-- 모바일 웹 예약 테이블
create table if not exists web_reservations (
  id uuid primary key default uuid_generate_v4(),
  room text not null,           -- 호수 (예: A-1301)
  phone text not null,          -- 연락처
  reserve_date text not null,   -- 예약 날짜 (YYYY-MM-DD)
  reserve_time text not null,   -- 예약 시간 (HH:00)
  created_at timestamptz default now()
);

-- 같은 날짜+시간에 1명만 예약 가능 (선착순)
create unique index if not exists idx_web_reservations_slot
  on web_reservations(reserve_date, reserve_time);

create index if not exists idx_web_reservations_room
  on web_reservations(room);

alter table web_reservations enable row level security;

create policy "Allow all for web_reservations" on web_reservations
  for all using (true) with check (true);
