-- event_icon 체크 제약 조건에 'install' 추가
alter table schedules
  drop constraint if exists schedules_event_icon_check;

alter table schedules
  add constraint schedules_event_icon_check check (event_icon in ('golf', 'birthday', 'meeting', 'install'));
