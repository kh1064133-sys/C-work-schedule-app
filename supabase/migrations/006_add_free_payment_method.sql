-- 결제방법에 '무상(free)' 옵션 추가
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_payment_method_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_payment_method_check 
  CHECK (payment_method IN ('cash', 'card', 'vat', 'free'));
