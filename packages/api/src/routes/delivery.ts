import { Router, Request, Response } from 'express';
import { dbService } from '../services/db';
import { geminiService } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Track jobs for status checks
const jobs = new Map<string, { status: 'running' | 'completed' | 'failed'; error?: string }>();

// POST /api/delivery/:trackingId/navigate
// Triggers AI pipeline async. Returns 202 Accepted + jobId.
router.post('/:trackingId/navigate', async (req: Request, res: Response) => {
  const { trackingId } = req.params;
  const { pin, voiceNote, mimeType, language, pincode } = req.body;

  if (!pin || typeof pin.lat !== 'number' || typeof pin.lng !== 'number') {
    res.status(400).json({ error: 'Invalid or missing GPS pin coordinates.' });
    return;
  }

  try {
    let delivery = await dbService.getDeliveryByTrackingId(trackingId);
    if (!delivery) {
      delivery = await dbService.createDelivery(trackingId);
    }

    const jobId = uuidv4();
    jobs.set(jobId, { status: 'running' });

    // Process voice note if supplied
    let audioBuffer: Buffer | null = null;
    if (voiceNote && typeof voiceNote === 'string') {
      audioBuffer = Buffer.from(voiceNote, 'base64');
    }

    // Run pipeline asynchronously
    geminiService.runPipeline(
      delivery.id,
      pin,
      audioBuffer,
      mimeType || 'audio/wav',
      pincode || '560034',
      language || 'kn'
    ).then(() => {
      jobs.set(jobId, { status: 'completed' });
    }).catch((err) => {
      console.error(`Job ${jobId} failed:`, err);
      jobs.set(jobId, { status: 'failed', error: err.message });
    });

    res.status(202).json({ jobId, status: 'processing', message: 'Navigation pipeline triggered successfully.' });
  } catch (error: any) {
    console.error('Failed to initiate navigation pipeline:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
});

// GET /api/delivery/:trackingId/status
router.get('/:trackingId/status', async (req: Request, res: Response) => {
  const { trackingId } = req.params;

  try {
    const delivery = await dbService.getDeliveryByTrackingId(trackingId);
    if (!delivery) {
      res.status(404).json({ error: 'Delivery not found' });
      return;
    }

    const location = await dbService.getCustomerLocation(delivery.id);
    const stepsData = await dbService.getNavigationSteps(delivery.id);

    res.json({
      id: delivery.id,
      trackingId: delivery.tracking_id,
      status: delivery.status,
      pin: location?.pin || null,
      rawTranscript: location?.raw_transcript || null,
      detectedLanguage: location?.detected_language || null,
      steps: stepsData?.steps || null,
      audioUrls: stepsData?.audio_urls || null
    });
  } catch (error: any) {
    console.error('Failed to fetch status:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
});

// POST /api/delivery/:deliveryId/feedback
router.post('/:deliveryId/feedback', async (req: Request, res: Response) => {
  const { deliveryId } = req.params;
  const { agentId, outcome, stepsAccurate, landmarksFound, landmarksMissing, timeFrom500mSeconds, agentNote } = req.body;

  if (!agentId || !outcome) {
    res.status(400).json({ error: 'AgentId and outcome are required.' });
    return;
  }

  try {
    const feedback = await dbService.saveDeliveryFeedback(
      deliveryId,
      agentId,
      outcome,
      stepsAccurate,
      landmarksFound,
      landmarksMissing,
      timeFrom500mSeconds,
      agentNote
    );

    // Update status
    await dbService.updateDeliveryStatus(deliveryId, outcome === 'delivered' ? 'delivered' : 'failed');

    // Update confidence scores for referenced landmarks in navigation steps
    const stepsData = await dbService.getNavigationSteps(deliveryId);
    if (stepsData && stepsData.steps) {
      for (const step of stepsData.steps) {
        if (step.landmark_id && step.verified) {
          // Increment delivery success counts and recalculate confidence
          if (outcome === 'delivered') {
            await dbService.incrementLandmarkDelivery(step.landmark_id);
          }
        }
      }
    }

    res.json({ success: true, feedback });
  } catch (error: any) {
    console.error('Failed to submit feedback:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
});

export default router;
