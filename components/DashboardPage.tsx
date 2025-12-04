
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useApp } from '../App';
import { supabase } from '../services/supabase';
import { DisasterEvent, ResidentStatus, Incident, EvacuationCenter, Resident } from '../types';
import { Button, Icon, Select, GlassCard, Modal, Spinner } from './ui';

declare const L: any;

const StatCard: React.FC<{ title: string; value: number | string; icon: string; color: string; onClick?: () => void }> = ({ title, value, icon, color, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white/20 backdrop-blur-md p-4 rounded-xl shadow-lg border border-white/30 transition-all duration-200 ${onClick ? 'cursor-pointer hover:bg-white/40 hover:scale-[1.02] active:scale-[0.98]' : ''}`}
    >
        <div className="flex items-center">
            <div className={`rounded-full p-3 bg-opacity-20 ${color.replace('text', 'bg')}`}>
                 <Icon name={icon} className={`text-xl ${color}`} />
            </div>
            <div className="ml-4">
                <p className="text-slate-800 text-sm font-medium">{title}</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    </div>
);

// Simple geocoding for demonstration. A real app would use a geocoding API.
const geocodeAddress = async (address: string): Promise<{ lat: number, lng: number } | null> => {
    const baseLat = 13.13; // Albay center
    const baseLon = 123.74;
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
        hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }
    const latOffset = (hash & 0x7FFF) / 0x7FFF * 0.3 - 0.15;
    const lonOffset = ((hash >> 15) & 0x7FFF) / 0x7FFF * 0.3 - 0.15;
    return { lat: baseLat + latOffset, lng: baseLon + lonOffset };
};


const LeafletMap: React.FC<{ event: DisasterEvent | null }> = ({ event }) => {
    const { barangayToMunicipalityMap } = useApp();
    const mapRef = useRef<any | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const incidentLayerRef = useRef<any | null>(null);
    const evacLayerRef = useRef<any | null>(null);

    useEffect(() => {
        if (containerRef.current && !mapRef.current && typeof L !== 'undefined') {
            mapRef.current = L.map(containerRef.current, { attributionControl: false }).setView([13.21, 123.65], 9);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
            L.control.attribution({ position: 'topright' }).addTo(mapRef.current);
            incidentLayerRef.current = L.layerGroup().addTo(mapRef.current);
            evacLayerRef.current = L.layerGroup().addTo(mapRef.current);
        }
    }, []);

    const plotData = useCallback(async (eventId: string) => {
        if (!mapRef.current || !incidentLayerRef.current || !evacLayerRef.current) return;

        // Clear previous markers
        incidentLayerRef.current.clearLayers();
        evacLayerRef.current.clearLayers();

        // Fetch and plot incidents
        const { data: incidents } = await supabase.from('incident_reports').select(`*, resident:residents(first_name, last_name, barangay, municipality)`).eq('event_id', eventId);
        const incidentIcon = L.icon({
            iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
        incidents?.forEach(async (inc: Incident) => {
            if (inc.resident) {
                const fullAddress = `${inc.resident.barangay}, ${inc.resident.municipality}, Albay, Philippines`;
                const coords = await geocodeAddress(fullAddress);
                if(coords) L.marker([coords.lat, coords.lng], { icon: incidentIcon }).addTo(incidentLayerRef.current!)
                    .bindPopup(`<b>Incident: ${inc.type}</b><br>${inc.description || ''}`);
            }
        });

        // Custom Evac Center Icon
        const evacIcon = L.divIcon({
            className: 'custom-evac-icon',
            html: `<div style="background-color: #059669; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="fas fa-person-shelter text-white" style="font-size: 16px;"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });

        // Fetch and plot evac centers
        const { data: centers } = await supabase.from('evacuation_centers').select('*');
        centers?.forEach(async (center: EvacuationCenter) => {
            let coords: { lat: number; lng: number } | null = null;
            
            // Prioritize stored geotags
            if (center.latitude && center.longitude) {
                coords = { lat: center.latitude, lng: center.longitude };
            } else {
                // Fallback to geocoding the address
                const municipality = barangayToMunicipalityMap[center.barangay] || 'Unknown Municipality';
                const fullAddress = `${center.address || ''}, ${center.barangay}, ${municipality}, Albay, Philippines`;
                coords = await geocodeAddress(fullAddress);
            }

            if (coords) {
                L.marker([coords.lat, coords.lng], { icon: evacIcon }).addTo(evacLayerRef.current!)
                    .bindPopup(`<b>${center.name}</b><br>Capacity: ${center.capacity}`);
            }
        });

    }, [barangayToMunicipalityMap]);

    useEffect(() => {
        if (event) {
            plotData(event.id);
        }
    }, [event, plotData]);

    return <div ref={containerRef} id="map" className="h-full w-full rounded-xl" />;
};


const DashboardPage: React.FC = () => {
    const { showToast, locationData } = useApp();
    const [activeEvent, setActiveEvent] = useState<DisasterEvent | null>(null);
    const [stats, setStats] = useState<{ [key: string]: number }>({ Safe: 0, Evacuated: 0, Injured: 0, Missing: 0, Deceased: 0, Unknown: 0 });
    const [statusGroups, setStatusGroups] = useState<{ [key: string]: string[] }>({}); // Map Status -> Array of Resident IDs
    const [evacCenterGroups, setEvacCenterGroups] = useState<{ [key: string]: string[] }>({}); // Map Evac Center ID -> Array of Resident IDs
    const [evacStats, setEvacStats] = useState<{id: string; name: string; occupancy: number; capacity: number}[]>([]);
    const [totalAffected, setTotalAffected] = useState<number | string>('...');
    const [allAffectedIds, setAllAffectedIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalResidents, setModalResidents] = useState<Resident[]>([]);
    const [modalLoading, setModalLoading] = useState(false);

    const [filterMunicipality, setFilterMunicipality] = useState('all');
    const [filterBarangay, setFilterBarangay] = useState('all');

    useEffect(() => {
        // Reset barangay filter when municipality changes
        setFilterBarangay('all');
    }, [filterMunicipality]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const { data: eventData, error: eventError } = await supabase.from('events').select('*').eq('status', 'Active').limit(1).single();

        if (eventError || !eventData) {
            console.log("No active events found.");
            setIsLoading(false);
            return;
        }
        setActiveEvent(eventData);

        // 1. Get filtered residents and total count
        let residentQuery = supabase.from('residents').select('id', { count: 'exact' });
        if (filterMunicipality !== 'all') {
            residentQuery = residentQuery.eq('municipality', filterMunicipality);
        }
        if (filterBarangay !== 'all') {
            residentQuery = residentQuery.eq('barangay', filterBarangay);
        }
        const { data: residentData, count, error: residentError } = await residentQuery;
        
        if (residentError) {
            showToast("Error fetching residents data", "error");
            setIsLoading(false);
            return;
        }

        const affectedCount = (count as number) || 0;
        setTotalAffected(affectedCount);
        const residentIds = residentData!.map(r => r.id);
        setAllAffectedIds(residentIds);

        if (residentIds.length === 0) {
            setStats({ Safe: 0, Evacuated: 0, Injured: 0, Missing: 0, Deceased: 0, Unknown: affectedCount });
            setStatusGroups({ Unknown: [] });
            setEvacCenterGroups({});
            setEvacStats([]);
            setIsLoading(false);
            return;
        }

        // 2. Fetch logs for ONLY the filtered residents
        const { data: logs, error: logError } = await supabase.from('resident_status_log').select('resident_id, status, timestamp, evac_center_id').eq('event_id', eventData.id).in('resident_id', residentIds);

        if (logError) {
            showToast("Error fetching status logs", "error");
            setIsLoading(false);
            return;
        }

        // 3. Determine the latest status for each resident
        type LogEntry = { resident_id: string; status: ResidentStatus; timestamp: string; evac_center_id: string | null; };
        const latestStatusMap = new Map<string, LogEntry>();
        logs!.forEach((log: LogEntry) => {
            const existing = latestStatusMap.get(log.resident_id);
            if (!existing || new Date(log.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
                latestStatusMap.set(log.resident_id, log);
            }
        });

        // 4. Calculate stats and groups
        const newStats: { [key: string]: number } = { Safe: 0, Evacuated: 0, Injured: 0, Missing: 0, Deceased: 0, Unknown: 0 };
        const newGroups: { [key: string]: string[] } = { Safe: [], Evacuated: [], Injured: [], Missing: [], Deceased: [], Unknown: [] };
        const newEvacGroups: { [key: string]: string[] } = {};

        const latestLogs = Array.from(latestStatusMap.values());
        
        // Group residents with logs
        latestLogs.forEach(log => {
            if (newStats[log.status] !== undefined) {
                newStats[log.status]++;
            }
            if (!newGroups[log.status]) newGroups[log.status] = [];
            newGroups[log.status].push(log.resident_id);

            // Populate Evac Center Groups
            if (log.status === 'Evacuated' && log.evac_center_id) {
                if (!newEvacGroups[log.evac_center_id]) {
                    newEvacGroups[log.evac_center_id] = [];
                }
                newEvacGroups[log.evac_center_id].push(log.resident_id);
            }
        });

        // Identify Unknowns (Residents in the filtered set who have no log)
        const knownIds = new Set(latestLogs.map(l => l.resident_id));
        const unknownIds = residentIds.filter(id => !knownIds.has(id));
        
        newStats.Unknown = unknownIds.length;
        newGroups.Unknown = unknownIds;

        setStats(newStats);
        setStatusGroups(newGroups);
        setEvacCenterGroups(newEvacGroups);

        // 5. Correctly calculate Evacuation Center Stats
        const { data: centers, error: centersError } = await supabase.from('evacuation_centers').select('id, name, capacity');
        if (centers && !centersError) {
            const occupancyMap = new Map<string, number>();
            latestLogs.forEach(log => {
                if(log.status === 'Evacuated' && log.evac_center_id) {
                    occupancyMap.set(log.evac_center_id, (occupancyMap.get(log.evac_center_id) || 0) + 1);
                }
            });

            const evacChartData = centers.map(center => ({
                id: center.id,
                name: center.name,
                occupancy: occupancyMap.get(center.id) || 0,
                capacity: center.capacity
            })).filter((d: { capacity: number; occupancy: number }) => d.capacity > 0 || d.occupancy > 0);
            
            // Sort by occupancy percentage descending
            evacChartData.sort((a, b) => {
                const pA = a.capacity > 0 ? a.occupancy / a.capacity : 0;
                const pB = b.capacity > 0 ? b.occupancy / b.capacity : 0;
                return pB - pA;
            });

            setEvacStats(evacChartData);
        }

        setIsLoading(false);
    }, [showToast, filterMunicipality, filterBarangay]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStatClick = async (title: string, count: number | string) => {
        if (count === 0 || count === '...' ) return;
        
        setModalTitle(`${title} Residents`);
        setModalOpen(true);
        setModalLoading(true);

        try {
            let idsToFetch: string[] = [];

            if (title === 'Affected Pop.') {
                idsToFetch = allAffectedIds;
            } else {
                idsToFetch = statusGroups[title] || [];
            }

            if (idsToFetch.length === 0) {
                setModalResidents([]);
                setModalLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('residents')
                .select('*')
                .in('id', idsToFetch)
                .order('last_name', { ascending: true })
                .limit(1000); 

            if (error) throw error;
            
            const residentsWithStatus = (data || []).map(r => {
                 let foundStatus = 'Unknown';
                 if (title !== 'Affected Pop.') {
                     foundStatus = title;
                 } else {
                    for (const [stat, ids] of Object.entries(statusGroups)) {
                        if ((ids as string[]).includes(r.id)) {
                            foundStatus = stat;
                            break;
                        }
                    }
                 }
                 return { ...r, status: foundStatus as ResidentStatus };
            });

            setModalResidents(residentsWithStatus);

        } catch (error: any) {
            showToast(`Error fetching details: ${error.message}`, 'error');
        } finally {
            setModalLoading(false);
        }
    };

    const handleEvacCenterClick = async (centerId: string, centerName: string) => {
        const ids = evacCenterGroups[centerId] || [];
        if (ids.length === 0) return;

        setModalTitle(`Residents in ${centerName}`);
        setModalOpen(true);
        setModalLoading(true);

        try {
            const { data, error } = await supabase
                .from('residents')
                .select('*')
                .in('id', ids)
                .order('last_name', { ascending: true });

            if (error) throw error;

            // Residents in this list are by definition Evacuated
            const residentsWithStatus = (data || []).map(r => ({ ...r, status: 'Evacuated' as ResidentStatus }));
            setModalResidents(residentsWithStatus);

        } catch (error: any) {
            showToast(`Error fetching details: ${error.message}`, 'error');
        } finally {
            setModalLoading(false);
        }
    };


    const chartData = Object.entries(stats).map(([name, value]) => ({ name, value: value as number })).filter((d) => d.value > 0);
    const PIE_COLORS = { 
      Safe: '#3B82F6', Evacuated: '#FBBF24', Injured: '#F97316', 
      Missing: '#38BDF8', Deceased: '#EF4444', Unknown: '#6B7280'
    };

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        if (percent < 0.05) return null;

        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    if (isLoading && !activeEvent) {
        return <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>;
    }

    if (!activeEvent) {
        return (
            <GlassCard>
                <div className="m-auto text-center p-10">
                    <Icon name="fa-exclamation-circle" className="text-4xl text-yellow-500 mb-4" />
                    <h2 className="text-2xl font-semibold text-slate-900">No Active Events</h2>
                    <p className="text-slate-700">Please go to the Events page to create or activate an event.</p>
                </div>
            </GlassCard>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Dashboard</h2>
                <div className="text-sm font-medium text-slate-800 bg-white/30 backdrop-blur-md px-3 py-1 rounded-full shadow-lg text-center sm:text-left">
                    Active Event: <span className="font-bold text-blue-900">{activeEvent.name}</span>
                </div>
            </div>
            
            <GlassCard>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <h3 className="font-semibold text-slate-900 flex-shrink-0">Filters</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        <Select label="Municipality" value={filterMunicipality} onChange={e => setFilterMunicipality(e.target.value)}>
                            <option value="all">All Municipalities</option>
                            {Object.keys(locationData).sort().map(muni => <option key={muni} value={muni}>{muni}</option>)}
                        </Select>
                        <Select label="Barangay" value={filterBarangay} onChange={e => setFilterBarangay(e.target.value)} disabled={filterMunicipality === 'all'}>
                            <option value="all">All Barangays</option>
                            {filterMunicipality !== 'all' && locationData[filterMunicipality] &&
                                locationData[filterMunicipality].sort().map(brgy => <option key={brgy} value={brgy}>{brgy}</option>)
                            }
                        </Select>
                    </div>
                </div>
            </GlassCard>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard title="Affected Pop." value={isLoading ? '...' : totalAffected} icon="fa-users" color="text-slate-600" onClick={() => handleStatClick('Affected Pop.', totalAffected)} />
                <StatCard title="Safe" value={isLoading ? '...' : stats.Safe} icon="fa-house-user" color="text-blue-500" onClick={() => handleStatClick('Safe', stats.Safe)} />
                <StatCard title="Evacuated" value={isLoading ? '...' : stats.Evacuated} icon="fa-person-shelter" color="text-yellow-500" onClick={() => handleStatClick('Evacuated', stats.Evacuated)} />
                <StatCard title="Injured" value={isLoading ? '...' : stats.Injured} icon="fa-kit-medical" color="text-orange-500" onClick={() => handleStatClick('Injured', stats.Injured)} />
                <StatCard title="Missing" value={isLoading ? '...' : stats.Missing} icon="fa-magnifying-glass" color="text-sky-500" onClick={() => handleStatClick('Missing', stats.Missing)} />
                <StatCard title="Deceased" value={isLoading ? '...' : stats.Deceased} icon="fa-cross" color="text-red-500" onClick={() => handleStatClick('Deceased', stats.Deceased)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <GlassCard>
                    <h3 className="font-semibold text-slate-900 mb-4">Resident Status Breakdown</h3>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.3)" />
                                <XAxis dataKey="name" fontSize={12} tick={{ fill: '#334155' }} />
                                <YAxis tick={{ fill: '#334155' }} allowDecimals={false}/>
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '0.75rem' }} />
                                <Bar dataKey="value" fill="rgba(59, 130, 246, 0.7)">
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS]} />
                                  ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                 </GlassCard>
                 <GlassCard>
                    <h3 className="font-semibold text-slate-900 mb-4">Status Proportions</h3>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={chartData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={60}
                                    outerRadius={100} 
                                    labelLine={false} 
                                    label={renderCustomizedLabel}
                                    paddingAngle={3}
                                >
                                    {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS]} stroke="rgba(255,255,255,0.2)" strokeWidth={2}/>
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} 
                                    itemStyle={{ color: '#1e293b', fontSize: '14px', fontWeight: 500 }}
                                    formatter={(value: number) => [value, 'Count']}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                 </GlassCard>
                  <GlassCard>
                    <h3 className="font-semibold text-slate-900 mb-4">Evacuation Center Occupancy</h3>
                    <div className="h-80 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                         {evacStats.length > 0 ? evacStats.map((center, index) => {
                             const percentage = center.capacity > 0 ? Math.min(100, (center.occupancy / center.capacity) * 100) : 0;
                             let progressColor = 'bg-blue-500';
                             if (percentage >= 100) progressColor = 'bg-red-600';
                             else if (percentage >= 80) progressColor = 'bg-orange-500';
                             else if (percentage >= 50) progressColor = 'bg-yellow-500';

                             return (
                                 <div 
                                    key={center.id} 
                                    onClick={() => handleEvacCenterClick(center.id, center.name)}
                                    className="bg-white/40 rounded-lg p-3 border border-white/30 shadow-sm cursor-pointer hover:bg-white/60 hover:shadow-md transition-all duration-200"
                                    title="Click to view residents"
                                >
                                     <div className="flex justify-between items-center mb-1">
                                         <span className="font-medium text-slate-900 text-sm truncate pr-2">{center.name}</span>
                                         <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                                             {center.occupancy} / {center.capacity} ({percentage.toFixed(0)}%)
                                         </span>
                                     </div>
                                     <div className="w-full bg-slate-200/50 rounded-full h-3">
                                         <div className={`h-3 rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${percentage}%` }}></div>
                                     </div>
                                 </div>
                             );
                         }) : (
                             <div className="flex items-center justify-center h-full text-slate-600">
                                 No data available
                             </div>
                         )}
                    </div>
                 </GlassCard>
                 <GlassCard>
                    <h3 className="font-semibold text-slate-900 mb-4">Map View</h3>
                    <div className="h-80 z-0 relative">
                        <LeafletMap event={activeEvent} />
                    </div>
                 </GlassCard>
            </div>

            {/* Resident List Modal */}
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle} size="lg">
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {modalLoading ? (
                        <div className="flex justify-center p-8">
                             <Spinner className="w-8 h-8 text-blue-600"/>
                        </div>
                    ) : modalResidents.length > 0 ? (
                        <div className="space-y-2">
                            {modalResidents.map(res => (
                                <div key={res.id} className="p-3 bg-white/50 rounded-lg border border-white/40 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-slate-900">{res.first_name} {res.last_name}</p>
                                        <p className="text-xs text-slate-600">{res.barangay}, {res.municipality} • Age: {res.age || 'N/A'} • Sex: {res.sex || 'N/A'}</p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                                        res.status === 'Safe' ? 'bg-green-100 text-green-800 border-green-200' :
                                        res.status === 'Evacuated' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                        res.status === 'Injured' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                        res.status === 'Missing' ? 'bg-red-100 text-red-800 border-red-200' :
                                        res.status === 'Deceased' ? 'bg-gray-800 text-white border-gray-600' :
                                        'bg-slate-100 text-slate-800 border-slate-200'
                                    }`}>
                                        {res.status || 'Unknown'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-6 text-slate-600">
                            No residents found with this status.
                        </div>
                    )}
                </div>
                <div className="mt-4 flex justify-end">
                    <Button onClick={() => setModalOpen(false)}>Close</Button>
                </div>
            </Modal>
        </div>
    );
};

export default DashboardPage;
