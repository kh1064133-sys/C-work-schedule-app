alter table schedules
  drop constraint if exists schedules_schedule_type_check;

alter table schedules
  add constraint schedules_schedule_type_check
  check (schedule_type in ('sale', 'as', 'wholesale', 'agency', 'group', 'install', 'purchase', 'daily'));
