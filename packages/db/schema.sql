-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'en', -- en, kn, hi, ta, te
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE NOT NULL,           -- external order ref
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | processing | active | delivered | failed
  customer_id UUID,                           -- FK or mock UUID
  agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customer locations: approximate pin + voice data
CREATE TABLE IF NOT EXISTS customer_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  pin GEOGRAPHY(POINT, 4326) NOT NULL,        -- GPS drop, accurate to ~100m
  pin_accuracy_meters INT,                    -- from browser Geolocation API
  voice_note_url TEXT,                        -- Supabase Storage URL, temp
  raw_transcript TEXT,                        -- Gemini speech-to-text output
  detected_language TEXT,                     -- BCP-47 code e.g. 'kn', 'hi'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Structured navigation: Gemini output
CREATE TABLE IF NOT EXISTS navigation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  steps JSONB NOT NULL,                       -- array of NavigationStep objects
  landmark_refs UUID[],                       -- FK to landmarks.id
  agent_language TEXT NOT NULL,               -- TTS target language
  audio_urls JSONB,                           -- step index → Storage audio URL
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Persistent landmark database (self-builds over time)
CREATE TABLE IF NOT EXISTS landmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_aliases TEXT[],                        -- multilingual aliases
  type TEXT NOT NULL,                         -- atm | temple | hospital | school | shop | other
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  pin_code TEXT,
  city TEXT,
  verified BOOLEAN DEFAULT false,             -- verified via Maps API satellite
  confidence_score FLOAT DEFAULT 0.0,         -- 0-1, increases with successful deliveries
  delivery_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Spatial index on landmark location
CREATE INDEX IF NOT EXISTS landmarks_location_idx ON landmarks USING GIST(location);
CREATE INDEX IF NOT EXISTS customer_pin_idx ON customer_locations USING GIST(pin);

-- Delivery feedback
CREATE TABLE IF NOT EXISTS delivery_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  outcome TEXT NOT NULL,                      -- delivered | failed | partial
  steps_accurate BOOLEAN,
  landmarks_found INT,
  landmarks_missing INT,
  time_from_500m_seconds INT,
  agent_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
