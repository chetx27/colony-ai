import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import deliveryRouter from './routes/delivery';
import agentRouter from './routes/agent';
import opsRouter from './routes/ops';

// Load environmental variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS setup for customer PWA, agent app, and ops dashboard
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Body parsers with limits for base64 audio uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date() });
});

// Dynamic Silent WAV Generator for Mock TTS
// Generates a valid 1-second 8kHz 8-bit mono PCM WAV file
function generateSilentWav(): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 8;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const durationSeconds = 1.5;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const totalSize = 36 + dataSize;
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Fill data with 8-bit audio silence (128)
  buffer.fill(128, 44);
  
  return buffer;
}

// GET /api/audio/mock
// Serves mock audio stream so client players do not crash
app.get('/api/audio/mock', (req: Request, res: Response) => {
  const { step, lang, text } = req.query;
  console.log(`Streaming mock audio for step ${step} [${lang}]: "${text}"`);
  
  const wavBuffer = generateSilentWav();
  
  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': wavBuffer.length,
    'Accept-Ranges': 'bytes'
  });
  
  res.end(wavBuffer);
});

// Register routes
app.use('/api/delivery', deliveryRouter);
app.use('/api/agent', agentRouter);
app.use('/api/ops', opsRouter);

// Start listening
app.listen(port, () => {
  console.log(`ColonyIQ API Server is running on port ${port}`);
});
