import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Mic, 
  Square, 
  Play, 
  Volume2, 
  Check, 
  Loader2, 
  Navigation, 
  ArrowRight, 
  ChevronRight, 
  ThumbsUp, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import L from 'leaflet';

const BASE_URL = 'http://localhost:3001';

type Screen = 'welcome' | 'pin' | 'voice' | 'processing' | 'confirm' | 'success';

interface NavigationStep {
  step_number: number;
  instruction_english: string;
  instruction_local: string;
  landmark_id: string | null;
  landmark_type: string;
  action: string;
  verified: boolean;
  fallback: string | null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [trackingId, setTrackingId] = useState('DEMO-001');
  const [coords, setCoords] = useState({ lat: 12.9352, lng: 77.6245 }); // Default: Koramangala
  const [originalCoords, setOriginalCoords] = useState({ lat: 12.9352, lng: 77.6245 });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [rawTranscript, setRawTranscript] = useState('');
  const [steps, setSteps] = useState<NavigationStep[]>([]);
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [agentNearby, setAgentNearby] = useState(false);
  const [deliveryComplete, setDeliveryComplete] = useState(false);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Audio Recorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  // Sync tracking ID from URL if provided (/d/ID)
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/d/')) {
      const id = path.split('/d/')[2] || path.split('/d/')[1];
      if (id) setTrackingId(id);
    }
  }, []);

  // Poll for agent events when delivery is confirmed
  useEffect(() => {
    if (screen !== 'confirm') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/agent/events/${trackingId}`);
        if (res.ok) {
          const events = await res.json();
          const nearby = events.some((e: any) => e.type === 'agent_nearby');
          if (nearby) {
            setAgentNearby(true);
          }
        }
      } catch (err) {
        console.error('Failed to poll agent events:', err);
      }
    }, 4000);

    // Also poll delivery status to see if it marks delivered
    const statusInterval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/delivery/${trackingId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'delivered') {
            setDeliveryComplete(true);
            setScreen('success');
          }
        }
      } catch (err) {}
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(statusInterval);
    };
  }, [screen, trackingId]);

  // Leaflet Map Init
  useEffect(() => {
    if (screen === 'pin' && mapContainerRef.current && !mapRef.current) {
      // Initialize map
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false
      }).setView([coords.lat, coords.lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

      // Custom icon
      const mapIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      });

      markerRef.current = L.marker([coords.lat, coords.lng], {
        draggable: true,
        icon: mapIcon
      }).addTo(mapRef.current);

      markerRef.current.on('dragend', () => {
        if (markerRef.current) {
          const newPos = markerRef.current.getLatLng();
          setCoords({ lat: newPos.lat, lng: newPos.lng });
        }
      });
    }

    return () => {
      if (screen !== 'pin' && mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [screen]);

  // Handle browser geolocation trigger
  const fetchCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(loc);
          setOriginalCoords(loc);
          if (mapRef.current && markerRef.current) {
            mapRef.current.setView([loc.lat, loc.lng], 17);
            markerRef.current.setLatLng([loc.lat, loc.lng]);
          }
        },
        (err) => {
          console.warn('Geolocation failed, keeping default coordinates', err);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  // Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const options = { mimeType: 'audio/webm' };
      
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback for Safari/unsupported formats
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 29) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      alert('Microphone permission required for voice notes. Simulating microphone instead.');
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 15) {
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            setAudioBlob(new Blob());
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    if (isPlaying) {
      playbackRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!playbackRef.current) {
        playbackRef.current = new Audio(audioUrl);
        playbackRef.current.onended = () => setIsPlaying(false);
      }
      playbackRef.current.play();
      setIsPlaying(true);
    }
  };

  // Submit Navigation Request
  const handleSubmitVoice = async () => {
    setScreen('processing');
    
    let base64Audio = '';
    if (audioBlob && audioBlob.size > 0) {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        base64Audio = base64data.split(',')[1];
        await triggerPipeline(base64Audio);
      };
    } else {
      // Simulate without audio (DEMO fallback)
      await triggerPipeline('');
    }
  };

  const triggerPipeline = async (base64Audio: string) => {
    try {
      const payload: any = {
        pin: coords,
        language: selectedLanguage,
        pincode: '560034'
      };
      if (base64Audio) {
        payload.voiceNote = base64Audio;
        payload.mimeType = 'audio/wav';
      }

      const res = await fetch(`${BASE_URL}/api/delivery/${trackingId}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Pipeline request failed');

      // Start status polling
      pollStatus();
    } catch (err) {
      console.error(err);
      // Fallback delay then load steps for offline demo
      setTimeout(() => {
        loadMockSteps();
      }, 3000);
    }
  };

  const pollStatus = () => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${BASE_URL}/api/delivery/${trackingId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'active' && data.steps && data.steps.length > 0) {
            setSteps(data.steps);
            setRawTranscript(data.rawTranscript || 'Voice transcript processed');
            setScreen('confirm');
            clearInterval(interval);
          } else if (data.status === 'failed') {
            alert('AI pipeline failed. Surfacing fallback routing.');
            loadMockSteps();
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error(err);
      }

      if (attempts > 15) {
        clearInterval(interval);
        loadMockSteps();
      }
    }, 2500);
  };

  const loadMockSteps = () => {
    setSteps([
      { step_number: 1, instruction_english: "Go straight towards Ganesha Temple", instruction_local: "ಗಣೇಶ ದೇವಸ್ಥಾನದ ಕಡೆಗೆ ನೇರವಾಗಿ ಹೋಗಿ", landmark_id: "22222222", landmark_type: "temple", action: "go_straight", verified: true, fallback: "Follow standard map coordinates to Ganesha Temple" },
      { step_number: 2, instruction_english: "Turn right at the Ganesha Temple", instruction_local: "ಗಣೇಶ ದೇವಸ್ಥಾನದ ಬಳಿ ಬಲಗಡೆಗೆ ತಿರುಗಿ", landmark_id: "22222222", landmark_type: "temple", action: "turn_right", verified: true, fallback: "Turn right at the main corner" },
      { step_number: 3, instruction_english: "Go straight and look for Apollo Pharmacy on your left", instruction_local: "ನೇರವಾಗಿ ಹೋಗಿ ಮತ್ತು ನಿಮ್ಮ ಎಡಭಾಗದಲ್ಲಿರುವ ಅಪೊಲೊ ಫಾರ್ಮಸಿಯನ್ನು ನೋಡಿ", landmark_id: "33333333", landmark_type: "shop", action: "look_for", verified: true, fallback: "Continue 200 meters down the street" }
    ]);
    setRawTranscript('Ganesha Temple ke baad right, Apollo Pharmacy, red gate');
    setScreen('confirm');
  };

  // Submit Text Correction
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionText.trim()) return;

    setIsSubmittingCorrection(true);
    try {
      // Re-trigger pipeline appending correction
      const res = await fetch(`${BASE_URL}/api/delivery/${trackingId}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: coords,
          language: selectedLanguage,
          pincode: '560034',
          // Append text instruction directly as transcript
          voiceNote: Buffer.from(correctionText).toString('base64'),
          mimeType: 'text/plain' 
        })
      });
      if (res.ok) {
        setScreen('processing');
        pollStatus();
      }
    } catch (err) {
      alert('Correction update failed.');
    } finally {
      setIsSubmittingCorrection(false);
      setCorrectionText('');
    }
  };

  const hasMovedPin = () => {
    const distanceMoved = L.latLng(coords.lat, coords.lng).distanceTo(L.latLng(originalCoords.lat, originalCoords.lng));
    return distanceMoved > 50;
  };

  return (
    <div className="flex justify-center items-center min-h-screen p-2 md:p-6 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 font-sans">
      
      {/* Mobile Frame Container */}
      <div className="relative w-full max-w-md h-[840px] flex flex-col glass rounded-3xl shadow-2xl overflow-hidden border border-slate-800">
        
        {/* Top Navbar */}
        <header className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-900">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-brand-500 animate-pulse"></span>
            <span className="font-semibold text-lg font-display tracking-tight text-white flex items-center gap-1">
              Colony<span className="text-brand-400">IQ</span>
            </span>
          </div>
          <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300 font-mono">
            {trackingId}
          </span>
        </header>

        {/* Screen Content */}
        <main className="flex-1 overflow-y-auto flex flex-col relative">

          {/* SCREEN 1: WELCOME */}
          {screen === 'welcome' && (
            <div className="flex-1 flex flex-col justify-between p-6">
              <div className="flex-grow flex flex-col justify-center items-center text-center space-y-6 my-auto">
                <div className="w-20 h-20 bg-brand-500/10 border border-brand-500/20 rounded-full flex items-center justify-center text-brand-400 shadow-inner">
                  <Navigation className="w-10 h-10 animate-bounce" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold font-display text-white tracking-tight leading-tight">
                    Help your delivery agent find you
                  </h1>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                    Drop a precise entrance pin and record a 15-second voice note. Works better than any standard address.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-light p-4 rounded-xl space-y-2 border border-slate-800">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tracking Reference</label>
                  <input 
                    type="text" 
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none transition-all"
                    placeholder="Enter Tracking ID (e.g. DEMO-001)"
                  />
                </div>
                <button 
                  onClick={() => setScreen('pin')}
                  className="w-full bg-brand-500 hover:bg-brand-600 active:scale-[0.98] py-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/15 transition-all text-white"
                >
                  Get started <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 2: PIN DROP */}
          {screen === 'pin' && (
            <div className="flex-1 flex flex-col relative h-full">
              {/* Map Container */}
              <div className="flex-grow relative bg-slate-900" style={{ height: '55%' }}>
                <div ref={mapContainerRef} className="absolute inset-0" />
                <button 
                  onClick={fetchCurrentLocation}
                  className="absolute bottom-4 right-4 z-[1000] p-3 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-md text-brand-400 transition-colors"
                  title="Locate Me"
                >
                  <MapPin className="w-6 h-6" />
                </button>
              </div>

              {/* Bottom Sheet Details */}
              <div className="bg-slate-950 border-t border-slate-900 p-6 flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <h2 className="text-lg font-bold text-white">Drag Pin to your gate</h2>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Place the marker directly on your house entrance gate or main society entry point. Not the middle of the building.
                  </p>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 glass-light px-3 py-2 rounded-lg text-slate-400 text-[10px] space-y-1">
                    <div className="font-semibold text-slate-500">LATITUDE</div>
                    <div className="font-mono text-slate-200 text-xs">{coords.lat.toFixed(5)}</div>
                  </div>
                  <div className="flex-1 glass-light px-3 py-2 rounded-lg text-slate-400 text-[10px] space-y-1">
                    <div className="font-semibold text-slate-500">LONGITUDE</div>
                    <div className="font-mono text-slate-200 text-xs">{coords.lng.toFixed(5)}</div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    // Check if pin was dragged. In simulation bypass restriction but nudge
                    if (!hasMovedPin()) {
                      // Nudge user but proceed
                      console.log("Nudging to drag, but proceeding");
                    }
                    setScreen('voice');
                  }}
                  className="w-full bg-brand-500 hover:bg-brand-600 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-all text-white"
                >
                  Pin looks right <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 3: VOICE RECORDING */}
          {screen === 'voice' && (
            <div className="flex-1 flex flex-col justify-between p-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-bold font-display text-white">Record directions</h2>
                  <p className="text-xs text-slate-400">Speak in your preferred language to describe landmarks.</p>
                </div>

                {/* Language Select */}
                <div className="flex flex-wrap gap-2 py-2">
                  {['en', 'kn', 'hi', 'ta', 'te'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase transition-all ${
                        selectedLanguage === lang 
                          ? 'bg-brand-500 border border-brand-500 text-white' 
                          : 'bg-slate-800 border border-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {lang === 'kn' ? 'ಕನ್ನಡ (KN)' : lang === 'hi' ? 'हिंदी (HI)' : lang === 'ta' ? 'தமிழ் (TA)' : lang === 'te' ? 'తెలుగు (TE)' : 'English (EN)'}
                    </button>
                  ))}
                </div>

                {/* Tips Box */}
                <div className="glass-light p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Prompt Guidelines
                  </h3>
                  <p className="text-sm italic text-slate-300">
                    "{selectedLanguage === 'hi' 
                      ? 'Ganesha Temple ke baad right lo, Apollo Pharmacy ke samne, lal gate, second floor' 
                      : selectedLanguage === 'kn' 
                        ? 'ಗಣೇಶ ದೇವಸ್ಥಾನದ ನಂತರ ಬಲಕ್ಕೆ ತಿರುಗಿ, ಅಪೊಲೊ ಫಾರ್ಮಸಿ ಎದುರು, ಕೆಂಪು ಗೇಟ್, ೨ನೇ ಮಹಡಿ'
                        : 'Take a right after Ganesha Temple, opposite Apollo Pharmacy, red gate, second floor'}"
                  </p>
                </div>
              </div>

              {/* Record Mic Area */}
              <div className="flex flex-col items-center justify-center space-y-6 py-6">
                {isRecording ? (
                  <div className="space-y-4 text-center">
                    {/* Bouncing Visualizer Bars */}
                    <div className="flex items-center gap-1.5 justify-center h-16">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1].map((val, idx) => (
                        <div 
                          key={idx} 
                          className="w-1 bg-brand-500 rounded-full wave-bar"
                          style={{ 
                            height: `${val * 10}%`,
                            animationDelay: `${idx * 0.08}s` 
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-lg font-semibold font-mono text-brand-400">
                      00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} / 00:30
                    </span>
                    <button
                      onClick={stopRecording}
                      className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white cursor-pointer active:scale-95 transition-transform"
                    >
                      <Square className="w-6 h-6 fill-white" />
                    </button>
                  </div>
                ) : audioBlob ? (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex items-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800 w-full justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-brand-400" />
                        <span className="text-xs text-slate-300 font-semibold uppercase">Voice Note Ready</span>
                      </div>
                      <button 
                        onClick={togglePlayback}
                        className="bg-brand-500 hover:bg-brand-600 text-white p-2.5 rounded-full shadow-md transition-colors"
                      >
                        {isPlaying ? <Square className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setAudioBlob(null);
                        setAudioUrl(null);
                      }}
                      className="text-xs text-slate-400 hover:text-white underline font-semibold transition-colors"
                    >
                      Re-record voice note
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <button
                      onClick={startRecording}
                      className="w-24 h-24 rounded-full bg-brand-500 hover:bg-brand-600 animate-pulse-ring flex items-center justify-center text-white cursor-pointer active:scale-95 transition-transform"
                    >
                      <Mic className="w-10 h-10" />
                    </button>
                    <p className="text-xs text-slate-400 font-semibold">Tap to record directions</p>
                  </div>
                )}
              </div>

              {/* Submit Actions */}
              <div className="pt-4 border-t border-slate-900 flex gap-3">
                <button
                  onClick={() => setScreen('pin')}
                  className="flex-1 py-4 border border-slate-800 hover:bg-slate-800 rounded-xl font-semibold text-slate-300 text-center transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitVoice}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 py-4 rounded-xl font-semibold text-white shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  Process AI Route <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 4: PROCESSING */}
          {screen === 'processing' && (
            <div className="flex-1 flex flex-col justify-center items-center p-6 space-y-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
                </div>
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-bold text-white shadow-md animate-bounce">
                  AI
                </span>
              </div>

              <div className="text-center space-y-2 max-w-xs">
                <h2 className="text-2xl font-bold font-display text-white">Analyzing directions...</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Gemini is transcribing your voice note, extracting nearby landmarks, and matching with satellite coordinates.
                </p>
              </div>

              <div className="w-full max-w-xs h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 animate-[pulse_1s_infinite] w-3/4 rounded-full" />
              </div>
              <span className="text-xs text-slate-500 font-mono">ESTIMATED: 10 - 15 SECONDS</span>
            </div>
          )}

          {/* SCREEN 5: CONFIRMATION */}
          {screen === 'confirm' && (
            <div className="flex-1 flex flex-col justify-between p-6">
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold font-display text-white">Extracted navigation</h2>
                  <p className="text-xs text-slate-400">Verify instructions generated for your delivery agent.</p>
                </div>

                {/* Agent Proximity Alert Banner */}
                {agentNearby && !deliveryComplete && (
                  <div className="glass-brand p-4 rounded-xl border border-brand-500/30 flex items-center justify-between text-white animate-bounce">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400">
                        <Navigation className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-brand-300">Agent Alert</div>
                        <div className="text-sm font-semibold">Agent is less than 500m away!</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Extracted Transcript summary */}
                <div className="glass-light p-3 rounded-lg border border-slate-800 text-xs">
                  <div className="font-semibold text-slate-500 uppercase tracking-wider mb-1">Transcript summary</div>
                  <div className="text-slate-300 italic">"{rawTranscript}"</div>
                </div>

                {/* Steps List */}
                <div className="space-y-3">
                  {steps.map((step) => (
                    <div 
                      key={step.step_number}
                      className="glass-light border border-slate-800/80 p-4 rounded-xl flex items-start gap-3 relative overflow-hidden"
                    >
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold border border-brand-500/20 shrink-0">
                        {step.step_number}
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white leading-snug">
                          {step.instruction_english}
                        </p>
                        <p className="text-xs text-slate-400 leading-snug font-display">
                          {step.instruction_local}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            step.verified 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {step.verified ? 'Verified Landmark' : 'Customer Reported'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-900 space-y-3">
                <div className="text-center text-xs text-slate-500 font-semibold mb-2">DOES THIS LOOK RIGHT?</div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setScreen('success')}
                    className="flex-1 bg-brand-500 hover:bg-brand-600 active:scale-95 py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10 transition-all"
                  >
                    <Check className="w-5 h-5" /> Yes, looks good
                  </button>
                </div>

                {/* Correction Input form */}
                <form onSubmit={handleCorrectionSubmit} className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Need corrections? Type details below</div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      placeholder="e.g. Apollo Pharmacy is actually on the right side"
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none transition-colors"
                    />
                    <button 
                      type="submit"
                      disabled={isSubmittingCorrection || !correctionText.trim()}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-brand-400 px-4 rounded-xl flex items-center justify-center transition-colors border border-slate-700"
                    >
                      {isSubmittingCorrection ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SCREEN 6: SUCCESS */}
          {screen === 'success' && (
            <div className="flex-1 flex flex-col justify-between p-6">
              <div className="flex-grow flex flex-col justify-center items-center text-center space-y-6 my-auto">
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 shadow-lg animate-[pulse_2s_infinite]">
                  <ThumbsUp className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold font-display text-white tracking-tight">Setup Completed!</h2>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                    Your landmark directions are finalized and sent. Your agent will see them when they are 500m away.
                  </p>
                </div>

                <div className="glass-light p-4 rounded-xl border border-slate-800/80 w-full max-w-xs space-y-2 text-left text-xs">
                  <div className="font-semibold text-slate-500 uppercase tracking-wider">Delivery Summary</div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tracking Reference:</span>
                    <span className="font-mono text-slate-200">{trackingId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={`font-bold capitalize ${deliveryComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {deliveryComplete ? 'Delivered' : 'Agent Dispatched'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setScreen('welcome');
                  setSteps([]);
                  setAudioBlob(null);
                  setAudioUrl(null);
                  setAgentNearby(false);
                  setDeliveryComplete(false);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-semibold text-slate-300 text-center transition-colors"
              >
                Done
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
