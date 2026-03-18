-- 스케줄에 이벤트 아이콘 컬럼 추가
alter table schedules
  add column if not exists event_icon text check (event_icon in ('golf', 'birthday', 'meeting'));
