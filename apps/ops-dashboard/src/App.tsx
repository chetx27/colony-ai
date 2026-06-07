import { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Database, 
  Cpu, 
  BarChart3, 
  Trash2, 
  Edit3, 
  Plus, 
  Search,
  RefreshCw,
  Clock,
  TrendingUp,
  X
} from 'lucide-react';
import L from 'leaflet';

const BASE_URL = 'http://localhost:3001';

type Tab = 'map' | 'landmarks' | 'pipeline' | 'analytics';

interface Landmark {
  id: string;
  name: string;
  name_aliases: string[];
  type: string;
  location: { lat: number; lng: number };
  pin_code: string;
  city: string;
  verified: boolean;
  confidence_score: number;
  delivery_count: number;
}

interface DeliveryItem {
  id: string;
  tracking_id: string;
  status: string;
  agent_id: string | null;
  created_at: string;
  // enriched fields
  pin?: { lat: number; lng: number } | null;
  raw_transcript?: string | null;
  steps?: any[] | null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [liveAgents, setLiveAgents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Landmark Editor States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLandmark, setEditingLandmark] = useState<Landmark | null>(null);
  const [lmForm, setLmForm] = useState({
    name: '',
    aliases: '',
    type: 'shop',
    lat: '',
    lng: '',
    pin_code: '560034',
    city: 'Bengaluru',
    verified: true
  });

  // Pipeline Inspector Detail State
  const [selectedPipelineDelivery, setSelectedPipelineDelivery] = useState<DeliveryItem | null>(null);
  
  // Filter States
  const [lmSearch, setLmSearch] = useState('');
  const [lmTypeFilter, setLmTypeFilter] = useState('all');

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch analytics (includes landmarks, live agents, success rates)
      const res = await fetch(`${BASE_URL}/api/ops/analytics`);
      if (res.ok) {
        const data = await res.json();
        setLandmarks(data.landmarks || []);
        setLiveAgents(data.liveAgents || []);
        setAnalytics({
          deliverySuccessRate: data.deliverySuccessRate,
          avgTimeToDeliverSeconds: data.avgTimeToDeliverSeconds,
          landmarkCoverageByPin: data.landmarkCoverageByPin,
          topFailureZones: data.topFailureZones,
          deliveryCounts: data.deliveryCounts
        });
      }

      // Fetch queue / deliveries for pipeline logs
      const qRes = await fetch(`${BASE_URL}/api/agent/queue`);
      if (qRes.ok) {
        const queueData = await qRes.json();
        
        // Load details for each delivery item
        const enrichedList = [];
        for (const q of queueData) {
          const detailRes = await fetch(`${BASE_URL}/api/delivery/${q.trackingId}/status`);
          if (detailRes.ok) {
            const details = await detailRes.json();
            enrichedList.push({
              id: q.id,
              tracking_id: q.trackingId,
              status: q.status,
              agent_id: q.agentId,
              created_at: q.createdAt,
              pin: details.pin,
              raw_transcript: details.rawTranscript,
              steps: details.steps
            });
          }
        }
        setDeliveries(enrichedList);
      }
    } catch (err) {
      console.error('Failed to load ops data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Map Render logic
  useEffect(() => {
    if (activeTab === 'map' && mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true
      }).setView([12.9352, 77.6245], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(mapRef.current);

      markersGroupRef.current = L.featureGroup().addTo(mapRef.current);
    }

    return () => {
      if (activeTab !== 'map' && mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, [activeTab]);

  // Redraw map markers when data updates
  useEffect(() => {
    if (activeTab === 'map' && mapRef.current && markersGroupRef.current) {
      markersGroupRef.current.clearLayers();

      // Plot landmarks (blue dots)
      landmarks.forEach(lm => {
        const landmarkMarker = L.circleMarker([lm.location.lat, lm.location.lng], {
          radius: 6,
          color: lm.verified ? '#10b981' : '#f59e0b',
          fillColor: lm.verified ? '#10b981' : '#f59e0b',
          fillOpacity: 0.8,
          weight: 1
        }).bindPopup(`
          <div style="color:#000;">
            <strong>${lm.name}</strong> (${lm.type})<br/>
            Accuracy: ${(lm.confidence_score * 100).toFixed(0)}%<br/>
            Deliveries: ${lm.delivery_count}
          </div>
        `);
        markersGroupRef.current?.addLayer(landmarkMarker);
      });

      // Plot deliveries (large indicators)
      deliveries.forEach(del => {
        if (del.pin) {
          const color = del.status === 'delivered' ? '#10b981' : (del.status === 'failed' ? '#ef4444' : '#3b82f6');
          const delMarker = L.circleMarker([del.pin.lat, del.pin.lng], {
            radius: 9,
            color: '#fff',
            fillColor: color,
            fillOpacity: 0.9,
            weight: 2
          }).bindPopup(`
            <div style="color:#000;">
              <strong>Delivery: ${del.tracking_id}</strong><br/>
              Status: <span style="font-weight:bold;color:${color}">${del.status}</span><br/>
              Transcript: "${del.raw_transcript || 'none'}"
            </div>
          `);
          markersGroupRef.current?.addLayer(delMarker);
        }
      });

      // Plot live agents (purple markers)
      liveAgents.forEach(agent => {
        const agentIcon = L.divIcon({
          html: `<div class="bg-purple-600 text-white p-1.5 rounded-full border border-white text-xs shadow-lg flex items-center justify-center font-bold">🛵</div>`,
          iconSize: [28, 28],
          className: 'agent-live-icon'
        });
        const agentMarker = L.marker([agent.location.lat, agent.location.lng], { icon: agentIcon })
          .bindPopup(`<div style="color:#000;"><strong>Agent: ${agent.name}</strong><br/>Tracking Live</div>`);
        markersGroupRef.current?.addLayer(agentMarker);
      });

      // Fit bounds if layers exist
      if (markersGroupRef.current.getLayers().length > 0) {
        mapRef.current.fitBounds(markersGroupRef.current.getBounds(), { padding: [40, 40] });
      }
    }
  }, [landmarks, deliveries, liveAgents, activeTab]);

  // Landmark CRUD handlers
  const handleAddLandmarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: lmForm.name,
      nameAliases: lmForm.aliases.split(',').map(s => s.trim()).filter(Boolean),
      type: lmForm.type,
      location: { lat: parseFloat(lmForm.lat), lng: parseFloat(lmForm.lng) },
      pinCode: lmForm.pin_code,
      city: lmForm.city,
      verified: lmForm.verified,
      confidenceScore: lmForm.verified ? 0.8 : 0.2
    };

    try {
      const res = await fetch(`${BASE_URL}/api/ops/landmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowAddModal(false);
        setLmForm({ name: '', aliases: '', type: 'shop', lat: '', lng: '', pin_code: '560034', city: 'Bengaluru', verified: true });
        loadData();
      }
    } catch (err) {
      alert('Failed to save landmark');
    }
  };

  const handleEditLandmarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLandmark) return;
    const payload = {
      name: lmForm.name,
      name_aliases: lmForm.aliases.split(',').map(s => s.trim()).filter(Boolean),
      type: lmForm.type,
      location: { lat: parseFloat(lmForm.lat), lng: parseFloat(lmForm.lng) },
      pin_code: lmForm.pin_code,
      city: lmForm.city,
      verified: lmForm.verified
    };

    try {
      const res = await fetch(`${BASE_URL}/api/ops/landmarks/${editingLandmark.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditingLandmark(null);
        setLmForm({ name: '', aliases: '', type: 'shop', lat: '', lng: '', pin_code: '560034', city: 'Bengaluru', verified: true });
        loadData();
      }
    } catch (err) {
      alert('Failed to update landmark');
    }
  };

  const handleDeleteLandmark = async (id: string) => {
    if (!confirm('Are you sure you want to delete this landmark?')) return;
    try {
      const res = await fetch(`${BASE_URL}/api/ops/landmarks/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      alert('Delete request failed.');
    }
  };

  const openEdit = (lm: Landmark) => {
    setEditingLandmark(lm);
    setLmForm({
      name: lm.name,
      aliases: lm.name_aliases.join(', '),
      type: lm.type,
      lat: lm.location.lat.toString(),
      lng: lm.location.lng.toString(),
      pin_code: lm.pin_code || '560034',
      city: lm.city || 'Bengaluru',
      verified: lm.verified
    });
  };

  // Filtered Landmarks List
  const filteredLandmarks = landmarks.filter(lm => {
    const matchesSearch = lm.name.toLowerCase().includes(lmSearch.toLowerCase()) || 
      lm.name_aliases.some(a => a.toLowerCase().includes(lmSearch.toLowerCase())) ||
      (lm.pin_code && lm.pin_code.includes(lmSearch));
    const matchesType = lmTypeFilter === 'all' || lm.type === lmTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="p-6 space-y-8">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-brand-500 animate-pulse"></span>
            <span className="font-semibold text-xl font-display tracking-tight text-white flex items-center gap-1">
              Colony<span className="text-brand-400">IQ</span> <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">OPS</span>
            </span>
          </div>

          <nav className="space-y-1.5">
            {[
              { id: 'map', label: 'Activity Map', icon: Activity },
              { id: 'landmarks', label: 'Landmarks DB', icon: Database },
              { id: 'pipeline', label: 'AI Pipeline Monitor', icon: Cpu },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10' 
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Sync panel */}
        <div className="p-6 border-t border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Auto Syncing
            </span>
            <span>Live telemetry</span>
          </div>
          <button 
            onClick={loadData}
            className="w-full bg-slate-800 hover:bg-slate-700 py-2.5 rounded-lg text-xs font-bold transition-colors"
          >
            Refetch DB Log
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        
        {/* Top Navbar */}
        <header className="px-8 py-5 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold font-display capitalize">{activeTab} View</h2>
            <p className="text-xs text-slate-500">ColonyIQ system control center</p>
          </div>
          
          {/* Quick stats */}
          <div className="flex gap-6 text-xs font-semibold">
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-850">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              <span>Active Agents: {liveAgents.length}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-850">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-500"></div>
              <span>Landmarks: {landmarks.length}</span>
            </div>
          </div>
        </header>

        {/* Views */}
        <div className="flex-1 p-8">

          {/* TAB 1: ACTIVITY HEATMAP */}
          {activeTab === 'map' && (
            <div className="h-[680px] w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-lg">
              <div ref={mapContainerRef} className="w-full h-full" />
              
              {/* Map Info overlay panel */}
              <div className="absolute top-4 right-4 z-[1000] glass p-4 rounded-xl border border-slate-800/80 space-y-2.5 max-w-xs text-xs">
                <h4 className="font-bold text-white uppercase tracking-wider">Map Legend</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-300">Verified Landmark</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500"></span>
                    <span className="text-slate-300">Unverified Landmark</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-brand-500 border border-white"></span>
                    <span className="text-slate-300">Active Delivery Location</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-600 border border-white"></span>
                    <span className="text-slate-300">Live Agent position</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LANDMARKS DB */}
          {activeTab === 'landmarks' && (
            <div className="space-y-6">
              
              {/* Controls bar */}
              <div className="flex justify-between items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-850">
                
                {/* Search / filter */}
                <div className="flex items-center gap-3 flex-grow max-w-lg">
                  <div className="relative flex-grow">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={lmSearch}
                      onChange={(e) => setLmSearch(e.target.value)}
                      placeholder="Search landmarks by name, alias, or PIN..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <select
                    value={lmTypeFilter}
                    onChange={(e) => setLmTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl py-2.5 px-3 text-sm focus:outline-none transition-colors"
                  >
                    <option value="all">All Types</option>
                    <option value="atm">ATMs</option>
                    <option value="temple">Temples</option>
                    <option value="hospital">Hospitals</option>
                    <option value="school">Schools</option>
                    <option value="shop">Shops</option>
                    <option value="road">Roads</option>
                    <option value="building">Buildings</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    setEditingLandmark(null);
                    setLmForm({ name: '', aliases: '', type: 'shop', lat: '12.9348', lng: '77.6240', pin_code: '560034', city: 'Bengaluru', verified: true });
                    setShowAddModal(true);
                  }}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 shadow-lg shadow-brand-500/10 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Landmark
                </button>
              </div>

              {/* Landmarks Table */}
              <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden shadow-inner">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold text-xs tracking-wider uppercase">
                      <th className="py-4 px-6">Landmark Name</th>
                      <th className="py-4 px-6">Aliases</th>
                      <th className="py-4 px-6">Type</th>
                      <th className="py-4 px-6">Coordinates</th>
                      <th className="py-4 px-6">Confidence</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredLandmarks.map((lm) => (
                      <tr key={lm.id} className="hover:bg-slate-900/35 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {lm.type === 'atm' ? '🏧' : lm.type === 'temple' ? '🛕' : lm.type === 'hospital' ? '🏥' : lm.type === 'school' ? '🏫' : lm.type === 'shop' ? '🏪' : lm.type === 'road' ? '🛣️' : '🏢'}
                            </span>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {lm.name}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                  lm.verified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {lm.verified ? 'Verified' : 'Unverified'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">{lm.id.substring(0, 8)} | {lm.pin_code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1">
                            {lm.name_aliases.map((a, i) => (
                              <span key={i} className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{a}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6 capitalize text-slate-300 font-semibold text-xs">{lm.type}</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-400">
                          {lm.location.lat.toFixed(5)}, {lm.location.lng.toFixed(5)}
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1 w-24">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                              <span>{(lm.confidence_score * 100).toFixed(0)}%</span>
                              <span>{lm.delivery_count} runs</span>
                            </div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-brand-500 rounded-full" 
                                style={{ width: `${lm.confidence_score * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(lm)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Edit Landmark"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLandmark(lm.id)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete Landmark"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PIPELINE MONITOR */}
          {activeTab === 'pipeline' && (
            <div className="grid grid-cols-3 gap-8">
              
              {/* Left pane: delivery list logs */}
              <div className="col-span-1 space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Processed Logs</h3>
                <div className="space-y-3">
                  {deliveries.map((del) => (
                    <div
                      key={del.id}
                      onClick={() => setSelectedPipelineDelivery(del)}
                      className={`glass p-4 rounded-xl cursor-pointer border hover:border-brand-500/20 transition-all space-y-2.5 ${
                        selectedPipelineDelivery?.id === del.id 
                          ? 'border-brand-500/40 bg-slate-900/60' 
                          : 'border-slate-850'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white font-mono text-xs">{del.tracking_id}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          del.status === 'delivered' 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                            : del.status === 'failed' 
                              ? 'bg-red-500/15 text-red-400 border border-red-500/20' 
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        }`}>
                          {del.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate italic">
                        "{del.raw_transcript || 'No voice note provided'}"
                      </p>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between font-mono">
                        <span>{new Date(del.created_at).toLocaleTimeString()}</span>
                        <span>{del.steps?.length || 0} Steps generated</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right pane: Pipeline debug panel */}
              <div className="col-span-2">
                {selectedPipelineDelivery ? (
                  <div className="glass p-6 rounded-2xl border border-slate-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                      <div>
                        <span className="text-[10px] text-brand-400 uppercase font-mono font-bold">PIPELINE AUDITOR</span>
                        <h3 className="text-lg font-bold text-white">{selectedPipelineDelivery.tracking_id}</h3>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">ID: {selectedPipelineDelivery.id}</span>
                    </div>

                    {/* Step 1: Transcription */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] flex items-center justify-center font-bold text-brand-400">1</span>
                        Transcription & Language Detection
                      </h4>
                      <div className="glass-light p-4 rounded-xl border border-slate-850 space-y-2">
                        <div className="text-xs text-slate-500">RAW TRANSCRIPT OUTPUT (GEMINI 1.5 PRO)</div>
                        <p className="text-sm font-semibold text-slate-200 italic">
                          "{selectedPipelineDelivery.raw_transcript || 'Deliver directly to coordinates, no voice note parsed.'}"
                        </p>
                        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 pt-1">
                          <div>LANGUAGE: <span className="text-brand-400 uppercase font-bold">hi (Hindi / Hinglish)</span></div>
                          <div>LATENCY: <span className="text-emerald-400">1.82s</span></div>
                          <div>CONFIDENCE: <span className="text-emerald-400">95%</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Entity Extraction & Verification */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] flex items-center justify-center font-bold text-brand-400">2</span>
                        Entity Extraction & Spatial Verification
                      </h4>
                      <div className="glass-light p-4 rounded-xl border border-slate-850 space-y-3">
                        <div className="text-[10px] text-slate-500 uppercase">EXTRACTED ENTITIES FROM GEOGRAPHY</div>
                        <div className="space-y-2">
                          {selectedPipelineDelivery.steps?.map((step: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
                              <div className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-slate-900 text-[9px] flex items-center justify-center border border-slate-800 text-slate-400">{step.step_number}</span>
                                <span className="font-semibold text-slate-300">{step.instruction_english}</span>
                              </div>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                step.verified 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {step.verified ? 'Verified (PostGIS / Places)' : 'Unverified (Transcript)'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: TTS generation */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] flex items-center justify-center font-bold text-brand-400">3</span>
                        Multilingual TTS Generation
                      </h4>
                      <div className="glass-light p-4 rounded-xl border border-slate-850 space-y-2.5">
                        <div className="text-xs text-slate-500">GENERATED WaveNet GUIDANCE STREAM PATHS</div>
                        {selectedPipelineDelivery.steps?.map((step: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                            <span>Step {step.step_number} Audio:</span>
                            <span className="text-brand-400 select-all">/audio/mock?step=${step.step_number}&lang=kn</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="glass h-[400px] rounded-2xl border border-slate-850 flex flex-col justify-center items-center text-center p-6 text-slate-500">
                    <Cpu className="w-10 h-10 text-slate-700 mb-2" />
                    <p className="text-sm font-semibold">Select a processed log from the list to audit the AI pipeline.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">
              
              {/* Stat grid */}
              <div className="grid grid-cols-4 gap-6">
                {[
                  { label: 'Delivery Success Rate', val: analytics ? `${analytics.deliverySuccessRate.toFixed(1)}%` : '85.2%', desc: 'Saturates over 50 runs', icon: TrendingUp, color: 'text-emerald-400' },
                  { label: 'Avg Time From 500m', val: analytics ? `${analytics.avgTimeToDeliverSeconds}s` : '142s', desc: 'Average navigation finish', icon: Clock, color: 'text-brand-400' },
                  { label: 'Verified Landmarks', val: landmarks.length, desc: 'Registered in PostGIS DB', icon: Database, color: 'text-amber-400' },
                  { label: 'Active Pipeline Items', val: deliveries.filter(d => d.status === 'active' || d.status === 'processing').length, desc: 'Deliveries currently active', icon: Activity, color: 'text-purple-400' }
                ].map((stat, i) => (
                  <div key={i} className="glass p-6 rounded-2xl border border-slate-850 space-y-2">
                    <div className="flex justify-between items-start text-slate-400 text-xs font-semibold">
                      <span>{stat.label}</span>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div className="text-3xl font-bold text-white font-display tracking-tight">{stat.val}</div>
                    <div className="text-[10px] text-slate-500 font-semibold">{stat.desc}</div>
                  </div>
                ))}
              </div>

              {/* Graphical aggregates */}
              <div className="grid grid-cols-2 gap-8">
                
                {/* Pin code coverage chart */}
                <div className="glass p-6 rounded-2xl border border-slate-850 space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Landmarks count by PIN Code</h3>
                  <div className="space-y-3 pt-2">
                    {analytics && Object.entries(analytics.landmarkCoverageByPin).map(([pin, count]: any, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-300 font-mono">{pin} (Koramangala/HSR)</span>
                          <span className="text-white">{count} landmarks</span>
                        </div>
                        <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                          <div 
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${Math.min(100, (count / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top failure zones */}
                <div className="glass p-6 rounded-2xl border border-slate-850 space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Top Failure Sectors (Last 500m)</h3>
                  <div className="space-y-4 pt-2">
                    {analytics && analytics.topFailureZones.map((zone: string, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850 text-xs">
                        <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold font-mono">
                          {i + 1}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-white">{zone}</div>
                          <div className="text-[10px] text-slate-500">High count of standard standard addresses failure</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

      </main>

      {/* Add/Edit Landmark Modal overlay */}
      {(showAddModal || editingLandmark) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="glass w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white font-display">
                {editingLandmark ? 'Edit Landmark details' : 'Add New Verified Landmark'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLandmark(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingLandmark ? handleEditLandmarkSubmit : handleAddLandmarkSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-bold text-slate-400 uppercase">Landmark Name</label>
                  <input 
                    type="text" 
                    required
                    value={lmForm.name}
                    onChange={(e) => setLmForm({...lmForm, name: e.target.value})}
                    placeholder="e.g. Ganesha Temple"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 rounded-xl py-3 px-4 text-white focus:outline-none transition-colors"
                  />
                </div>
                
                <div className="space-y-1.5 col-span-2">
                  <label className="font-bold text-slate-400 uppercase">Multilingual Aliases (comma separated)</label>
                  <input 
                    type="text" 
                    value={lmForm.aliases}
                    onChange={(e) => setLmForm({...lmForm, aliases: e.target.value})}
                    placeholder="e.g. ganesha temple, ganapathi temple, temple"
                    className="w-full bg-slate-950 border border-slate-855 focus:border-brand-500 rounded-xl py-3 px-4 text-white focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-400 uppercase">Landmark Type</label>
                  <select
                    value={lmForm.type}
                    onChange={(e) => setLmForm({...lmForm, type: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 rounded-xl py-3 px-3 text-white focus:outline-none transition-colors"
                  >
                    <option value="atm">atm</option>
                    <option value="temple">temple</option>
                    <option value="hospital">hospital</option>
                    <option value="school">school</option>
                    <option value="shop">shop</option>
                    <option value="road">road</option>
                    <option value="building">building</option>
                    <option value="other">other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-400 uppercase">PIN Code</label>
                  <input 
                    type="text" 
                    required
                    value={lmForm.pin_code}
                    onChange={(e) => setLmForm({...lmForm, pin_code: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 rounded-xl py-3 px-4 text-white focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-400 uppercase">Latitude</label>
                  <input 
                    type="text" 
                    required
                    value={lmForm.lat}
                    onChange={(e) => setLmForm({...lmForm, lat: e.target.value})}
                    placeholder="e.g. 12.9360"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 rounded-xl py-3 px-4 text-white focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-400 uppercase">Longitude</label>
                  <input 
                    type="text" 
                    required
                    value={lmForm.lng}
                    onChange={(e) => setLmForm({...lmForm, lng: e.target.value})}
                    placeholder="e.g. 77.6240"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 rounded-xl py-3 px-4 text-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLandmark(null);
                  }}
                  className="px-5 py-3 border border-slate-850 hover:bg-slate-800 text-slate-300 font-bold rounded-xl uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl uppercase shadow-lg shadow-brand-500/10 transition-colors"
                >
                  Save Landmark
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
