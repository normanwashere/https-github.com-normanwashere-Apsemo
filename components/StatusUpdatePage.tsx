
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../App';
import { supabase } from '../services/supabase';
import { Resident, ResidentStatus, DisasterEvent, EvacuationCenter, Database } from '../types';
import { Button, Icon, Input, Select, GlassCard, Spinner } from './ui';
import { getCachedData } from '../services/dbService';

// Helper to load jsQR library if it's missing
const loadJsQRLibrary = async (): Promise<any> => {
    if ((window as any).jsQR) return (window as any).jsQR;

    const loadScript = (src: string) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                if ((window as any).jsQR) resolve((window as any).jsQR);
                else reject(new Error("jsQR script loaded but object not found"));
            };
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.body.appendChild(script);
        });
    };

    try {
        await loadScript("https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js");
    } catch (e) {
        console.warn("Primary jsQR CDN failed, trying unpkg...");
        await loadScript("https://unpkg.com/jsqr@1.4.0/dist/jsQR.js");
    }
    
    return (window as any).jsQR;
};

const QRScanner: React.FC<{ onScan: (result: string) => void; isScanning: boolean; setIsScanning: (isScanning: boolean) => void }> = ({ onScan, isScanning, setIsScanning }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [libraryLoaded, setLibraryLoaded] = useState(false);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

    // Preload library on mount
    useEffect(() => {
        const initLib = async () => {
            setIsLoadingLibrary(true);
            try {
                await loadJsQRLibrary();
                setLibraryLoaded(true);
            } catch (e) {
                console.error("Failed to load QR library:", e);
                setCameraError("Scanner library failed to load. Check internet connection.");
            } finally {
                setIsLoadingLibrary(false);
            }
        };
        initLib();
    }, []);

    const startScan = useCallback(async () => {
        setCameraError(null);
        if (!libraryLoaded) {
            try {
                setIsLoadingLibrary(true);
                await loadJsQRLibrary();
                setLibraryLoaded(true);
            } catch (e) {
                setCameraError("Could not load scanner library.");
                setIsLoadingLibrary(false);
                return;
            }
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                await videoRef.current.play();
                setIsScanning(true);
            }
        } catch (err: any) {
            console.error("Error accessing camera:", err);
            setCameraError("Could not access camera. Ensure you have granted permissions.");
            setIsScanning(false);
        }
    }, [setIsScanning, libraryLoaded]);
    
    const stopScan = useCallback(() => {
        if(streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsScanning(false);
    }, [setIsScanning]);

    // Scanning Loop
    useEffect(() => {
        let animationFrameId: number;

        const tick = () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && isScanning) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                if (ctx) {
                    canvas.height = video.videoHeight;
                    canvas.width = video.videoWidth;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const jsQR = (window as any).jsQR;
                    
                    if (jsQR) {
                        // Removed aggressive inversionAttempts to use defaults for better performance/compatibility
                        const code = jsQR(imageData.data, imageData.width, imageData.height);
                        if (code) {
                            onScan(code.data);
                            stopScan(); // Stop immediately on success
                            return; // Exit loop
                        }
                    }
                }
            }
            if(isScanning) {
                animationFrameId = requestAnimationFrame(tick);
            }
        };

        if (isScanning) {
            animationFrameId = requestAnimationFrame(tick);
        }
        
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isScanning, onScan, stopScan]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if(streamRef.current) {
                 streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <GlassCard>
            <h3 className="font-semibold text-xl mb-4 text-slate-900">Scan QR Code</h3>
            
            <div className="relative w-full max-w-sm mx-auto aspect-square bg-slate-800/20 rounded-xl overflow-hidden shadow-inner border border-slate-200">
                {isScanning ? (
                    <>
                        <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover" muted />
                        <div className="absolute inset-0 border-8 border-blue-500/50 rounded-xl pointer-events-none animate-pulse"></div>
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] pointer-events-none"></div>
                        <p className="absolute bottom-4 left-0 right-0 text-center text-white text-xs font-semibold drop-shadow-md">Scanning...</p>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-100">
                        <Icon name="fa-qrcode" className="text-6xl mb-4 opacity-20" />
                        {cameraError ? (
                            <p className="text-red-500 text-sm px-4 text-center">{cameraError}</p>
                        ) : (
                            <p className="text-sm">Camera is off</p>
                        )}
                    </div>
                )}
            </div>

            <Button onClick={isScanning ? stopScan : startScan} className="w-full mt-4" disabled={isLoadingLibrary}>
                {isLoadingLibrary ? (
                    <>
                        <Spinner className="w-4 h-4 mr-2" /> Loading Library...
                    </>
                ) : (
                    <>
                        <Icon name={isScanning ? "fa-stop-circle" : "fa-camera"} className="mr-2" />
                        {isScanning ? 'Stop Scanner' : 'Start Scanner'}
                    </>
                )}
            </Button>
        </GlassCard>
    );
};

export const StatusUpdatePage: React.FC = () => {
    const { showToast, isOnline } = useApp();
    const [activeEvent, setActiveEvent] = useState<DisasterEvent | null>(null);
    const [allResidents, setAllResidents] = useState<Resident[]>([]);
    const [evacCenters, setEvacCenters] = useState<EvacuationCenter[]>([]);
    const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
    const [familyMembers, setFamilyMembers] = useState<Resident[]>([]);
    const [newStatus, setNewStatus] = useState<ResidentStatus>('Safe');
    const [evacCenterId, setEvacCenterId] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        if (isOnline) {
            const { data: eventData } = await supabase.from('events').select('*').eq('status', 'Active').limit(1).single();
            if (eventData) {
                setActiveEvent(eventData);
                // Directly query residents table for better reliability
                const { data: residentData } = await supabase.from('residents').select('*');
                setAllResidents((residentData as Resident[]) || []);
                const { data: centerData } = await supabase.from('evacuation_centers').select('*');
                setEvacCenters(centerData || []);
            }
        } else {
             showToast("You are offline. Showing cached data.", "success");
            const cachedResidents = await getCachedData<Resident>('residents');
            const residentsWithoutStatus = cachedResidents.map(r => ({ ...r, status: undefined }));
            setAllResidents(residentsWithoutStatus);
            const cachedCenters = await getCachedData<EvacuationCenter>('evac_centers');
            setEvacCenters(cachedCenters);
            setActiveEvent(null);
        }
        setIsLoading(false);
    }, [isOnline, showToast]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const handleSelectResident = (resident: Resident) => {
        setSelectedResident(resident);
        setSearchTerm('');
        if (resident.head_of_family_name) {
            // Simple name matching for family members - in production use UUIDs for relationships
            const family = allResidents.filter(r => r.head_of_family_name === resident.head_of_family_name);
            setFamilyMembers(family);
        } else {
            setFamilyMembers([resident]);
        }
    };
    
    const handleScan = (residentId: string) => {
        const found = allResidents.find(r => r.id === residentId);
        if (found) {
            handleSelectResident(found);
            showToast(`Found ${found.first_name} ${found.last_name}`, 'success');
        } else {
            showToast('Resident ID not found in local records.', 'error');
        }
        setIsScanning(false);
    };

    const handleUpdateStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedResident || !activeEvent || !isOnline) {
            showToast("Cannot update status while offline or no active event.", "error");
            return;
        }

        let selectedIds: string[];

        // If family members are displayed (more than 1), get selections from checkboxes.
        if (familyMembers.length > 1) {
            const form = e.target as HTMLFormElement;
            selectedIds = Array.from(form.querySelectorAll('input[name=family-member]:checked')).map(el => (el as HTMLInputElement).value);

            if (selectedIds.length === 0) {
                showToast('Please select at least one family member to update.', 'error');
                return;
            }
        } else {
            // Otherwise, it's an individual or a family of one. Just update them.
            selectedIds = [selectedResident.id];
        }

        const statusLogs: Database['public']['Tables']['resident_status_log']['Insert'][] = selectedIds.map(id => ({
            resident_id: id,
            status: newStatus,
            event_id: activeEvent.id,
            evac_center_id: newStatus === 'Evacuated' ? (evacCenterId || null) : null
        }));

        const { error } = await supabase.from('resident_status_log').insert(statusLogs);
        if (error) {
            showToast(`Error updating status: ${error.message}`, 'error');
        } else {
            showToast(`Successfully updated status for ${selectedIds.length} resident(s).`, 'success');
            setSelectedResident(null);
            setFamilyMembers([]);
            setNewStatus('Safe');
            setEvacCenterId('');
            // Optional: Reload data to get latest stats elsewhere, but not strictly needed for this view
        }
    };

    const searchResults = useMemo(() => {
        if (searchTerm.length < 2) return [];
        return allResidents.filter(r => `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, allResidents]);

    if (isLoading) return <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>;
    
    if (isOnline && !activeEvent) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Status Update</h2>
                <GlassCard><div className="text-center p-10 text-slate-800"><Icon name="fa-info-circle" className="text-2xl mb-2 text-blue-500"/><br/>No active event. Status updates are disabled.</div></GlassCard>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Status Update</h2>
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="flex flex-col gap-8 relative z-20">
                    <QRScanner onScan={handleScan} isScanning={isScanning} setIsScanning={setIsScanning} />

                    <GlassCard className="relative">
                        <h3 className="font-semibold text-xl mb-4 text-slate-900">Or Search Manually</h3>
                        <div className="relative z-50">
                            <Input placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            {searchResults.length > 0 && (
                                <div className="absolute top-full mt-1 w-full bg-white shadow-xl rounded-lg max-h-60 overflow-y-auto border border-slate-200">
                                    {searchResults.map(res => (
                                        <div key={res.id} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors" onClick={() => handleSelectResident(res)}>
                                            <p className="font-medium text-slate-900">{res.first_name} {res.last_name}</p>
                                            <p className="text-xs text-slate-600">{res.barangay}, {res.municipality}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
                
                <GlassCard className="relative z-10">
                    <h3 className="font-semibold text-xl mb-4 text-slate-900">Update Status</h3>
                    {selectedResident ? (
                        <form onSubmit={handleUpdateStatus} className="space-y-4">
                            <div className="p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                                <h4 className="font-bold text-lg text-blue-900">{selectedResident.first_name} {selectedResident.last_name}</h4>
                                <p className="text-sm text-blue-800">{selectedResident.barangay}, {selectedResident.municipality}</p>
                            </div>
                            {familyMembers.length > 1 && (
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-2">Family Members</h4>
                                    <div className="space-y-2 border border-white/30 rounded-lg p-3 max-h-48 overflow-y-auto bg-black/5">
                                        {familyMembers.map(member => (
                                            <label key={member.id} className="flex items-center text-slate-800">
                                                <input type="checkbox" name="family-member" value={member.id} defaultChecked={member.id === selectedResident.id} className="h-4 w-4 text-blue-600 rounded mr-3" />
                                                <span>{member.first_name} {member.last_name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <Select label="New Status" value={newStatus} onChange={e => setNewStatus(e.target.value as ResidentStatus)} disabled={!isOnline}>
                                <option>Safe</option> <option>Evacuated</option> <option>Injured</option> <option>Missing</option> <option>Deceased</option>
                            </Select>
                            {newStatus === 'Evacuated' && (
                                <Select label="Evacuation Center" value={evacCenterId} onChange={e => setEvacCenterId(e.target.value)} required disabled={!isOnline}>
                                    <option value="">Select center...</option>
                                    {evacCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            )}
                            <div className="flex space-x-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedResident(null)}>Clear</Button>
                                <Button type="submit" className="w-full" disabled={!isOnline}>Update Status</Button>
                            </div>
                        </form>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-slate-700">Scan a QR code or search for a resident to update their status.</p>
                            {!isOnline && <p className="text-sm mt-2 p-2 bg-yellow-300/50 text-yellow-900 rounded-lg">Status updates are disabled while offline.</p>}
                        </div>
                    )}
                </GlassCard>
            </div>
        </div>
    );
};
