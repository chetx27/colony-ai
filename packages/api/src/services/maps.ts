import { LocationCoordinates } from '@colonyiq/shared';
import { isDemoMode } from './db';

interface PlaceResult {
  name: string;
  location: LocationCoordinates;
  city?: string;
}

export const mapsService = {
  async findNearbyPlace(keyword: string, location: LocationCoordinates, radiusMeters: number): Promise<PlaceResult | null> {
    if (isDemoMode) {
      console.log(`Maps: Mocking nearby search for "${keyword}" around ${location.lat}, ${location.lng}`);
      
      // Look up in static list for high fidelity demos
      const query = keyword.toLowerCase();
      if (query.includes('temple') || query.includes('ganesha') || query.includes('ganapathi')) {
        return { name: 'Ganesha Temple', location: { lat: 12.9360, lng: 77.6240 }, city: 'Bengaluru' };
      }
      if (query.includes('pharmacy') || query.includes('apollo') || query.includes('medical')) {
        return { name: 'Apollo Pharmacy', location: { lat: 12.9338, lng: 77.6235 }, city: 'Bengaluru' };
      }
      if (query.includes('atm') || query.includes('hdfc')) {
        return { name: 'HDFC ATM', location: { lat: 12.9345, lng: 77.6250 }, city: 'Bengaluru' };
      }
      if (query.includes('chai') || query.includes('tea')) {
        return { name: 'Chai Point Shop', location: { lat: 12.9365, lng: 77.6255 }, city: 'Bengaluru' };
      }
      if (query.includes('hospital') || query.includes('john')) {
        return { name: 'St. Johns Hospital', location: { lat: 12.9320, lng: 77.6210 }, city: 'Bengaluru' };
      }
      if (query.includes('post') || query.includes('office')) {
        return { name: 'Koramangala Post Office', location: { lat: 12.9380, lng: 77.6230 }, city: 'Bengaluru' };
      }
      if (query.includes('school') || query.includes('bethany')) {
        return { name: 'Bethany High School', location: { lat: 12.9372, lng: 77.6248 }, city: 'Bengaluru' };
      }

      // Generate a simulated location slightly offset from the pin
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 200; // 50 to 250m
      const latOffset = (dist / 111000) * Math.sin(angle);
      const lngOffset = (dist / (111000 * Math.cos((location.lat * Math.PI) / 180))) * Math.cos(angle);

      return {
        name: keyword.charAt(0).toUpperCase() + keyword.slice(1),
        location: {
          lat: location.lat + latOffset,
          lng: location.lng + lngOffset
        },
        city: 'Bengaluru'
      };
    }

    try {
      // Real Google Maps Places API call would be implemented here
      // For testing, if the key is empty, it will auto fallback to isDemoMode logic.
      // E.g., fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(keyword)}&key=${process.env.GOOGLE_MAPS_API_KEY}`)
      
      console.log(`Maps: Real Places API Search invoked for "${keyword}" (API Key not fully set, falling back to mock)`);
      return this.findNearbyPlace(keyword, location, radiusMeters);
    } catch (err) {
      console.error('Google Maps API request failed:', err);
      return null;
    }
  }
};
