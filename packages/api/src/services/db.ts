import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  Agent, 
  Delivery, 
  CustomerLocation, 
  NavigationStep, 
  NavigationStepsData, 
  Landmark, 
  DeliveryFeedback,
  LocationCoordinates,
  LandmarkType
} from '@colonyiq/shared';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
export const isDemoMode = process.env.DEMO_MODE === 'true' || !supabaseUrl || !supabaseKey;

let supabase: SupabaseClient | null = null;
if (!isDemoMode) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Using live Supabase Database connection');
  } catch (error) {
    console.error('Failed to initialize Supabase client, falling back to mock database', error);
  }
} else {
  console.log('Running in DEMO_MODE or without credentials. Using in-memory mock database.');
}

// Distance helper (Haversine formula) for mock spatial queries
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// In-Memory Database Store (seeded)
const mockAgents: Agent[] = [
  { id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', name: 'Ramesh Kumar', phone: '+919876543210', preferred_language: 'kn' },
  { id: 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', name: 'Anil Sharma', phone: '+919876543211', preferred_language: 'hi' },
  { id: 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', name: 'Suresh Karthik', phone: '+919876543212', preferred_language: 'ta' }
];

const mockLandmarks: Landmark[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'HDFC ATM', name_aliases: ['hdfc atm', 'hdfc'], type: 'atm', location: { lat: 12.9345, lng: 77.6250 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.9, delivery_count: 45 },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Ganesha Temple', name_aliases: ['ganesha temple', 'ganapathi temple', 'temple'], type: 'temple', location: { lat: 12.9360, lng: 77.6240 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.95, delivery_count: 60 },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Apollo Pharmacy', name_aliases: ['apollo pharmacy', 'apollo', 'medical shop'], type: 'shop', location: { lat: 12.9338, lng: 77.6235 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.8, delivery_count: 20 },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Koramangala Club', name_aliases: ['koramangala club', 'the club'], type: 'building', location: { lat: 12.9350, lng: 77.6260 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.85, delivery_count: 30 },
  { id: '55555555-5555-5555-5555-555555555555', name: 'St. Johns Hospital', name_aliases: ['st johns hospital', 'st johns', 'hospital'], type: 'hospital', location: { lat: 12.9320, lng: 77.6210 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 1.0, delivery_count: 100 },
  { id: '66666666-6666-6666-6666-666666666666', name: 'Chai Point Shop', name_aliases: ['chai point', 'tea shop'], type: 'shop', location: { lat: 12.9365, lng: 77.6255 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.75, delivery_count: 15 },
  { id: '77777777-7777-7777-7777-777777777777', name: 'Koramangala Post Office', name_aliases: ['post office', 'koramangala post office'], type: 'building', location: { lat: 12.9380, lng: 77.6230 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.8, delivery_count: 25 },
  { id: '88888888-8888-8888-8888-888888888888', name: 'Bethany High School', name_aliases: ['bethany school', 'bethany high'], type: 'school', location: { lat: 12.9372, lng: 77.6248 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.9, delivery_count: 50 },
  { id: '99999999-9999-9999-9999-999999999999', name: 'ICICI Bank Road', name_aliases: ['icici bank road', 'icici road'], type: 'road', location: { lat: 12.9355, lng: 77.6225 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.7, delivery_count: 8 },
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Sony World Crossing Building', name_aliases: ['sony world crossing', 'sony world'], type: 'building', location: { lat: 12.9390, lng: 77.6270 }, pin_code: '560034', city: 'Bengaluru', verified: true, confidence_score: 0.88, delivery_count: 35 }
];

const mockDeliveries: Delivery[] = [
  { id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a', tracking_id: 'DEMO-001', status: 'active', agent_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' }
];

const mockCustomerLocations: CustomerLocation[] = [
  { id: 'e2f3a4b5-c6d7-8e9f-0a1b-2c3d4e5f6a7b', delivery_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a', pin: { lat: 12.9352, lng: 77.6245 }, pin_accuracy_meters: 10, raw_transcript: 'Ganesha Temple ke baad right lo, Apollo Pharmacy ke samne, red gate, second floor', detected_language: 'hi' }
];

const mockNavigationSteps: NavigationStepsData[] = [
  {
    id: 'f3a4b5c6-d7e8-9f0a-1b2c-3d4e5f6a7b8c',
    delivery_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
    steps: [
      { step_number: 1, instruction_english: "Go straight towards Ganesha Temple", instruction_local: "ಗಣೇಶ ದೇವಸ್ಥಾನದ ಕಡೆಗೆ ನೇರವಾಗಿ ಹೋಗಿ", landmark_id: "22222222-2222-2222-2222-222222222222", landmark_type: "temple", action: "go_straight", verified: true, fallback: "Follow standard map coordinates to Ganesha Temple" },
      { step_number: 2, instruction_english: "Turn right at the Ganesha Temple", instruction_local: "ಗಣೇಶ ದೇವಸ್ಥಾನದ ಬಳಿ ಬಲಗಡೆಗೆ ತಿರುಗಿ", landmark_id: "22222222-2222-2222-2222-222222222222", landmark_type: "temple", action: "turn_right", verified: true, fallback: "Turn right at the main corner" },
      { step_number: 3, instruction_english: "Go straight and look for Apollo Pharmacy on your left", instruction_local: "ನೇರವಾಗಿ ಹೋಗಿ ಮತ್ತು ನಿಮ್ಮ ಎಡಭಾಗದಲ್ಲಿರುವ ಅಪೊಲೊ ಫಾರ್ಮಸಿಯನ್ನು ನೋಡಿ", landmark_id: "33333333-3333-3333-3333-333333333333", landmark_type: "shop", action: "look_for", verified: true, fallback: "Continue 200 meters down the street" },
      { step_number: 4, instruction_english: "Stop opposite Apollo Pharmacy, look for the house with the red gate", instruction_local: "ಅಪೊಲೊ ಫಾರ್ಮಸಿ ಎದುರು ನಿಲ್ಲಿಸಿ, ಕೆಂಪು ಗೇಟ್ ಇರುವ ಮನೆಯನ್ನು ನೋಡಿ", landmark_id: "33333333-3333-3333-3333-333333333333", landmark_type: "shop", action: "stop", verified: true, fallback: "Stop at coordinates" },
      { step_number: 5, instruction_english: "Proceed to the 2nd floor", instruction_local: "2 ನೇ ಮಹಡಿಗೆ ಹೋಗಿ", landmark_id: null, landmark_type: "building", action: "go_straight", verified: true, fallback: "Ask the resident at the gate" }
    ],
    landmark_refs: ['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'],
    agent_language: 'kn',
    audio_urls: {
      1: '/audio/demo/step_1.mp3',
      2: '/audio/demo/step_2.mp3',
      3: '/audio/demo/step_3.mp3',
      4: '/audio/demo/step_4.mp3',
      5: '/audio/demo/step_5.mp3'
    }
  }
];

const mockDeliveryFeedback: DeliveryFeedback[] = [];

// Agent location storage for tracking simulator (agentId -> LocationCoordinates)
export const agentLocations = new Map<string, LocationCoordinates>();

// DATABASE SERVICE FUNCTIONS
export const dbService = {
  // AGENTS
  async getAgentById(id: string): Promise<Agent | null> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('agents').select('*').eq('id', id).single();
      if (error) return null;
      return data;
    }
    return mockAgents.find(a => a.id === id) || null;
  },

  async getAgents(): Promise<Agent[]> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('agents').select('*');
      if (error) return [];
      return data;
    }
    return mockAgents;
  },

  // DELIVERIES
  async getDeliveryByTrackingId(trackingId: string): Promise<Delivery | null> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('deliveries').select('*').eq('tracking_id', trackingId).single();
      if (error) return null;
      return data;
    }
    return mockDeliveries.find(d => d.tracking_id === trackingId) || null;
  },

  async getDeliveryById(id: string): Promise<Delivery | null> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('deliveries').select('*').eq('id', id).single();
      if (error) return null;
      return data;
    }
    return mockDeliveries.find(d => d.id === id) || null;
  },

  async createDelivery(trackingId: string): Promise<Delivery> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('deliveries').insert({
        tracking_id: trackingId,
        status: 'pending'
      }).select().single();
      if (error) throw error;
      return data;
    }
    const exists = mockDeliveries.find(d => d.tracking_id === trackingId);
    if (exists) return exists;
    
    // Choose a random agent
    const randomAgent = mockAgents[Math.floor(Math.random() * mockAgents.length)];

    const newDelivery: Delivery = {
      id: uuidv4(),
      tracking_id: trackingId,
      status: 'pending',
      agent_id: randomAgent.id
    };
    mockDeliveries.push(newDelivery);
    return newDelivery;
  },

  async updateDeliveryStatus(id: string, status: Delivery['status']): Promise<Delivery> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('deliveries').update({ status }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const idx = mockDeliveries.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('Delivery not found');
    mockDeliveries[idx].status = status;
    return mockDeliveries[idx];
  },

  async assignAgentToDelivery(id: string, agentId: string): Promise<Delivery> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('deliveries').update({ agent_id: agentId }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const idx = mockDeliveries.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('Delivery not found');
    mockDeliveries[idx].agent_id = agentId;
    return mockDeliveries[idx];
  },

  // CUSTOMER LOCATIONS
  async getCustomerLocation(deliveryId: string): Promise<CustomerLocation | null> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('customer_locations').select('*').eq('delivery_id', deliveryId).single();
      if (error) return null;
      // Convert PostGIS geography to JSON coordinates
      return {
        ...data,
        pin: data.pin // Supabase client auto-parses or we need geojson converter. Assume parsed.
      };
    }
    return mockCustomerLocations.find(l => l.delivery_id === deliveryId) || null;
  },

  async saveCustomerLocation(
    deliveryId: string, 
    pin: LocationCoordinates, 
    accuracy: number, 
    voiceNoteUrl?: string, 
    rawTranscript?: string, 
    detectedLanguage?: string
  ): Promise<CustomerLocation> {
    if (!isDemoMode && supabase) {
      // Convert to PostGIS Point format
      const pinPoint = `POINT(${pin.lng} ${pin.lat})`;
      const { data, error } = await supabase.from('customer_locations').insert({
        delivery_id: deliveryId,
        pin: pinPoint,
        pin_accuracy_meters: accuracy,
        voice_note_url: voiceNoteUrl,
        raw_transcript: rawTranscript,
        detected_language: detectedLanguage
      }).select().single();
      if (error) throw error;
      return data;
    }
    const existingIdx = mockCustomerLocations.findIndex(l => l.delivery_id === deliveryId);
    const newLoc: CustomerLocation = {
      id: uuidv4(),
      delivery_id: deliveryId,
      pin,
      pin_accuracy_meters: accuracy,
      voice_note_url: voiceNoteUrl || null,
      raw_transcript: rawTranscript || null,
      detected_language: detectedLanguage || null,
      created_at: new Date().toISOString()
    };
    if (existingIdx !== -1) {
      mockCustomerLocations[existingIdx] = newLoc;
    } else {
      mockCustomerLocations.push(newLoc);
    }
    return newLoc;
  },

  // NAVIGATION STEPS
  async getNavigationSteps(deliveryId: string): Promise<NavigationStepsData | null> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('navigation_steps').select('*').eq('delivery_id', deliveryId).single();
      if (error) return null;
      return data;
    }
    return mockNavigationSteps.find(n => n.delivery_id === deliveryId) || null;
  },

  async saveNavigationSteps(
    deliveryId: string, 
    steps: NavigationStep[], 
    landmarkRefs: string[], 
    agentLanguage: string, 
    audioUrls: Record<number, string>
  ): Promise<NavigationStepsData> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('navigation_steps').insert({
        delivery_id: deliveryId,
        steps,
        landmark_refs: landmarkRefs,
        agent_language: agentLanguage,
        audio_urls: audioUrls
      }).select().single();
      if (error) throw error;
      return data;
    }
    const existingIdx = mockNavigationSteps.findIndex(n => n.delivery_id === deliveryId);
    const newData: NavigationStepsData = {
      id: uuidv4(),
      delivery_id: deliveryId,
      steps,
      landmark_refs: landmarkRefs,
      agent_language: agentLanguage,
      audio_urls: audioUrls,
      generated_at: new Date().toISOString()
    };
    if (existingIdx !== -1) {
      mockNavigationSteps[existingIdx] = newData;
    } else {
      mockNavigationSteps.push(newData);
    }
    return newData;
  },

  // LANDMARKS
  async findNearbyLandmarks(
    pin: LocationCoordinates, 
    radiusMeters: number, 
    nameAliases?: string[], 
    landmarkType?: LandmarkType
  ): Promise<Landmark[]> {
    if (!isDemoMode && supabase) {
      // Execute PostGIS radius query
      let query = supabase.rpc('find_nearby_landmarks', {
        pin_lng: pin.lng,
        pin_lat: pin.lat,
        radius_m: radiusMeters
      });
      if (landmarkType) {
        query = query.eq('type', landmarkType);
      }
      const { data, error } = await query;
      if (error) {
        console.error('PostGIS RPC failed, falling back to manual client filtering', error);
        // Fallback standard query + manual distance filter
        const { data: allL } = await supabase.from('landmarks').select('*');
        if (!allL) return [];
        return allL.filter((l: any) => {
          // Parse PostGIS coordinates or structure
          const lCoords = l.location; // Assumed { lat, lng } or Parsed
          const d = calculateDistance(pin.lat, pin.lng, lCoords.lat, lCoords.lng);
          const typeMatch = !landmarkType || l.type === landmarkType;
          const nameMatch = !nameAliases || nameAliases.some(alias => 
            l.name.toLowerCase().includes(alias.toLowerCase()) || 
            l.name_aliases?.some((a: string) => a.toLowerCase().includes(alias.toLowerCase()))
          );
          return d <= radiusMeters && typeMatch && nameMatch;
        });
      }
      return data;
    }

    // In-memory PostGIS mock
    return mockLandmarks.filter(l => {
      const d = calculateDistance(pin.lat, pin.lng, l.location.lat, l.location.lng);
      const typeMatch = !landmarkType || l.type === landmarkType;
      const nameMatch = !nameAliases || nameAliases.some(alias => 
        l.name.toLowerCase().includes(alias.toLowerCase()) || 
        l.name_aliases.some(a => a.toLowerCase().includes(alias.toLowerCase()))
      );
      return d <= radiusMeters && typeMatch && nameMatch;
    });
  },

  async createLandmark(
    name: string, 
    nameAliases: string[], 
    type: LandmarkType, 
    location: LocationCoordinates, 
    pinCode?: string, 
    city?: string, 
    verified = false, 
    confidenceScore = 0.0
  ): Promise<Landmark> {
    if (!isDemoMode && supabase) {
      const point = `POINT(${location.lng} ${location.lat})`;
      const { data, error } = await supabase.from('landmarks').insert({
        name,
        name_aliases: nameAliases,
        type,
        location: point,
        pin_code: pinCode,
        city,
        verified,
        confidence_score: confidenceScore
      }).select().single();
      if (error) throw error;
      return data;
    }
    
    // Check deduplication (30m threshold)
    const duplicate = mockLandmarks.find(l => 
      l.type === type && calculateDistance(location.lat, location.lng, l.location.lat, l.location.lng) < 30
    );
    if (duplicate) {
      // Merge
      nameAliases.forEach(alias => {
        if (!duplicate.name_aliases.some(a => a.toLowerCase() === alias.toLowerCase())) {
          duplicate.name_aliases.push(alias);
        }
      });
      duplicate.delivery_count += 1;
      duplicate.confidence_score = Math.min(1.0, duplicate.delivery_count / 50);
      return duplicate;
    }

    const newLandmark: Landmark = {
      id: uuidv4(),
      name,
      name_aliases: nameAliases,
      type,
      location,
      pin_code: pinCode || null,
      city: city || null,
      verified,
      confidence_score: confidenceScore,
      delivery_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockLandmarks.push(newLandmark);
    return newLandmark;
  },

  async incrementLandmarkDelivery(landmarkId: string): Promise<Landmark | null> {
    if (!isDemoMode && supabase) {
      // Increments delivery_count and recalculates confidence score in Postgres trigger or query
      const { data, error } = await supabase.rpc('increment_landmark_delivery', { landmark_uuid: landmarkId });
      if (error) {
        // Direct update fallback
        const { data: lm } = await supabase.from('landmarks').select('delivery_count').eq('id', landmarkId).single();
        if (lm) {
          const newCount = lm.delivery_count + 1;
          const newConf = Math.min(1.0, newCount / 50);
          const { data: updated } = await supabase.from('landmarks').update({
            delivery_count: newCount,
            confidence_score: newConf
          }).eq('id', landmarkId).select().single();
          return updated;
        }
        return null;
      }
      return data;
    }
    const lm = mockLandmarks.find(l => l.id === landmarkId);
    if (!lm) return null;
    lm.delivery_count += 1;
    lm.confidence_score = Math.min(1.0, lm.delivery_count / 50);
    return lm;
  },

  // FEEDBACK
  async saveDeliveryFeedback(
    deliveryId: string, 
    agentId: string, 
    outcome: string, 
    stepsAccurate: boolean, 
    landmarksFound: number, 
    landmarksMissing: number, 
    timeFrom500mSeconds: number, 
    agentNote?: string
  ): Promise<DeliveryFeedback> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('delivery_feedback').insert({
        delivery_id: deliveryId,
        agent_id: agentId,
        outcome,
        steps_accurate: stepsAccurate,
        landmarks_found: landmarksFound,
        landmarks_missing: landmarksMissing,
        time_from_500m_seconds: timeFrom500mSeconds,
        agent_note: agentNote
      }).select().single();
      if (error) throw error;
      return data;
    }
    const newFb: DeliveryFeedback = {
      id: uuidv4(),
      delivery_id: deliveryId,
      agent_id: agentId,
      outcome: outcome as any,
      steps_accurate: stepsAccurate,
      landmarks_found: landmarksFound,
      landmarks_missing: landmarksMissing,
      time_from_500m_seconds: timeFrom500mSeconds,
      agent_note: agentNote || null,
      created_at: new Date().toISOString()
    };
    mockDeliveryFeedback.push(newFb);
    return newFb;
  },

  async getFeedbackForDelivery(deliveryId: string): Promise<DeliveryFeedback | null> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('delivery_feedback').select('*').eq('delivery_id', deliveryId).single();
      if (error) return null;
      return data;
    }
    return mockDeliveryFeedback.find(f => f.delivery_id === deliveryId) || null;
  },

  // OPS / HEATMAP / ANALYTICS
  async getAllLandmarks(): Promise<Landmark[]> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('landmarks').select('*');
      if (error) return [];
      return data;
    }
    return mockLandmarks;
  },

  async deleteLandmark(id: string): Promise<boolean> {
    if (!isDemoMode && supabase) {
      const { error } = await supabase.from('landmarks').delete().eq('id', id);
      return !error;
    }
    const idx = mockLandmarks.findIndex(l => l.id === id);
    if (idx === -1) return false;
    mockLandmarks.splice(idx, 1);
    return true;
  },

  async updateLandmark(id: string, updates: Partial<Landmark>): Promise<Landmark | null> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('landmarks').update(updates).eq('id', id).select().single();
      if (error) return null;
      return data;
    }
    const idx = mockLandmarks.findIndex(l => l.id === id);
    if (idx === -1) return null;
    mockLandmarks[idx] = { ...mockLandmarks[idx], ...updates, updated_at: new Date().toISOString() };
    return mockLandmarks[idx];
  },

  async getAllDeliveries(): Promise<Delivery[]> {
    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from('deliveries').select('*');
      if (error) return [];
      return data;
    }
    return mockDeliveries;
  },

  async getAnalytics() {
    if (!isDemoMode && supabase) {
      // Query database aggregates
      const { data: total } = await supabase.from('deliveries').select('status');
      const { data: feedback } = await supabase.from('delivery_feedback').select('time_from_500m_seconds, outcome');
      const { data: lms } = await supabase.from('landmarks').select('id, confidence_score, pin_code');

      const deliveries = total || [];
      const feedbacks = feedback || [];
      const landmarksList = lms || [];

      const totalCount = deliveries.length;
      const successCount = deliveries.filter((d: any) => d.status === 'delivered').length;
      const failCount = deliveries.filter((d: any) => d.status === 'failed').length;
      
      const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
      
      const successfulFeedbacks = feedbacks.filter((f: any) => f.outcome === 'delivered');
      const avgTime = successfulFeedbacks.length > 0 
        ? successfulFeedbacks.reduce((acc: number, f: any) => acc + f.time_from_500m_seconds, 0) / successfulFeedbacks.length 
        : 0;

      // Group landmarks by pin_code
      const landmarkCoverageByPin: Record<string, number> = {};
      landmarksList.forEach((l: any) => {
        const pin = l.pin_code || 'Unknown';
        landmarkCoverageByPin[pin] = (landmarkCoverageByPin[pin] || 0) + 1;
      });

      return {
        deliverySuccessRate: successRate,
        avgTimeToDeliverSeconds: avgTime,
        landmarkCoverageByPin,
        topFailureZones: ['Koramangala 4th Block', 'Indiranagar 100 Feet Rd', 'HSR Layout Sector 2'], // Mock failure zones
        deliveryCounts: {
          total: totalCount,
          delivered: successCount,
          failed: failCount,
          processing: deliveries.filter((d: any) => d.status === 'processing').length,
          active: deliveries.filter((d: any) => d.status === 'active').length
        }
      };
    }

    // Mock analytics
    const totalCount = mockDeliveries.length;
    const successCount = mockDeliveries.filter(d => d.status === 'delivered').length;
    const activeCount = mockDeliveries.filter(d => d.status === 'active').length;
    const processingCount = mockDeliveries.filter(d => d.status === 'processing').length;
    const pendingCount = mockDeliveries.filter(d => d.status === 'pending').length;
    const failCount = mockDeliveries.filter(d => d.status === 'failed').length;

    const landmarkCoverageByPin: Record<string, number> = {};
    mockLandmarks.forEach(l => {
      const pin = l.pin_code || 'Unknown';
      landmarkCoverageByPin[pin] = (landmarkCoverageByPin[pin] || 0) + 1;
    });

    return {
      deliverySuccessRate: totalCount > 0 ? (successCount / totalCount) * 100 : 85,
      avgTimeToDeliverSeconds: 142,
      landmarkCoverageByPin,
      topFailureZones: ['Koramangala 4th Block', 'HSR Sector 1'],
      deliveryCounts: {
        total: totalCount,
        delivered: successCount,
        failed: failCount,
        processing: processingCount,
        active: activeCount + pendingCount // Simplify
      }
    };
  }
};
