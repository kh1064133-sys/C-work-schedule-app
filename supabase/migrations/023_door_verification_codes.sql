CREATE TABLE IF NOT EXISTS door_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL CHECK (code ~ '^[0-9]{7}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE door_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "door_verification_codes_all"
  ON door_verification_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_door_verification_codes_created_at
  ON door_verification_codes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_door_verification_codes_phone
  ON door_verification_codes(phone);
