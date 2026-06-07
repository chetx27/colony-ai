import { isDemoMode } from './db';

const voiceMap: Record<string, { languageCode: string; name: string }> = {
  kn: { languageCode: 'kn-IN', name: 'kn-IN-Wavenet-A' },
  hi: { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-B' },
  ta: { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-A' },
  te: { languageCode: 'te-IN', name: 'te-IN-Wavenet-A' },
  en: { languageCode: 'en-IN', name: 'en-IN-Wavenet-A' }
};

export const ttsService = {
  async generateAudio(
    stepNumber: number, 
    deliveryId: string, 
    text: string, 
    language: string
  ): Promise<string> {
    if (isDemoMode) {
      console.log(`TTS: Mocking audio generation for step ${stepNumber} in "${language}": "${text}"`);
      // Return a simulated URL path
      return `/api/audio/mock?step=${stepNumber}&lang=${language}&text=${encodeURIComponent(text)}`;
    }

    try {
      // Real Google Cloud TTS setup would be imported here
      // For instance:
      // const textToSpeech = require('@google-cloud/text-to-speech');
      // const client = new textToSpeech.TextToSpeechClient();
      // const voice = voiceMap[language] || voiceMap.en;
      // const [response] = await client.synthesizeSpeech({
      //   input: { text },
      //   voice,
      //   audioConfig: { audioEncoding: 'MP3' }
      // });
      // Save buffer response.audioContent to Supabase storage under `/audio/${deliveryId}/step_${stepNumber}.mp3`
      
      console.log(`TTS: Real GCS TTS invoked for "${text}" (API credentials not fully configured, returning mock URL)`);
      return `/api/audio/mock?step=${stepNumber}&lang=${language}&text=${encodeURIComponent(text)}`;
    } catch (error) {
      console.error('Google Cloud TTS generation failed, falling back:', error);
      return `/api/audio/mock?step=${stepNumber}&lang=${language}&text=${encodeURIComponent(text)}`;
    }
  }
};
