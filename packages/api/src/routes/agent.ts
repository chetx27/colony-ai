import { Router, Request, Response } from 'express';
import { dbService, agentLocations, calculateDistance } from '../services/db';

const router = Router();

// Store active realtime notifications for polling/SSE fallbacks
export interface DeliveryEvent {
  id: string;
  deliveryId: string;
  trackingId: string;
  type: 'agent_nearby' | 'delivered' | 'failed';
  timestamp: string;
}

export const activeEvents: DeliveryEvent[] = [];

// POST /api/agent/location
// Updates agent coordinates. Triggers proximity alert if under 500m.
router.post('/location', async (req: Request, res: Response) => {
  const { agentId, deliveryId, lat, lng } = req.body;

  if (!agentId || !deliveryId || typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'Missing required parameters: agentId, deliveryId, lat, lng' });
    return;
  }

  try {
    // Save location locally for real-time tracking visualization on ops dashboard
    agentLocations.set(agentId, { lat, lng });

    const delivery = await dbService.getDeliveryById(deliveryId);
    if (!delivery) {
      res.status(404).json({ error: 'Delivery not found' });
      return;
    }

    const location = await dbService.getCustomerLocation(deliveryId);
    if (location) {
      const distance = calculateDistance(lat, lng, location.pin.lat, location.pin.lng);
      console.log(`Agent ${agentId} is ${distance.toFixed(1)}m away from delivery ${deliveryId}`);

      // If within 500 meters, push event
      if (distance <= 500) {
        const alreadyNotified = activeEvents.some(
          e => e.deliveryId === deliveryId && e.type === 'agent_nearby'
        );
        if (!alreadyNotified) {
          console.log(`Alert: Agent ${agentId} is within 500m of customer gate! Triggering proximity event.`);
          activeEvents.push({
            id: Math.random().toString(36).substring(7),
            deliveryId,
            trackingId: delivery.tracking_id,
            type: 'agent_nearby',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    res.json({ success: true, tracking: true });
  } catch (error: any) {
    console.error('Failed to update agent location:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
});

// GET /api/agent/queue
// Retrieves list of deliveries for the agent
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const deliveries = await dbService.getAllDeliveries();
    
    // Enrich deliveries with coordinates and steps status
    const enrichedQueue = [];
    for (const d of deliveries) {
      const location = await dbService.getCustomerLocation(d.id);
      const steps = await dbService.getNavigationSteps(d.id);
      const agent = d.agent_id ? await dbService.getAgentById(d.agent_id) : null;

      enrichedQueue.push({
        id: d.id,
        trackingId: d.tracking_id,
        status: d.status,
        agentId: d.agent_id,
        agentName: agent?.name || 'Unassigned',
        customerName: 'Customer (' + d.tracking_id + ')',
        pin: location?.pin || null,
        hasVoiceNote: !!location?.voice_note_url,
        navigationStatus: steps ? 'ready' : (d.status === 'processing' ? 'processing' : 'standard'),
        stepsCount: steps?.steps?.length || 0,
        createdAt: d.created_at
      });
    }

    res.json(enrichedQueue);
  } catch (error: any) {
    console.error('Failed to load queue:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
});

// GET /api/delivery/:trackingId/events
// Endpoint for customers to check if they have notifications
router.get('/events/:trackingId', (req: Request, res: Response) => {
  const { trackingId } = req.params;
  const events = activeEvents.filter(e => e.trackingId === trackingId);
  res.json(events);
});

export default router;
