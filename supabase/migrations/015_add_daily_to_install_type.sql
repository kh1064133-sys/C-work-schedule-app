-- install_type에 'daily' 값 허용
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_install_type_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_install_type_check 
  CHECK (install_type IN ('sale', 'as', 'agency', 'group', 'install', 'daily'));
