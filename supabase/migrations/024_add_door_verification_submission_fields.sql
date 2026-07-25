ALTER TABLE door_verification_codes
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS apartment_name TEXT,
  ADD COLUMN IF NOT EXISTS consent_agreed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_data_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_door_verification_codes_submitted_at
  ON door_verification_codes(submitted_at DESC);
