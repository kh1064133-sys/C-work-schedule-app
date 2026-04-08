-- 차량 정비이력 테이블
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('engine_oil', 'tire', 'brake', 'battery', 'etc')),
  shop TEXT,
  cost INTEGER NOT NULL DEFAULT 0,
  mileage INTEGER,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 주유 기록 테이블
CREATE TABLE IF NOT EXISTS fuel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  mileage INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 정책
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_maintenance_all" ON vehicle_maintenance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "fuel_records_all" ON fuel_records FOR ALL USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_date ON vehicle_maintenance(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_records_date ON fuel_records(user_id, date DESC);
