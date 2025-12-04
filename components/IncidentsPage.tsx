
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import { supabase } from '../services/supabase';
import { Incident, DisasterEvent, Resident, Database } from '../types';
import { GlassCard, Icon, Button, Modal, Select, Input, Textarea } from './ui';

const ReportIncidentModal: React.FC<{ onClose: () => void; onSave: () => void; }> = ({ onClose, onSave }) => {
    const { showToast } = useApp();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeEvents, setActiveEvents] = useState<DisasterEvent[]>([]);
    
    // Form state
    const [selectedEventId, setSelectedEventId] = useState('');
    const [residentSearch, setResidentSearch] = useState('');
    const [residentResults, setResidentResults] = useState<Resident[]>([]);
    const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
    const [incidentType, setIncidentType] = useState('Injured');
    const [description, setDescription] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    
    const incidentTypes = ['Injured', 'Missing', 'Deceased'];

    // Fetch active events
    useEffect(() => {
        const fetchEvents = async () => {
            const { data, error } = await supabase.from('events').select('*').eq('status', 'Active');
            if (error) {
                showToast('Could not load active events.', 'error');
            } else {
                setActiveEvents(data || []);
            }
            setIsLoading(false);
        };
        fetchEvents();
    }, [showToast]);

    // Debounced resident search
    useEffect(() => {
        if (residentSearch.length < 2) {
            setResidentResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            const { data, error } = await supabase
                .from('residents')
                .select('id, first_name, last_name, barangay, municipality')
                .or(`first_name.ilike.%${residentSearch}%,last_name.ilike.%${residentSearch}%`)
                .limit(5);

            if (error) {
                console.error('Resident search error', error);
            } else {
                setResidentResults(data || []);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [residentSearch]);

    const handleSelectResident = (resident: Resident) => {
        setSelectedResident(resident);
        setResidentSearch('');
        setResidentResults([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEventId || !selectedResident || !incidentType) {
            showToast('Please fill all required fields.', 'error');
            return;
        }
        setIsSubmitting(true);
        
        let photoUrl: string | undefined = undefined;
        if(photoFile) {
            const fileExt = photoFile.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
            const filePath = `public/incidents/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('incidents')
                .upload(filePath, photoFile);
            
            if(uploadError) {
                showToast(`Photo upload failed: ${uploadError.message}`, 'error');
                setIsSubmitting(false);
                return;
            }
            
            const { data } = supabase.storage.from('incidents').getPublicUrl(filePath);
            photoUrl = data.publicUrl;
        }
        
        const saveData: Database['public']['Tables']['incident_reports']['Insert'] = {
            event_id: selectedEventId,
            resident_id: selectedResident.id,
            type: incidentType,
            description: description,
        };

        if (photoUrl) {
            saveData.photo_url = photoUrl;
        }
        
        const { error: insertError } = await supabase.from('incident_reports').insert([saveData]);
        
        if (insertError) {
            showToast(`Failed to report incident: ${insertError.message}`, 'error');
        } else {
            showToast('Incident reported successfully!', 'success');
            onSave();
            onClose();
        }
        
        setIsSubmitting(false);
    }

    return (
        <Modal isOpen={true} onClose={onClose} title="Report New Incident">
            {isLoading ? <div className="text-center"><Icon name="fa-spinner" className="fa-spin text-2xl"/></div> : (
            <form onSubmit={handleSubmit} className="space-y-4">
                <Select label="Select Active Event" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} required>
                    <option value="">Select an event...</option>
                    {activeEvents.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
                </Select>

                <div className="relative">
                    <Input label="Search for Resident" value={residentSearch} onChange={e => setResidentSearch(e.target.value)} placeholder="Type resident's name..." autoComplete="off" required={!selectedResident} />
                    {residentResults.length > 0 && (
                        <div className="absolute w-full bg-white/80 backdrop-blur-sm shadow-lg rounded-b-lg z-20 max-h-40 overflow-y-auto border border-white/30">
                           {residentResults.map(res => (
                               <div key={res.id} className="p-2 cursor-pointer hover:bg-white/50" onClick={() => handleSelectResident(res)}>
                                   <p className="font-medium text-slate-900">{res.first_name} {res.last_name}</p>
                                   <p className="text-xs text-slate-700">{res.barangay}, {res.municipality}</p>
                               </div>
                           ))}
                        </div>
                    )}
                </div>

                {selectedResident && (
                    <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30 text-sm">
                        <div className="flex justify-between items-start">
                             <div>
                                <p className="font-bold text-blue-900">{selectedResident.first_name} {selectedResident.last_name}</p>
                                <p className="text-blue-800">{selectedResident.barangay}, {selectedResident.municipality}</p>
                             </div>
                             <button type="button" onClick={() => setSelectedResident(null)} className="text-blue-700 hover:text-blue-900 text-xs font-semibold">Change</button>
                        </div>
                    </div>
                )}
                
                <Select label="Incident Type" value={incidentType} onChange={e => setIncidentType(e.target.value)} required>
                    {incidentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </Select>

                <Textarea label="Description (Optional)" value={description} onChange={e => setDescription(e.target.value)} rows={3}/>
                
                <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">Upload Photo (Optional)</label>
                    <Input type="file" onChange={e => setPhotoFile(e.target.files ? e.target.files[0] : null)} accept="image/*" className="p-0 file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-semibold file:bg-white/50 file:text-slate-700 hover:file:bg-white/70" />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={isSubmitting}>Submit Report</Button>
                </div>
            </form>
            )}
        </Modal>
    );
}

const IncidentsPage: React.FC = () => {
    const { showToast, user, isOnline } = useApp();
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchIncidents = useCallback(async () => {
        // Don't set loading to true on refetch, to avoid flicker
        if (!isOnline) {
             showToast("You are offline. Incident reports cannot be loaded.", 'error');
             setIsLoading(false);
             setIncidents([]);
             return;
        }

        const { data, error } = await supabase.from('incident_reports').select(`
            *, 
            event:events(name), 
            resident:residents(first_name, last_name, barangay, municipality)
        `).order('timestamp', { ascending: false });
        
        if (error) {
            // Defensive error handling to ensure a string message
            const errorMessage = (error && typeof error === 'object' && 'message' in error)
                ? String((error as any).message)
                : "An unknown error occurred";
            showToast(`Error fetching incidents: ${errorMessage}`, 'error');
            console.error("Error fetching incidents:", error);
        } else {
            setIncidents(data as Incident[] || []);
        }
        setIsLoading(false);
    }, [isOnline, showToast]);

    useEffect(() => {
        fetchIncidents();
    }, [fetchIncidents]);
    
    const handleSave = () => {
        fetchIncidents(); // Refetch data after saving
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4 sm:mb-0 text-center sm:text-left">Incident Reports</h2>
                {user?.role !== 'viewer' && (
                  <Button 
                    onClick={() => setIsModalOpen(true)}
                    className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:static md:h-auto md:w-auto md:rounded-lg md:shadow-md"
                    title="Report Incident"
                    disabled={!isOnline}
                  >
                      <Icon name="fa-plus" className="text-xl md:mr-2 md:text-base"/>
                      <span className="hidden md:inline">Report Incident</span>
                  </Button>
                )}
            </header>

             {isLoading ? (
                <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>
            ) : (
                <>
                {/* Desktop View: Table */}
                <div className="hidden lg:block bg-white/20 backdrop-blur-lg rounded-2xl shadow-lg border border-white/30 overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-white/30">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Event</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Resident</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Photo</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-white/20">
                            {incidents.length > 0 ? incidents.map(i => (
                                <tr key={i.id} className="hover:bg-white/20">
                                    <td data-label="Date" className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{new Date(i.timestamp).toLocaleString()}</td>
                                    <td data-label="Event" className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{i.event?.name || 'N/A'}</td>
                                    <td data-label="Resident" className="px-6 py-4 whitespace-normal break-words text-sm text-slate-800">
                                        {i.resident ? `${i.resident.first_name} ${i.resident.last_name}` : 'N/A'}
                                        <div className="text-xs text-slate-600">{i.resident ? `${i.resident.barangay}, ${i.resident.municipality}` : ''}</div>
                                    </td>
                                    <td data-label="Type" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{i.type}</td>
                                    <td data-label="Description" className="px-6 py-4 text-sm text-slate-800 max-w-xs truncate" title={i.description}>{i.description || '-'}</td>
                                    <td data-label="Photo" className="px-6 py-4 whitespace-nowrap text-sm">
                                        {i.photo_url ? <a href={i.photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">View</a> : 'None'}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-700">No incidents reported yet.</td>
                                </tr>
                            )}
                        </tbody>
                      </table>
                </div>

                {/* Mobile View: Cards */}
                 <div className="lg:hidden space-y-4">
                     {incidents.length > 0 ? incidents.map(i => (
                        <div key={i.id} className="bg-white/40 backdrop-blur-md rounded-xl p-4 shadow-sm border border-white/40 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded text-white ${i.type === 'Deceased' ? 'bg-red-500' : i.type === 'Missing' ? 'bg-orange-500' : 'bg-yellow-500'}`}>{i.type}</span>
                                        <span className="text-xs text-slate-500 font-medium">{new Date(i.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs uppercase tracking-wide text-slate-600 mt-1">{i.event?.name}</p>
                                </div>
                                {i.photo_url && (
                                     <a href={i.photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 bg-blue-100 p-2 rounded-full hover:bg-blue-200">
                                         <Icon name="fa-image" />
                                     </a>
                                )}
                            </div>
                            
                            <div className="bg-white/30 rounded p-3 text-sm text-slate-800 border border-white/20">
                                <p className="font-semibold text-slate-900 break-words">{i.resident ? `${i.resident.first_name} ${i.resident.last_name}` : 'Unknown Resident'}</p>
                                <p className="text-xs text-slate-600 mt-0.5">{i.resident ? `${i.resident.barangay}, ${i.resident.municipality}` : ''}</p>
                            </div>

                            {i.description && <p className="text-sm text-slate-700 italic bg-slate-50/30 p-2 rounded break-words">"{i.description}"</p>}
                        </div>
                     )) : (
                         <div className="text-center p-8 bg-white/20 rounded-xl text-slate-700 backdrop-blur-sm border border-white/20">No incidents reported yet.</div>
                     )}
                 </div>
                </>
            )}
            
            {isModalOpen && isOnline && <ReportIncidentModal onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

export default IncidentsPage;
