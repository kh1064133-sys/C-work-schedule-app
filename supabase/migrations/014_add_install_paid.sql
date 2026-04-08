-- 외주설치 목록 전용 입금완료 필드 (일별스케줄 is_paid와 독립)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS install_paid BOOLEAN NOT NULL DEFAULT FALSE;
