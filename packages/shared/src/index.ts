export type DeliveryStatus = 'pending' | 'processing' | 'active' | 'delivered' | 'failed';

export interface Agent {
  id: string;
  name: string;
  phone: string;
  preferred_language: string; // e.g. 'en', 'kn', 'hi', 'ta', 'te'
  created_at?: string;
  updated_at?: string;
}

export interface Delivery {
  id: string;
  tracking_id: string;
  status: DeliveryStatus;
  customer_id?: string | null;
  agent_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface CustomerLocation {
  id: string;
  delivery_id: string;
  pin: LocationCoordinates;
  pin_accuracy_meters: number;
  voice_note_url?: string | null;
  raw_transcript?: string | null;
  detected_language?: string | null;
  created_at?: string;
}

export type LandmarkType = 'atm' | 'temple' | 'hospital' | 'school' | 'shop' | 'road' | 'building' | 'other';
export type NavigationAction = 'look_for' | 'turn_left' | 'turn_right' | 'go_straight' | 'stop' | 'call_customer';

export interface NavigationStep {
  step_number: number;
  instruction_english: string;
  instruction_local: string;
  landmark_id: string | null;
  landmark_type: LandmarkType;
  action: NavigationAction;
  verified: boolean;
  fallback: string | null;
}

export interface NavigationStepsData {
  id: string;
  delivery_id: string;
  steps: NavigationStep[];
  landmark_refs: string[];
  agent_language: string;
  audio_urls: Record<number, string>; // step_number -> storage audio URL
  generated_at?: string;
}

export interface Landmark {
  id: string;
  name: string;
  name_aliases: string[];
  type: LandmarkType;
  location: LocationCoordinates;
  pin_code?: string | null;
  city?: string | null;
  verified: boolean;
  confidence_score: number;
  delivery_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryFeedback {
  id: string;
  delivery_id: string;
  agent_id: string;
  outcome: 'delivered' | 'failed' | 'partial';
  steps_accurate: boolean;
  landmarks_found: number;
  landmarks_missing: number;
  time_from_500m_seconds: number;
  agent_note?: string | null;
  created_at?: string;
}
