-- Seed Agents
INSERT INTO agents (id, name, phone, preferred_language) VALUES
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Ramesh Kumar', '+919876543210', 'kn'),
  ('b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Anil Sharma', '+919876543211', 'hi'),
  ('c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Suresh Karthik', '+919876543212', 'ta')
ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, preferred_language = EXCLUDED.preferred_language;

-- Seed Landmarks in Koramangala, Bengaluru (around 12.9352, 77.6245)
-- Point is ST_MakePoint(longitude, latitude)
INSERT INTO landmarks (id, name, name_aliases, type, location, pin_code, city, verified, confidence_score, delivery_count) VALUES
  ('11111111-1111-1111-1111-111111111111', 'HDFC ATM', ARRAY['hdfc atm', 'hdfc'], 'atm', ST_SetSRID(ST_MakePoint(77.6250, 12.9345), 4326)::geography, '560034', 'Bengaluru', true, 0.9, 45),
  ('22222222-2222-2222-2222-222222222222', 'Ganesha Temple', ARRAY['ganesha temple', 'ganapathi temple', 'temple'], 'temple', ST_SetSRID(ST_MakePoint(77.6240, 12.9360), 4326)::geography, '560034', 'Bengaluru', true, 0.95, 60),
  ('33333333-3333-3333-3333-333333333333', 'Apollo Pharmacy', ARRAY['apollo pharmacy', 'apollo', 'medical shop'], 'shop', ST_SetSRID(ST_MakePoint(77.6235, 12.9338), 4326)::geography, '560034', 'Bengaluru', true, 0.8, 20),
  ('44444444-4444-4444-4444-444444444444', 'Koramangala Club', ARRAY['koramangala club', 'the club'], 'building', ST_SetSRID(ST_MakePoint(77.6260, 12.9350), 4326)::geography, '560034', 'Bengaluru', true, 0.85, 30),
  ('55555555-5555-5555-5555-555555555555', 'St. Johns Hospital', ARRAY['st johns hospital', 'st johns', 'hospital'], 'hospital', ST_SetSRID(ST_MakePoint(77.6210, 12.9320), 4326)::geography, '560034', 'Bengaluru', true, 1.0, 100),
  ('66666666-6666-6666-6666-666666666666', 'Chai Point Shop', ARRAY['chai point', 'tea shop'], 'shop', ST_SetSRID(ST_MakePoint(77.6255, 12.9365), 4326)::geography, '560034', 'Bengaluru', true, 0.75, 15),
  ('77777777-7777-7777-7777-777777777777', 'Koramangala Post Office', ARRAY['post office', 'koramangala post office'], 'building', ST_SetSRID(ST_MakePoint(77.6230, 12.9380), 4326)::geography, '560034', 'Bengaluru', true, 0.8, 25),
  ('88888888-8888-8888-8888-888888888888', 'Bethany High School', ARRAY['bethany school', 'bethany high'], 'school', ST_SetSRID(ST_MakePoint(77.6248, 12.9372), 4326)::geography, '560034', 'Bengaluru', true, 0.9, 50),
  ('99999999-9999-9999-9999-999999999999', 'ICICI Bank Road', ARRAY['icici bank road', 'icici road'], 'road', ST_SetSRID(ST_MakePoint(77.6225, 12.9355), 4326)::geography, '560034', 'Bengaluru', true, 0.7, 8),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sony World Crossing Building', ARRAY['sony world crossing', 'sony world'], 'building', ST_SetSRID(ST_MakePoint(77.6270, 12.9390), 4326)::geography, '560034', 'Bengaluru', true, 0.88, 35)
ON CONFLICT (id) DO NOTHING;

-- Seed Demo Delivery
INSERT INTO deliveries (id, tracking_id, status, agent_id) VALUES
  ('d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a', 'DEMO-001', 'active', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
ON CONFLICT (tracking_id) DO UPDATE SET status = EXCLUDED.status, agent_id = EXCLUDED.agent_id;

-- Seed Customer Location for Demo Delivery
INSERT INTO customer_locations (id, delivery_id, pin, pin_accuracy_meters, raw_transcript, detected_language) VALUES
  ('e2f3a4b5-c6d7-8e9f-0a1b-2c3d4e5f6a7b', 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a', ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::geography, 10, 'Ganesha Temple ke baad right lo, Apollo Pharmacy ke samne, red gate, second floor', 'hi')
ON CONFLICT (id) DO NOTHING;

-- Seed Navigation Steps for Demo Delivery (5 steps, English + Kannada)
INSERT INTO navigation_steps (id, delivery_id, steps, landmark_refs, agent_language, audio_urls) VALUES
  ('f3a4b5c6-d7e8-9f0a-1b2c-3d4e5f6a7b8c', 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a', 
   '[
     {"step_number": 1, "instruction_english": "Go straight towards Ganesha Temple", "instruction_local": "ಗಣೇಶ ದೇವಸ್ಥಾನದ ಕಡೆಗೆ ನೇರವಾಗಿ ಹೋಗಿ", "landmark_id": "22222222-2222-2222-2222-222222222222", "landmark_type": "temple", "action": "go_straight", "verified": true, "fallback": "Follow standard map coordinates to Ganesha Temple"},
     {"step_number": 2, "instruction_english": "Turn right at the Ganesha Temple", "instruction_local": "ಗಣೇಶ ದೇವಸ್ಥಾನದ ಬಳಿ ಬಲಗಡೆಗೆ ತಿರುಗಿ", "landmark_id": "22222222-2222-2222-2222-222222222222", "landmark_type": "temple", "action": "turn_right", "verified": true, "fallback": "Turn right at the main corner"},
     {"step_number": 3, "instruction_english": "Go straight and look for Apollo Pharmacy on your left", "instruction_local": "ನೇರವಾಗಿ ಹೋಗಿ ಮತ್ತು ನಿಮ್ಮ ಎಡಭಾಗದಲ್ಲಿರುವ ಅಪೊಲೊ ಫಾರ್ಮಸಿಯನ್ನು ನೋಡಿ", "landmark_id": "33333333-3333-3333-3333-333333333333", "landmark_type": "shop", "action": "look_for", "verified": true, "fallback": "Continue 200 meters down the street"},
     {"step_number": 4, "instruction_english": "Stop opposite Apollo Pharmacy, look for the house with the red gate", "instruction_local": "ಅಪೊಲೊ ಫಾರ್ಮಸಿ ಎದುರು ನಿಲ್ಲಿಸಿ, ಕೆಂಪು ಗೇಟ್ ಇರುವ ಮನೆಯನ್ನು ನೋಡಿ", "landmark_id": "33333333-3333-3333-3333-333333333333", "landmark_type": "shop", "action": "stop", "verified": true, "fallback": "Stop at coordinates"},
     {"step_number": 5, "instruction_english": "Proceed to the 2nd floor", "instruction_local": "2 ನೇ ಮಹಡಿಗೆ ಹೋಗಿ", "landmark_id": null, "landmark_type": "building", "action": "go_straight", "verified": true, "fallback": "Ask the resident at the gate"}
   ]'::jsonb,
   ARRAY['22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333333'::uuid],
   'kn',
   '{"1": "/audio/demo/step_1.mp3", "2": "/audio/demo/step_2.mp3", "3": "/audio/demo/step_3.mp3", "4": "/audio/demo/step_4.mp3", "5": "/audio/demo/step_5.mp3"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
