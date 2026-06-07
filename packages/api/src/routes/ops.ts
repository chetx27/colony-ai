import { Router, Request, Response } from 'express';
import { dbService, agentLocations } from '../services/db';

const router = Router();

// GET /api/ops/analytics
// Returns success rates, durations, maps telemetry, and pins counts.
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = await dbService.getAnalytics();
    const landmarks = await dbService.getAllLandmarks();
    
    // Format agent positions for live maps
    const agentsList: any[] = [];
    for (const [agentId, loc] of agentLocations.entries()) {
      const agent = await dbService.getAgentById(agentId);
      agentsList.push({
        id: agentId,
        name: agent?.name || 'Unknown',
        location: loc
      });
    }

    res.json({
      ...analytics,
      landmarks,
      liveAgents: agentsList
    });
  } catch (error: any) {
    console.error('Failed to load ops analytics:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
});

// GET /api/ops/landmarks
router.get('/landmarks', async (req: Request, res: Response) => {
  try {
    const landmarks = await dbService.getAllLandmarks();
    res.json(landmarks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ops/landmarks
router.post('/landmarks', async (req: Request, res: Response) => {
  const { name, nameAliases, type, location, pinCode, city, verified, confidenceScore } = req.body;
  if (!name || !type || !location) {
    res.status(400).json({ error: 'Name, type, and location coordinates are required.' });
    return;
  }
  try {
    const lm = await dbService.createLandmark(
      name,
      nameAliases || [name],
      type,
      location,
      pinCode,
      city,
      verified,
      confidenceScore
    );
    res.status(201).json(lm);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ops/landmarks/:id
router.put('/landmarks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const lm = await dbService.updateLandmark(id, req.body);
    if (!lm) {
      res.status(404).json({ error: 'Landmark not found' });
      return;
    }
    res.json(lm);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ops/landmarks/:id
router.delete('/landmarks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const success = await dbService.deleteLandmark(id);
    if (!success) {
      res.status(404).json({ error: 'Landmark not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
