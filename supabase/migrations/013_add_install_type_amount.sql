-- 외주설치 전용 유형/금액 컬럼 추가 (일별 스케줄과 독립)
alter table schedules
  add column if not exists install_type text check (install_type in ('sale', 'as', 'agency', 'group', 'install')),
  add column if not exists install_amount integer default 0;
