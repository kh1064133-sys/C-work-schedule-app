-- schedule_type 체크 제약 조건에 'install' 추가
alter table schedules
  drop constraint if exists schedules_schedule_type_check;

alter table schedules
  add constraint schedules_schedule_type_check check (schedule_type in ('sale', 'as', 'agency', 'group', 'install'));
