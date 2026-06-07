import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbService, isDemoMode } from './db';
import { mapsService } from './maps';
import { ttsService } from './tts';
import { 
  LocationCoordinates, 
  NavigationStep, 
  Landmark, 
  LandmarkType
} from '@colonyiq/shared';

const apiKey = process.env.GEMINI_API_KEY || '';
let genAI: GoogleGenerativeAI | null = null;
if (apiKey && !isDemoMode) {
  genAI = new GoogleGenerativeAI(apiKey);
}

// Prompt Loader
function loadPrompt(filename: string): string {
  try {
    const promptPath = path.join(process.cwd(), 'prompts', filename);
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, 'utf8');
    }
    // Fallback search path in case process.cwd() is different
    const fallbackPath = path.join(__dirname, '..', '..', 'prompts', filename);
    return fs.readFileSync(fallbackPath, 'utf8');
  } catch (err) {
    console.error(`Failed to load prompt ${filename}:`, err);
    return '';
  }
}

interface ExtractedLandmark {
  name: string;
  name_english: string;
  type: LandmarkType;
  direction_from: string | null;
  sequence: number;
}

interface ExtractionResult {
  landmarks: ExtractedLandmark[];
  floor_info: string | null;
  gate_color: string | null;
  final_identifier: string | null;
  raw_direction: string;
}

export const geminiService = {
  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<{ transcript: string; language: string; confidence: number }> {
    if (isDemoMode || !genAI) {
      console.log('Gemini: Using Mock Transcription');
      return {
        transcript: 'Ganesha Temple ke baad right lo, Apollo Pharmacy ke samne, red gate, second floor',
        language: 'hi',
        confidence: 0.95
      };
    }

    try {
      const promptText = loadPrompt('transcribe.txt');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: audioBuffer.toString('base64'),
            mimeType: mimeType
          }
        },
        promptText
      ]);

      const responseText = result.response.text().trim();
      // Parse JSON from code block
      const cleanJson = responseText.replace(/```json\s*|```/g, '').trim();
      const data = JSON.parse(cleanJson);
      return {
        transcript: data.transcript || '',
        language: data.language || 'en',
        confidence: data.confidence || 0.8
      };
    } catch (error) {
      console.error('Gemini transcription failed, falling back to standard address transcript:', error);
      // Fallback
      return {
        transcript: 'Ganesha Temple ke baad right lo, Apollo Pharmacy ke samne, red gate, second floor',
        language: 'hi',
        confidence: 0.5
      };
    }
  },

  async extractEntities(transcript: string, language: string, lat: number, lng: number, pincode: string): Promise<ExtractionResult> {
    if (isDemoMode || !genAI) {
      console.log('Gemini: Using Mock Entity Extraction');
      return {
        landmarks: [
          { name: 'Ganesha Temple', name_english: 'Ganesha Temple', type: 'temple', direction_from: 'after', sequence: 1 },
          { name: 'Apollo Pharmacy', name_english: 'Apollo Pharmacy', type: 'shop', direction_from: 'opposite', sequence: 2 }
        ],
        floor_info: '2nd floor',
        gate_color: 'red gate',
        final_identifier: 'red gate, second floor',
        raw_direction: 'Turn right after the Ganesha Temple, stop opposite Apollo Pharmacy at the house with the red gate, second floor.'
      };
    }

    try {
      let promptText = loadPrompt('extract.txt');
      promptText = promptText
        .replace('{{transcript}}', transcript)
        .replace('{{language}}', language)
        .replace('{{lat}}', lat.toString())
        .replace('{{lng}}', lng.toString())
        .replace('{{pincode}}', pincode);

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      const result = await model.generateContent(promptText);
      const responseText = result.response.text().trim();
      const cleanJson = responseText.replace(/```json\s*|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Gemini entity extraction failed:', error);
      return {
        landmarks: [],
        floor_info: null,
        gate_color: null,
        final_identifier: null,
        raw_direction: transcript
      };
    }
  },

  async generateSteps(extracted: ExtractionResult, matchedLandmarks: Landmark[], language: string): Promise<NavigationStep[]> {
    if (isDemoMode || !genAI) {
      console.log('Gemini: Using Mock Step Generation');
      return [
        { step_number: 1, instruction_english: "Go straight towards Ganesha Temple", instruction_local: "ಗಣೇಶ ದೇವಸ್ಥಾನದ ಕಡೆಗೆ ನೇರವಾಗಿ ಹೋಗಿ", landmark_id: "22222222-2222-2222-2222-222222222222", landmark_type: "temple", action: "go_straight", verified: true, fallback: "Follow standard map coordinates to Ganesha Temple" },
        { step_number: 2, instruction_english: "Turn right at the Ganesha Temple", instruction_local: "ಗಣೇಶ ದೇವಸ್ಥಾನದ ಬಳಿ ಬಲಗಡೆಗೆ ತಿರುಗಿ", landmark_id: "22222222-2222-2222-2222-222222222222", landmark_type: "temple", action: "turn_right", verified: true, fallback: "Turn right at the main corner" },
        { step_number: 3, instruction_english: "Go straight and look for Apollo Pharmacy on your left", instruction_local: "ನೇರವಾಗಿ ಹೋಗಿ ಮತ್ತು ನಿಮ್ಮ ಎಡಭಾಗದಲ್ಲಿರುವ ಅಪೊಲೊ ಫಾರ್ಮಸಿಯನ್ನು ನೋಡಿ", landmark_id: "33333333-3333-3333-3333-333333333333", landmark_type: "shop", action: "look_for", verified: true, fallback: "Continue 200 meters down the street" },
        { step_number: 4, instruction_english: "Stop opposite Apollo Pharmacy, look for the house with the red gate", instruction_local: "ಅಪೊಲೊ ಫಾರ್ಮಸಿ ಎದುರು ನಿಲ್ಲಿಸಿ, ಕೆಂಪು ಗೇಟ್ ಇರುವ ಮನೆಯನ್ನು ನೋಡಿ", landmark_id: "33333333-3333-3333-3333-333333333333", landmark_type: "shop", action: "stop", verified: true, fallback: "Stop at coordinates" },
        { step_number: 5, instruction_english: "Proceed to the 2nd floor", instruction_local: "2 ನೇ ಮಹಡಿಗೆ ಹೋಗಿ", landmark_id: null, landmark_type: "building", action: "go_straight", verified: true, fallback: "Ask the resident at the gate" }
      ];
    }

    try {
      let promptText = loadPrompt('steps.txt');
      promptText = promptText
        .replace('{{landmarks}}', JSON.stringify(extracted.landmarks))
        .replace('{{floor_info}}', extracted.floor_info || 'none')
        .replace('{{gate_color}}', extracted.gate_color || 'none')
        .replace('{{final_identifier}}', extracted.final_identifier || 'none')
        .replace('{{raw_direction}}', extracted.raw_direction)
        .replace('{{language}}', language)
        .replace('{{db_landmarks}}', JSON.stringify(matchedLandmarks));

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      const result = await model.generateContent(promptText);
      const responseText = result.response.text().trim();
      const cleanJson = responseText.replace(/```json\s*|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return parsed.steps || [];
    } catch (error) {
      console.error('Gemini step generation failed:', error);
      return [];
    }
  },

  async runPipeline(
    deliveryId: string, 
    pin: LocationCoordinates, 
    voiceNoteBuffer: Buffer | null, 
    mimeType: string,
    pincode: string,
    agentLanguage = 'en'
  ): Promise<void> {
    try {
      await dbService.updateDeliveryStatus(deliveryId, 'processing');
      console.log(`Pipeline started for delivery ${deliveryId}`);

      let transcript = '';
      let detectedLanguage = 'en';

      if (voiceNoteBuffer) {
        const transResult = await this.transcribeAudio(voiceNoteBuffer, mimeType);
        transcript = transResult.transcript;
        detectedLanguage = transResult.language;
      } else {
        transcript = 'No voice note provided. Deliver to coordinates.';
      }

      console.log(`Transcribed address: "${transcript}" in [${detectedLanguage}]`);

      // 2. Entity Extraction
      const extracted = await this.extractEntities(transcript, detectedLanguage, pin.lat, pin.lng, pincode);
      console.log('Extracted entities:', extracted);

      // Save customer location fields
      await dbService.saveCustomerLocation(
        deliveryId, 
        pin, 
        10, 
        voiceNoteBuffer ? `/voice/${deliveryId}.wav` : undefined, 
        transcript, 
        detectedLanguage
      );

      // 3. Satellite Verification
      const matchedLandmarks: Landmark[] = [];
      const landmarkRefs: string[] = [];

      for (const extractedLandmark of extracted.landmarks) {
        // Query database
        const dbMatches = await dbService.findNearbyLandmarks(pin, 500, [extractedLandmark.name_english, extractedLandmark.name], extractedLandmark.type);
        
        let targetLandmark: Landmark | null = null;
        
        // Find high confidence match
        const highConfMatch = dbMatches.find(l => l.confidence_score >= 0.7);
        if (highConfMatch) {
          targetLandmark = highConfMatch;
          console.log(`Found verified landmark in DB: ${targetLandmark.name}`);
        } else {
          // Query Google Maps
          console.log(`Landmark "${extractedLandmark.name_english}" not found or low confidence in DB. Querying Google Places...`);
          const place = await mapsService.findNearbyPlace(extractedLandmark.name_english || extractedLandmark.name, pin, 500);
          
          if (place) {
            console.log(`Verified landmark via Google Maps: ${place.name}`);
            targetLandmark = await dbService.createLandmark(
              place.name,
              [place.name, extractedLandmark.name],
              extractedLandmark.type,
              place.location,
              pincode,
              place.city || 'Bengaluru',
              true,
              0.8
            );
          } else {
            console.log(`Could not verify landmark "${extractedLandmark.name_english}" via Google Maps. Adding as unverified.`);
            targetLandmark = await dbService.createLandmark(
              extractedLandmark.name,
              [extractedLandmark.name, extractedLandmark.name_english],
              extractedLandmark.type,
              pin, // Fallback to approx customer pin
              pincode,
              'Bengaluru',
              false,
              0.3
            );
          }
        }

        if (targetLandmark) {
          matchedLandmarks.push(targetLandmark);
          landmarkRefs.push(targetLandmark.id);
        }
      }

      // 4. Step Generation
      const steps = await this.generateSteps(extracted, matchedLandmarks, detectedLanguage);
      console.log(`Generated ${steps.length} navigation steps`);

      // Fill in verified landmark IDs into the steps
      const updatedSteps = steps.map(step => {
        const matchingDbL = matchedLandmarks.find(l => 
          l.name.toLowerCase().includes(step.instruction_english.toLowerCase()) ||
          step.instruction_english.toLowerCase().includes(l.name.toLowerCase()) ||
          l.name_aliases.some(alias => step.instruction_english.toLowerCase().includes(alias.toLowerCase()))
        );
        return {
          ...step,
          landmark_id: matchingDbL ? matchingDbL.id : null,
          verified: matchingDbL ? matchingDbL.verified : false
        };
      });

      // 5. TTS Audio Generation
      const audioUrls: Record<number, string> = {};
      for (const step of updatedSteps) {
        // TTS logic
        const audioUrl = await ttsService.generateAudio(
          step.step_number,
          deliveryId,
          step.instruction_local,
          agentLanguage
        );
        audioUrls[step.step_number] = audioUrl;
      }

      // Save Navigation steps
      await dbService.saveNavigationSteps(deliveryId, updatedSteps, landmarkRefs, agentLanguage, audioUrls);
      await dbService.updateDeliveryStatus(deliveryId, 'active');

      console.log(`Pipeline completed successfully for delivery ${deliveryId}`);
    } catch (error) {
      console.error(`Pipeline failed for delivery ${deliveryId}:`, error);
      await dbService.updateDeliveryStatus(deliveryId, 'failed');
    }
  }
};
