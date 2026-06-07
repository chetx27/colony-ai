import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Phone, 
  Check, 
  AlertOctagon, 
  Compass, 
  Volume2, 
  ChevronRight, 
  Loader2, 
  User, 
  LogOut,
  Map,
  Star,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import L from 'leaflet';

const BASE_URL = 'http://localhost:3001';

type ViewMode = 'login' | 'queue' | 'navigation';

interface Agent {
  id: string;
  name: string;
  phone: string;
  preferred_language: string;
}

interface QueueItem {
  id: string;
  trackingId: string;
  status: string;
  agentId: string;
  agentName: string;
  customerName: string;
  pin: { lat: number; lng: number } | null;
  hasVoiceNote: boolean;
  navigationStatus: 'ready' | 'processing' | 'standard';
  stepsCount: number;
  createdAt: string;
}

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
  const [view, setView] = useState<ViewMode>('login');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<QueueItem | null>(null);
  const [steps, setSteps] = useState<NavigationStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [agentCoords, setAgentCoords] = useState({ lat: 12.9422, lng: 77.6245 }); // Initial ~800m away
  const [isSimulatingDrive, setIsSimulatingDrive] = useState(false);
  const [showCallMock, setShowCallMock] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showFallbackInfo, setShowFallbackInfo] = useState(false);

  // Audio configuration
  const [audioMuted] = useState(false);
  
  // Feedback states
  const [fbAccuracy, setFbAccuracy] = useState<boolean>(true);
  const [fbLandmarksFound, setFbLandmarksFound] = useState(3);
  const [fbNote, setFbNote] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Map elements
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const agentMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate distance
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distanceToTarget = activeDelivery && activeDelivery.pin 
    ? getDistance(agentCoords.lat, agentCoords.lng, activeDelivery.pin.lat, activeDelivery.pin.lng) 
    : 9999;

  const isWithin500m = distanceToTarget <= 500;

  // Load agents on startup
  useEffect(() => {
    fetch(`${BASE_URL}/api/agent/queue`)
      .then(res => res.json())
      .then(() => {
        // Pre-fill mock agents
        setAgents([
          { id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', name: 'Ramesh Kumar (Kannada)', phone: '+919876543210', preferred_language: 'kn' },
          { id: 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', name: 'Anil Sharma (Hindi)', phone: '+919876543211', preferred_language: 'hi' },
          { id: 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', name: 'Suresh Karthik (Tamil)', phone: '+919876543212', preferred_language: 'ta' }
        ]);
      })
      .catch(err => console.error(err));
  }, []);

  // Fetch queue items
  const loadQueue = () => {
    fetch(`${BASE_URL}/api/agent/queue`)
      .then(res => res.json())
      .then(data => {
        if (selectedAgent) {
          // Filter or just show all for demo
          setQueue(data);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (view === 'queue') {
      loadQueue();
      const interval = setInterval(loadQueue, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [view, selectedAgent]);

  // Handle active navigation start
  const handleStartDelivery = async (item: QueueItem) => {
    setActiveDelivery(item);
    setCurrentStepIdx(0);
    setShowFallbackInfo(false);
    
    // Set starting position ~800m away from the target pin
    const targetPin = item.pin || { lat: 12.9352, lng: 77.6245 };
    setAgentCoords({
      lat: targetPin.lat + 0.007,
      lng: targetPin.lng - 0.003
    });

    try {
      const res = await fetch(`${BASE_URL}/api/delivery/${item.trackingId}/status`);
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps || []);
      }
    } catch (err) {
      console.error(err);
    }

    setView('navigation');
  };

  // Maps Initialization in Navigation mode
  useEffect(() => {
    if (view === 'navigation' && mapContainerRef.current && activeDelivery && activeDelivery.pin && !mapRef.current) {
      const targetPin = activeDelivery.pin;
      
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([agentCoords.lat, agentCoords.lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(mapRef.current);

      const agentIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      });

      const destIcon = L.divIcon({
        html: `<div class="bg-red-500 text-white w-8 h-8 rounded-full border border-white flex items-center justify-center font-bold text-sm shadow-md animate-bounce">📍</div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      agentMarkerRef.current = L.marker([agentCoords.lat, agentCoords.lng], { icon: agentIcon }).addTo(mapRef.current);
      destMarkerRef.current = L.marker([targetPin.lat, targetPin.lng], { icon: destIcon }).addTo(mapRef.current);

      // Add 500m proximity boundary circle around target pin
      circleRef.current = L.circle([targetPin.lat, targetPin.lng], {
        color: '#436cff',
        fillColor: '#436cff',
        fillOpacity: 0.08,
        radius: 500
      }).addTo(mapRef.current);
    }

    return () => {
      if (view !== 'navigation' && mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        agentMarkerRef.current = null;
        destMarkerRef.current = null;
        circleRef.current = null;
      }
    };
  }, [view, activeDelivery]);

  // Sync updates of GPS coords to map markers
  useEffect(() => {
    if (mapRef.current && agentMarkerRef.current) {
      agentMarkerRef.current.setLatLng([agentCoords.lat, agentCoords.lng]);
      
      // Auto pan map keeping agent centered
      if (isWithin500m) {
        // Center closer
        mapRef.current.setView([agentCoords.lat, agentCoords.lng], 17);
      } else {
        mapRef.current.setView([agentCoords.lat, agentCoords.lng], 15);
      }
    }
  }, [agentCoords, isWithin500m]);

  // Auto-play audio when stepping into a new step
  useEffect(() => {
    if (view === 'navigation' && isWithin500m && steps.length > 0) {
      playTTS();
    }
  }, [currentStepIdx, isWithin500m, view, steps]);

  // Play audio using either backend mock audio endpoint or client speech synthesis
  const playTTS = () => {
    if (audioMuted || steps.length === 0) return;
    const currentStep = steps[currentStepIdx];
    
    // Proactive client-side speech synthesis configuration
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentStep.instruction_local);
      
      // Select appropriate locale
      const preferredLanguage = selectedAgent?.preferred_language || 'kn';
      if (preferredLanguage === 'kn') utterance.lang = 'kn-IN';
      else if (preferredLanguage === 'hi') utterance.lang = 'hi-IN';
      else if (preferredLanguage === 'ta') utterance.lang = 'ta-IN';
      else utterance.lang = 'en-IN';

      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
      console.log('Web Speech API: Speaking instruction');
    } else {
      // Audio stream fallback
      const audio = new Audio(`${BASE_URL}/api/audio/mock?step=${currentStep.step_number}&lang=${selectedAgent?.preferred_language}&text=${encodeURIComponent(currentStep.instruction_local)}`);
      audio.play().catch(e => console.warn('Audio play block:', e));
    }
  };

  // Location Simulation logic (Moves agent closer to pin by steps)
  const handleToggleDriveSimulation = () => {
    if (isSimulatingDrive) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      setIsSimulatingDrive(false);
      return;
    }

    if (!activeDelivery || !activeDelivery.pin) return;
    setIsSimulatingDrive(true);

    const targetPin = activeDelivery.pin;
    
    // Simulate coordinates list (heading from current position to target pin)
    simIntervalRef.current = setInterval(async () => {
      setAgentCoords(prev => {
        const deltaLat = (targetPin.lat - prev.lat) * 0.15;
        const deltaLng = (targetPin.lng - prev.lng) * 0.15;
        
        const nextLat = prev.lat + deltaLat;
        const nextLng = prev.lng + deltaLng;
        
        const dist = getDistance(nextLat, nextLng, targetPin.lat, targetPin.lng);
        
        // Post GPS location update
        fetch(`${BASE_URL}/api/agent/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: selectedAgent?.id,
            deliveryId: activeDelivery.id,
            lat: nextLat,
            lng: nextLng
          })
        }).catch(() => {});

        if (dist < 10) {
          // Stop simulation, arrived
          setIsSimulatingDrive(false);
          if (simIntervalRef.current) clearInterval(simIntervalRef.current);
          return targetPin;
        }

        return { lat: nextLat, lng: nextLng };
      });
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const handleNextStep = () => {
    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx(prev => prev + 1);
      setShowFallbackInfo(false);
    } else {
      // Completed last step! Show feedback popup
      setShowFeedbackModal(true);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!activeDelivery) return;
    setIsSubmittingFeedback(true);

    try {
      const res = await fetch(`${BASE_URL}/api/delivery/${activeDelivery.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent?.id,
          outcome: 'delivered',
          stepsAccurate: fbAccuracy,
          landmarksFound: fbLandmarksFound,
          landmarksMissing: steps.length - fbLandmarksFound,
          timeFrom500mSeconds: 120, // Mock time
          agentNote: fbNote
        })
      });

      if (res.ok) {
        setShowFeedbackModal(false);
        setView('queue');
        setActiveDelivery(null);
        setSteps([]);
        // Reset feedback form
        setFbNote('');
        setFbLandmarksFound(3);
        setFbAccuracy(true);
      }
    } catch (err) {
      alert('Failed to submit feedback.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Landmark Icons Lookup
  const getLandmarkIcon = (type: string) => {
    switch(type) {
      case 'atm': return '🏧';
      case 'temple': return '🛕';
      case 'hospital': return '🏥';
      case 'school': return '🏫';
      case 'shop': return '🏪';
      case 'road': return '🛣️';
      case 'building': return '🏢';
      default: return '📍';
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen p-2 md:p-6 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 font-sans">
      
      {/* Mobile Frame Container */}
      <div className="relative w-full max-w-md h-[840px] flex flex-col glass rounded-3xl shadow-2xl overflow-hidden border border-slate-800">
        
        {/* Top Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-900 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-lg font-display tracking-tight text-white">
              Colony<span className="text-brand-400">IQ</span> Agent
            </span>
          </div>
          {selectedAgent && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-300 flex items-center gap-1 font-semibold">
                <User className="w-3.5 h-3.5 text-brand-400" /> {selectedAgent.name.split(' ')[0]}
              </span>
              <button 
                onClick={() => {
                  setSelectedAgent(null);
                  setView('login');
                  setIsSimulatingDrive(false);
                  if (simIntervalRef.current) clearInterval(simIntervalRef.current);
                }}
                className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </header>

        {/* Content Views */}
        <main className="flex-1 overflow-y-auto flex flex-col relative">

          {/* VIEW: LOGIN */}
          {view === 'login' && (
            <div className="flex-grow flex flex-col justify-between p-6">
              <div className="my-auto space-y-8 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-brand-500/10 border border-brand-500/20 rounded-full flex items-center justify-center text-brand-400 shadow-lg animate-pulse">
                  <Compass className="w-10 h-10" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold font-display text-white tracking-tight leading-tight">
                    Agent Portal
                  </h1>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                    Select your assigned profile credentials to display your active delivery list queue.
                  </p>
                </div>

                <div className="w-full space-y-3">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgent(agent);
                        setView('queue');
                      }}
                      className="w-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-brand-500/50 rounded-2xl py-4 px-4 text-left text-sm text-slate-200 transition-all font-semibold flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4 text-brand-400" /> {agent.name}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-center text-[10px] text-slate-500 font-semibold tracking-widest uppercase">COLONYIQ SYSTEMS v1.0.0</div>
            </div>
          )}

          {/* VIEW: QUEUE */}
          {view === 'queue' && (
            <div className="flex-1 flex flex-col p-6 space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-display text-white">Active Queue list</h2>
                <p className="text-xs text-slate-400">Tap cards to start AI satellite landmark-based routing.</p>
              </div>

              {queue.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                  <p className="text-xs text-slate-500 font-semibold">Checking queue deliveries...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {queue.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleStartDelivery(item)}
                      className="glass bg-slate-950/40 hover:bg-slate-900/80 border border-slate-800 hover:border-brand-500/30 p-5 rounded-2xl cursor-pointer transition-all space-y-4 relative"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <span className="text-xs font-mono text-slate-500 font-bold uppercase">ORDER REF</span>
                          <h3 className="font-bold text-white text-base leading-none">{item.trackingId}</h3>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          item.navigationStatus === 'ready' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : item.navigationStatus === 'processing' 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                              : 'bg-slate-800 text-slate-400'
                        }`}>
                          {item.navigationStatus === 'ready' ? 'AI Navigation Ready' : item.navigationStatus === 'processing' ? 'AI Processing' : 'Standard'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 border-t border-slate-900 pt-3">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-brand-400" />
                          <span>Koramangala 4th Block</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-800" />
                        <div>{item.stepsCount > 0 ? `${item.stepsCount} Steps` : 'GPS Standard'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW: NAVIGATION */}
          {view === 'navigation' && activeDelivery && (
            <div className="flex-1 flex flex-col relative h-full">
              
              {/* Map split pane */}
              <div 
                className={`relative bg-slate-900 transition-all duration-300 ${
                  isWithin500m ? 'absolute bottom-4 right-4 w-28 h-28 rounded-full border border-slate-700 shadow-2xl z-[1000] overflow-hidden' : 'h-[40%]'
                }`}
              >
                <div ref={mapContainerRef} className="w-full h-full" />
                
                {/* Auto Drive Simulation Controller */}
                {!isWithin500m && (
                  <div className="absolute top-4 left-4 z-[1000]">
                    <button
                      onClick={handleToggleDriveSimulation}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors shadow-md flex items-center gap-1.5 ${
                        isSimulatingDrive 
                          ? 'bg-amber-600 border-amber-500 text-white animate-pulse' 
                          : 'bg-slate-800 border-slate-700 text-brand-400 hover:bg-slate-700'
                      }`}
                    >
                      <Compass className={`w-3.5 h-3.5 ${isSimulatingDrive ? 'animate-spin' : ''}`} />
                      {isSimulatingDrive ? 'Driving (30km/h)' : 'Simulate Drive'}
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation Instruction Area */}
              <div className="flex-1 flex flex-col justify-between bg-slate-950 p-6">
                
                {/* PHASE 1: > 500m (Standard Directions Map) */}
                {!isWithin500m && (
                  <div className="flex-grow flex flex-col justify-center items-center text-center space-y-5">
                    <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400 border border-brand-500/20">
                      <Map className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-white">En Route</h3>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                        Routing with GPS Directions to customer pin. AI turn-by-turn guidance takes over automatically under 500 meters.
                      </p>
                    </div>

                    <div className="glass-light p-4 rounded-xl border border-slate-800 w-full max-w-xs space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">DISTANCE REMAINING</div>
                      <div className="text-2xl font-bold font-mono text-white">
                        {distanceToTarget > 1000 
                          ? `${(distanceToTarget / 1000).toFixed(2)} km` 
                          : `${distanceToTarget.toFixed(0)} meters`}
                      </div>
                    </div>
                  </div>
                )}

                {/* PHASE 2: <= 500m (AI Landmark Turn-by-Turn Guidance) */}
                {isWithin500m && (
                  <div className="flex-grow flex flex-col space-y-4">
                    
                    {/* Header Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping"></span>
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">ColonyIQ Landmark mode</span>
                      </div>
                      <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-full text-slate-300 font-bold">
                        {currentStepIdx + 1} / {steps.length}
                      </span>
                    </div>

                    {/* Step guidance card */}
                    {steps.length > 0 ? (
                      <div className="glass-brand p-5 rounded-2xl border border-brand-500/20 space-y-4 shadow-lg shadow-brand-500/5 flex-grow flex flex-col justify-between">
                        
                        <div className="space-y-3">
                          {/* Landmark Icon Illustration */}
                          <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                            {getLandmarkIcon(steps[currentStepIdx].landmark_type)}
                          </div>
                          
                          {/* Instructions */}
                          <div className="space-y-2">
                            <h3 className="text-lg font-bold text-white leading-tight">
                              {steps[currentStepIdx].instruction_local}
                            </h3>
                            <p className="text-sm text-slate-400 italic font-medium">
                              "{steps[currentStepIdx].instruction_english}"
                            </p>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                          <button
                            onClick={playTTS}
                            className="bg-brand-500 hover:bg-brand-600 text-white py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-colors shadow-md cursor-pointer"
                          >
                            <Volume2 className="w-4 h-4" /> Repeat Audio
                          </button>

                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            steps[currentStepIdx].verified 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {steps[currentStepIdx].verified ? 'Verified Landmark' : 'Customer Instruction'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-grow flex items-center justify-center text-center py-6">
                        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                      </div>
                    )}

                    {/* Fallback Help box */}
                    {showFallbackInfo && steps[currentStepIdx] && (
                      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl space-y-2 text-xs text-red-400 animate-[fadeIn_0.2s_ease-out]">
                        <div className="font-bold flex items-center gap-1.5 uppercase tracking-wider">
                          <AlertOctagon className="w-4 h-4" /> Fallback Guidance
                        </div>
                        <p className="italic leading-relaxed">
                          "{steps[currentStepIdx].fallback || 'No specific fallback. Call customer.'}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation Controls footer */}
                <div className="pt-4 border-t border-slate-900 space-y-3">
                  {isWithin500m ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowFallbackInfo(true);
                          // Nudge customer call trigger
                          setShowCallMock(true);
                        }}
                        className="flex-1 py-4 border border-slate-800 hover:bg-slate-800 rounded-xl font-semibold text-red-400 text-center transition-colors text-sm"
                      >
                        Can't find it
                      </button>
                      <button
                        onClick={handleNextStep}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-semibold text-center transition-colors text-sm flex items-center justify-center gap-1"
                      >
                        Found it <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setView('queue')}
                      className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-semibold text-slate-300 transition-colors text-sm"
                    >
                      Back to Queue
                    </button>
                  )}
                </div>

              </div>

            </div>
          )}

        </main>

        {/* Real-time Call Customer Dialog Overlay */}
        {showCallMock && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col justify-center items-center text-center p-6 z-[2000]">
            <div className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 animate-bounce mb-6 shadow-inner">
              <Phone className="w-10 h-10" />
            </div>
            <div className="space-y-1 mb-8">
              <h3 className="text-xl font-bold text-white">Calling Customer</h3>
              <p className="text-xs text-slate-400">Order ID: {activeDelivery?.trackingId}</p>
              <p className="text-sm font-mono text-slate-300 font-bold pt-2">+91 98765 43210</p>
            </div>
            
            <button
              onClick={() => setShowCallMock(false)}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase transition-colors"
            >
              End Call
            </button>
          </div>
        )}

        {/* Delivery Feedback Modal Dialog */}
        {showFeedbackModal && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-6 z-[2000] overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white font-display">Mark Delivered</h3>
                <p className="text-xs text-slate-400">Submit routing feedback to improve landmark database.</p>
              </div>

              {/* Accuracy Question */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Were AI steps accurate?</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFbAccuracy(true)}
                    className={`flex-1 py-3.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all font-semibold text-sm ${
                      fbAccuracy 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold' 
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" /> Yes, perfect
                  </button>
                  <button
                    onClick={() => setFbAccuracy(false)}
                    className={`flex-1 py-3.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all font-semibold text-sm ${
                      !fbAccuracy 
                        ? 'bg-red-500/10 border-red-500 text-red-400 font-bold' 
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" /> Inaccurate
                  </button>
                </div>
              </div>

              {/* Landmarks rating */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">How many landmarks did you locate?</label>
                <div className="flex items-center gap-2 justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-850">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button
                      key={stars}
                      onClick={() => setFbLandmarksFound(stars)}
                      className={`p-1.5 rounded-lg transition-all ${
                        fbLandmarksFound >= stars ? 'text-amber-400 scale-110' : 'text-slate-600'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent Comments</label>
                <textarea
                  value={fbNote}
                  onChange={(e) => setFbNote(e.target.value)}
                  placeholder="e.g. Red gate was faded, ICICI board is fallen down..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-900 flex gap-3">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="flex-1 py-4 border border-slate-800 text-slate-400 font-bold rounded-xl text-center text-xs uppercase"
              >
                Back
              </button>
              <button
                onClick={handleFeedbackSubmit}
                disabled={isSubmittingFeedback}
                className="flex-grow bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold text-center text-xs uppercase shadow-md flex items-center justify-center gap-1"
              >
                {isSubmittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Complete Order
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
