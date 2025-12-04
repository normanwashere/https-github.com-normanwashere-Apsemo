
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../App';
import { supabase } from '../services/supabase';
import { Resident, DisasterEvent, Database } from '../types';
import { Button, Icon, Input, Modal, Select, GlassCard } from './ui';
import { getCachedData } from '../services/dbService';

// --- Helper Functions ---

const base64ToBlob = (base64: string, mimeType: string = 'image/png'): Blob => {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeType });
};

const loadQRCodeLibrary = async (): Promise<any> => {
    let QRCodeLib = (window as any).QRCode || (window as any).qrcode;
    if (QRCodeLib) return QRCodeLib;

    const loadScript = (src: string) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.body.appendChild(script);
        });
    };

    try {
        await loadScript("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js");
    } catch (err) {
        console.warn("Primary CDN failed, trying secondary...");
        try {
            await loadScript("https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js");
        } catch (err2) {
            console.warn("Secondary CDN failed, trying tertiary...");
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js");
        }
    }
    
    QRCodeLib = (window as any).QRCode || (window as any).qrcode;
    if (!QRCodeLib) throw new Error("QR Library could not be loaded.");
    return QRCodeLib;
};

// --- Components ---

const QRCodeModal: React.FC<{ isOpen: boolean; onClose: () => void; resident: Resident | null; onUpdate?: () => void }> = ({ isOpen, onClose, resident, onUpdate }) => {
    const { showToast, isOnline } = useApp();
    const [qrImage, setQrImage] = useState<string | null>(null);
    const [savedQrUrl, setSavedQrUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Sync savedQrUrl with the resident prop when it changes
    useEffect(() => {
        if (resident?.qr_code_url) {
            setSavedQrUrl(resident.qr_code_url);
        } else {
            setSavedQrUrl(null);
        }
    }, [resident]);

    useEffect(() => {
        let isMounted = true;
        let timeoutId: any = null;

        const generate = async () => {
            if (!isOpen || !resident) return;

            const currentUrl = savedQrUrl || resident.qr_code_url;

            if (currentUrl) {
                if (isMounted) {
                    // Prevent setting state if it's already the same to avoid loop
                    if (qrImage !== currentUrl) {
                        setQrImage(currentUrl);
                    }
                }
                return;
            }

            if (isMounted) {
                setQrImage(null);
                setIsGenerating(true);
            }

            // Safety timeout to prevent infinite spinner
            timeoutId = setTimeout(() => {
                if (isMounted && isGenerating) {
                    setIsGenerating(false);
                    // Only show toast if we haven't successfully generated yet
                    if (!qrImage) {
                         showToast("QR generation timed out. Please check your connection.", "error");
                    }
                }
            }, 10000); 

            try {
                const QRCodeLib = await loadQRCodeLibrary();

                // Generate QR
                await new Promise<void>((resolve, reject) => {
                    QRCodeLib.toDataURL(resident.id, { width: 256, margin: 2, errorCorrectionLevel: 'H' }, (err: any, url: string) => {
                        if (err) reject(err);
                        else {
                            if (isMounted) setQrImage(url);
                            resolve();
                        }
                    });
                });

            } catch (error: any) {
                console.error("QR Generation Error:", error);
                if (isMounted) {
                    showToast(`Failed to generate QR code: ${error.message}`, "error");
                }
            } finally {
                if (isMounted) setIsGenerating(false);
                if (timeoutId) clearTimeout(timeoutId);
            }
        };

        generate();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isOpen, resident, savedQrUrl, showToast]); 

    const handleSaveToCloud = async () => {
        if (!resident || !qrImage) return;
        setIsSaving(true);
        try {
            // Convert Base64 to Blob
            const blob = base64ToBlob(qrImage);
            const fileName = `${resident.id}-${Date.now()}.png`;
            
            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('qr_codes')
                .upload(fileName, blob, { upsert: true });

            if (uploadError) {
                if(uploadError.message.includes("bucket")) {
                     throw new Error("Storage bucket 'qr_codes' not found. Please create it in Supabase.");
                }
                if (uploadError.message.includes("row-level security") || uploadError.message.includes("violates new row")) {
                     throw new Error("Permission denied. Please add an RLS policy to the 'qr_codes' storage bucket to allow uploads.");
                }
                throw uploadError;
            }

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('qr_codes')
                .getPublicUrl(fileName);

            // Update Resident Record
            const { error: updateError } = await supabase
                .from('residents')
                .update({ qr_code_url: publicUrl })
                .eq('id', resident.id);

            if (updateError) {
                 if (updateError.message.includes("row-level security")) {
                     throw new Error("Permission denied. Please check RLS policies for the 'residents' table.");
                 }
                throw updateError;
            }

            setSavedQrUrl(publicUrl); // Update local state immediately
            showToast("QR Code saved successfully!", "success");
            if (onUpdate) onUpdate();
        } catch (error: any) {
            showToast(`Error saving QR Code: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !resident) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${resident.first_name} ${resident.last_name}`} size="sm">
            <div className="text-center">
                <div className="mb-4 min-h-[256px] flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200">
                    {isGenerating ? (
                        <div className="text-slate-500 flex flex-col items-center">
                            <Icon name="fa-spinner" className="fa-spin text-2xl mb-2"/>
                            Generating QR...
                        </div>
                    ) : qrImage ? (
                        <img src={qrImage} alt="Resident QR Code" className="rounded-lg shadow-sm" width={256} height={256} />
                    ) : (
                         <div className="text-red-500 flex flex-col items-center px-4">
                             <Icon name="fa-exclamation-circle" className="text-2xl mb-2" />
                             <p className="text-sm">Failed to load QR Code.</p>
                             <p className="text-xs mt-1 text-slate-500">Please check your internet connection.</p>
                         </div>
                    )}
                </div>

                {savedQrUrl ? (
                     <p className="text-xs text-green-600 font-semibold mb-4"><Icon name="fa-check-circle"/> Saved in Cloud</p>
                ) : (
                     <p className="text-xs text-slate-500 mb-4">Generated locally (Not saved)</p>
                )}
                
                <p className="mt-2 text-sm text-slate-700">Scan this code to quickly update the resident's status.</p>
                
                <div className="mt-6 flex flex-col gap-2">
                    {!savedQrUrl && isOnline && (
                        <Button onClick={handleSaveToCloud} isLoading={isSaving} className="w-full" disabled={!qrImage}>
                            <Icon name="fa-cloud-upload-alt" className="mr-2"/>
                            Save QR Code
                        </Button>
                    )}
                    
                    {qrImage && (
                        <a href={qrImage} download={`QR-${resident.last_name}.png`} target="_blank" rel="noopener noreferrer" className="block w-full">
                            <Button variant="secondary" className="w-full">
                                <Icon name="fa-download" className="mr-2"/> Download Image
                            </Button>
                        </a>
                    )}
                    
                    <Button variant="ghost" onClick={onClose} className="w-full">Close</Button>
                </div>
            </div>
        </Modal>
    );
};

const ResidentForm: React.FC<{ resident?: Resident | null; onSave: (savedResident?: Resident) => void; allResidents: Resident[] }> = ({ resident, onSave, allResidents }) => {
    const { locationData, showToast, isOnline } = useApp();
    const [formData, setFormData] = useState<Partial<Resident>>(resident || {});
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<Resident[]>([]);
    const [potentialDuplicates, setPotentialDuplicates] = useState<Resident[]>([]);
    const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);

    // Duplicate checker
    useEffect(() => {
        const checkDuplicates = async () => {
            if (!formData.first_name || !formData.last_name || formData.first_name.length < 2 || formData.last_name.length < 2) {
                setPotentialDuplicates([]);
                return;
            }
            setDuplicateCheckLoading(true);
            const { data, error } = await supabase
                .from('residents')
                .select('id, first_name, last_name, municipality, barangay')
                .ilike('first_name', `%${formData.first_name}%`)
                .ilike('last_name', `%${formData.last_name}%`)
                .limit(5);

            if (error) {
                console.error("Error checking for duplicates:", error);
            } else if (data) {
                setPotentialDuplicates(data.filter(r => r.id !== resident?.id));
            }
            setDuplicateCheckLoading(false);
        };

        const timerId = setTimeout(() => {
            checkDuplicates();
        }, 500); // 500ms debounce

        return () => {
            clearTimeout(timerId);
        };
    }, [formData.first_name, formData.last_name, resident?.id]);

    const handleHeadOfFamilyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (value.length < 3 || !formData.barangay) {
            setSuggestions([]);
            return;
        }

        const { data, error } = await supabase.rpc('search_family_heads', { p_barangay: formData.barangay, p_keyword: value });
        if(error) console.error(error);
        else setSuggestions(data as Resident[] || []);
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        if (name === 'dob' && value) {
            const birthDate = new Date(value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            setFormData(prev => ({ ...prev, age: age >= 0 ? age : undefined }));
        }
        
        if (name === 'is_head_of_family' && (e.target as HTMLInputElement).checked) {
            setFormData(prev => ({...prev, head_of_family_name: `${prev.first_name || ''} ${prev.last_name || ''}`.trim() }))
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const { id, created_at, status, full_name, evac_center_id, qr_code_url, ...saveData } = formData;

        // 1. Insert or Update Resident
        const { data, error } = id
            ? await supabase.from('residents').update(saveData).eq('id', id).select()
            : await supabase.from('residents').insert([saveData as Database['public']['Tables']['residents']['Insert']]).select();
        
        if (error) {
            showToast(`Error: ${error.message}`, 'error');
            setIsLoading(false);
            return;
        }

        const savedResident = data[0] as Resident;
        let finalResident = savedResident;

        // 2. Generate and Save QR Code automatically if it's a NEW resident and we are Online
        if (!id && isOnline && savedResident) {
             try {
                 const QRCodeLib = await loadQRCodeLibrary();
                 
                 // Generate Base64
                 const base64Url = await new Promise<string>((resolve, reject) => {
                     QRCodeLib.toDataURL(savedResident.id, { width: 256, margin: 2, errorCorrectionLevel: 'H' }, (err: any, url: string) => {
                         if (err) reject(err);
                         else resolve(url);
                     });
                 });

                 // Upload to Storage
                 const blob = base64ToBlob(base64Url);
                 const fileName = `${savedResident.id}-${Date.now()}.png`;
                 const { error: uploadError } = await supabase.storage
                     .from('qr_codes')
                     .upload(fileName, blob, { upsert: true });

                 if (!uploadError) {
                     // Get URL
                     const { data: { publicUrl } } = supabase.storage.from('qr_codes').getPublicUrl(fileName);
                     
                     // Update Resident
                     const { error: updateError } = await supabase
                         .from('residents')
                         .update({ qr_code_url: publicUrl })
                         .eq('id', savedResident.id);
                     
                     if (!updateError) {
                         finalResident = { ...savedResident, qr_code_url: publicUrl };
                         showToast('QR Code generated and saved automatically.', 'success');
                     }
                 }
             } catch (qrError) {
                 console.error("Auto QR generation failed:", qrError);
                 showToast("Resident saved, but QR code could not be generated automatically.", "error");
             }
        }

        showToast(`Resident ${id ? 'updated' : 'added'} successfully!`);
        // Pass the final resident object back to parent
        onSave(finalResident);
        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <Input label="First Name" name="first_name" value={formData.first_name || ''} onChange={handleChange} required />
                <Input label="Last Name" name="last_name" value={formData.last_name || ''} onChange={handleChange} required />
                
                {duplicateCheckLoading && <p className="text-sm text-slate-600 sm:col-span-2">Checking for duplicates...</p>}
                {potentialDuplicates.length > 0 && (
                    <div className="sm:col-span-2 p-3 bg-yellow-300/50 text-yellow-900 border border-yellow-400/50 rounded-lg">
                        <h4 className="font-bold flex items-center"><Icon name="fa-exclamation-triangle" className="mr-2"/> Potential Duplicates Found</h4>
                        <ul className="list-disc pl-5 mt-2 text-sm">
                            {potentialDuplicates.map(dup => (
                                <li key={dup.id}>{dup.first_name} {dup.last_name} ({dup.barangay}, {dup.municipality})</li>
                            ))}
                        </ul>
                        <p className="text-xs mt-2">Please verify this is not the same person before saving.</p>
                    </div>
                )}

                <Input label="Date of Birth" name="dob" type="date" value={formData.dob || ''} onChange={handleChange} required />
                <Input label="Age" name="age" type="number" value={formData.age || ''} readOnly className="bg-slate-200/50" />
                 <Select label="Sex" name="sex" value={formData.sex || ''} onChange={handleChange}>
                    <option value="">Select Sex</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                </Select>
                 <Select label="Municipality" name="municipality" value={formData.municipality || ''} onChange={handleChange} required>
                    <option value="">Select Municipality</option>
                    {Object.keys(locationData).sort().map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Select label="Barangay" name="barangay" value={formData.barangay || ''} onChange={handleChange} required disabled={!formData.municipality}>
                    <option value="">Select Barangay</option>
                    {(locationData[formData.municipality || ''] || []).map(b => <option key={b} value={b}>{b}</option>)}
                </Select>
                <Input label="Purok" name="purok" value={formData.purok || ''} onChange={handleChange} />
                <Input label="House No. / Street" name="street" value={formData.street || ''} onChange={handleChange} />
                 <div className="sm:col-span-2 relative">
                    <Input label="Head of Family" name="head_of_family_name" value={formData.head_of_family_name || ''} onChange={handleHeadOfFamilyChange} autoComplete="off" readOnly={formData.is_head_of_family} />
                    {suggestions.length > 0 && (
                        <div className="absolute w-full bg-white/80 backdrop-blur-sm shadow-lg rounded-b-lg z-10 max-h-40 overflow-y-auto border border-white/30">
                           {suggestions.map(s => (
                               <div key={s.id} className="p-2 cursor-pointer hover:bg-white/50" onClick={() => {
                                   setFormData(prev => ({...prev, head_of_family_name: s.full_name}));
                                   setSuggestions([]);
                               }}>{s.full_name}</div>
                           ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center">
                    <input type="checkbox" name="is_head_of_family" id="is_head_of_family" checked={!!formData.is_head_of_family} onChange={handleChange} className="h-4 w-4 text-blue-600 rounded mr-2 focus:ring-blue-500" />
                    <label htmlFor="is_head_of_family" className="text-sm text-slate-800">I am the head of the family</label>
                </div>
                 <div className="flex items-center">
                    <input type="checkbox" name="is_pwd" id="is_pwd" checked={!!formData.is_pwd} onChange={handleChange} className="h-4 w-4 text-blue-600 rounded mr-2 focus:ring-blue-500" />
                    <label htmlFor="is_pwd" className="text-sm text-slate-800">Person with Disability (PWD)</label>
                </div>
            </div>
            <div className="flex justify-end pt-6">
                <Button type="submit" isLoading={isLoading}>Save Resident</Button>
            </div>
        </form>
    );
};

const ResidentsPage: React.FC = () => {
    const { user, showToast, showConfirm, isOnline } = useApp();
    const [allResidents, setAllResidents] = useState<Resident[]>([]);
    const [activeEvent, setActiveEvent] = useState<DisasterEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResident, setEditingResident] = useState<Resident | null>(null);
    const [qrCodeResident, setQrCodeResident] = useState<Resident | null>(null);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Resident, direction: 'asc' | 'desc' }>({ key: 'last_name', direction: 'asc' });

    const fetchData = useCallback(async (eventId?: string) => {
        setIsLoading(true);
        if (isOnline) {
             // 1. Fetch all residents to ensure we have the latest profile data (including qr_code_url)
            const { data: residentsData, error: residentsError } = await supabase
                .from('residents')
                .select('*')
                .order('last_name', { ascending: true });

            if (residentsError) {
                showToast("Error fetching residents: " + residentsError.message, "error");
                setIsLoading(false);
                return;
            }

            let residents = (residentsData as Resident[]) || [];

            // 2. If there is an active event, fetch the latest status for each resident
            if (eventId) {
                const { data: logs, error: logsError } = await supabase
                    .from('resident_status_log')
                    .select('resident_id, status, timestamp')
                    .eq('event_id', eventId)
                    .order('timestamp', { ascending: true });

                if (logsError) {
                     console.error("Error fetching logs", logsError);
                } else if (logs) {
                    const statusMap = new Map<string, string>();
                    // Iterate through logs (ascending time), so the last entry for a resident is the latest
                    logs.forEach(log => {
                        statusMap.set(log.resident_id, log.status);
                    });

                    // Merge status into resident objects
                    residents = residents.map(r => ({
                        ...r,
                        status: (statusMap.get(r.id) as any) || 'Unknown'
                    }));
                }
            } else {
                // No active event means statuses are undefined/unknown
                residents = residents.map(r => ({ ...r, status: undefined }));
            }

            setAllResidents(residents);
        } else if (!isOnline) {
            showToast("You are offline. Showing cached data.", "success");
            const cachedResidents = await getCachedData<Resident>('residents');
            // Note: Offline data won't have live status, so we clear it.
            const residentsWithoutStatus = cachedResidents.map(r => ({ ...r, status: undefined }));
            setAllResidents(residentsWithoutStatus);
        }
        setIsLoading(false);
    }, [showToast, isOnline]);
    
    useEffect(() => {
        const getActiveEvent = async () => {
            if (isOnline) {
                const { data } = await supabase.from('events').select('*').eq('status', 'Active').limit(1).single();
                setActiveEvent(data);
                // Even if no active event, we fetch residents. If data is null, id is undefined.
                fetchData(data?.id);
            } else {
                setActiveEvent(null); 
                fetchData();
            }
        };
        getActiveEvent();
    }, [fetchData, isOnline]);

    const filteredResidents = useMemo(() => {
        return allResidents
            .filter(r => 
                `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                const key = sortConfig.key;
                const aValue = a[key] || '';
                const bValue = b[key] || '';
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
    }, [allResidents, searchTerm, sortConfig]);

    const paginatedResidents = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredResidents.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredResidents, currentPage, rowsPerPage]);

    const handleSort = (key: keyof Resident) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };
    
    const handleAddResident = () => {
        setEditingResident(null);
        setIsModalOpen(true);
    };

    const handleEditResident = (resident: Resident) => {
        setEditingResident(resident);
        setIsModalOpen(true);
    };

    const handleDelete = (resident: Resident) => {
        showConfirm('Delete Resident', `Are you sure you want to delete ${resident.first_name} ${resident.last_name}? This action cannot be undone.`, async () => {
            const { error } = await supabase.from('residents').delete().eq('id', resident.id);
            if (error) {
                showToast(`Error: ${error.message}`, 'error');
            } else {
                showToast('Resident deleted successfully.');
                if(activeEvent) fetchData(activeEvent.id);
                else fetchData();
            }
        });
    }

    const handleSave = (newResident?: Resident) => {
        setIsModalOpen(false);
        if(activeEvent) fetchData(activeEvent.id);
        else fetchData();

        // If a new resident was created (with QR code), open the QR modal immediately
        if (newResident && !editingResident) {
             setQrCodeResident(newResident);
        }
    };

    const totalPages = Math.ceil(filteredResidents.length / rowsPerPage);

    // Status color helper for cards
    const getStatusColor = (status?: string) => {
        switch(status) {
            case 'Safe': return 'bg-green-100 text-green-800 border border-green-200';
            case 'Evacuated': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
            case 'Injured': return 'bg-orange-100 text-orange-800 border border-orange-200';
            case 'Missing': return 'bg-red-100 text-red-800 border border-red-200';
            case 'Deceased': return 'bg-gray-800 text-white border border-gray-600';
            default: return 'bg-slate-100 text-slate-800 border border-slate-200';
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4 sm:mb-0 text-center sm:text-left">Resident Registry</h2>
                <div className="flex items-center space-x-4 w-full sm:w-auto">
                    {user?.role !== 'viewer' && (
                      <Button 
                        onClick={handleAddResident}
                        className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:static md:h-auto md:w-auto md:rounded-lg md:shadow-md"
                        title="Add Resident"
                        disabled={!isOnline}
                      >
                          <Icon name="fa-plus" className="text-xl md:mr-2 md:text-base"/>
                          <span className="hidden md:inline">Add Resident</span>
                      </Button>
                    )}
                </div>
            </header>

            <div className="mb-4">
                <Input type="search" placeholder="Search residents by name..." onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            </div>

            {isLoading ? (
                 <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>
            ) : (
                <>
                {/* Desktop View: Table */}
                <div className="hidden lg:block bg-white/20 backdrop-blur-lg rounded-2xl shadow-lg border border-white/30 overflow-x-auto">
                    <table className="min-w-full responsive-table">
                        <thead className="bg-white/30">
                            <tr>
                                {['last_name', 'municipality', 'barangay', 'status'].map(key => (
                                    <th key={key} className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort(key as keyof Resident)}>
                                        {key.replace('_', ' ')}
                                        {sortConfig.key === key && <Icon name={sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} className="ml-2" />}
                                    </th>
                                ))}
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                            {paginatedResidents.map(res => (
                                <tr key={res.id} className="hover:bg-white/20">
                                    <td data-label="Name" className="px-6 py-4 whitespace-normal break-words text-sm font-medium text-slate-900">{res.first_name} {res.last_name}</td>
                                    <td data-label="Municipality" className="px-6 py-4 whitespace-normal break-words text-sm text-slate-800">{res.municipality}</td>
                                    <td data-label="Barangay" className="px-6 py-4 whitespace-normal break-words text-sm text-slate-800">{res.barangay}</td>
                                    <td data-label="Status" className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{res.status || 'Unknown'}</td>
                                    <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => setQrCodeResident(res)} 
                                            title={res.qr_code_url ? "View Saved QR" : "Generate QR"}
                                            className={res.qr_code_url ? "text-blue-600 hover:text-blue-800" : "text-slate-700 hover:text-slate-900"}
                                        >
                                            <Icon name="fa-qrcode"/>
                                        </Button>
                                        {user?.role !== 'viewer' && <Button variant="ghost" size="sm" onClick={() => handleEditResident(res)} disabled={!isOnline}>Edit</Button>}
                                        {user?.role === 'admin' && <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(res)} disabled={!isOnline}>Delete</Button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile/Tablet View: Cards */}
                <div className="lg:hidden space-y-4">
                     {paginatedResidents.map(res => (
                        <div key={res.id} className="bg-white/40 backdrop-blur-md rounded-xl p-4 shadow-sm border border-white/40 flex flex-col gap-3">
                             <div className="flex justify-between items-start">
                                <div className="pr-2">
                                    <h3 className="font-bold text-slate-900 text-lg break-words">{res.first_name} {res.last_name}</h3>
                                    <p className="text-sm text-slate-700 mt-1">{res.barangay}, {res.municipality}</p>
                                </div>
                                <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(res.status)}`}>
                                    {res.status || 'Unknown'}
                                </span>
                             </div>
                             
                             <div className="flex justify-end items-center gap-2 pt-2 border-t border-white/10">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setQrCodeResident(res)} 
                                    title={res.qr_code_url ? "View Saved QR" : "Generate QR"}
                                    className={`${res.qr_code_url ? "text-blue-600 hover:text-blue-800" : "text-slate-700 hover:text-slate-900"} hover:bg-white/20`}
                                >
                                    <Icon name="fa-qrcode" className="mr-1"/> <span className="text-xs">QR</span>
                                </Button>
                                {user?.role !== 'viewer' && (
                                    <Button variant="ghost" size="sm" onClick={() => handleEditResident(res)} disabled={!isOnline} className="text-blue-700 hover:text-blue-900 hover:bg-white/20">
                                        <Icon name="fa-pen" className="mr-1"/> <span className="text-xs">Edit</span>
                                    </Button>
                                )}
                                {user?.role === 'admin' && (
                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-500/10" onClick={() => handleDelete(res)} disabled={!isOnline}>
                                        <Icon name="fa-trash" className="mr-1"/> <span className="text-xs">Delete</span>
                                    </Button>
                                )}
                             </div>
                        </div>
                     ))}
                     {paginatedResidents.length === 0 && (
                        <div className="text-center p-8 bg-white/20 rounded-xl text-slate-700 backdrop-blur-sm border border-white/20">No residents found.</div>
                    )}
                </div>
                
                {/* Pagination with improved visibility */}
                <GlassCard className="mt-4 p-4 !bg-white/40">
                    <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-slate-800 gap-4">
                        <div className="flex items-center space-x-2 w-full sm:w-auto">
                             <label htmlFor="rows-select" className="whitespace-nowrap font-medium">Rows per page:</label>
                             <Select id="rows-select" value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="w-full sm:w-auto !bg-white !border-slate-300 !text-slate-900 shadow-sm">
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </Select>
                        </div>
                        <div className="text-center font-medium">Page {currentPage} of {totalPages}</div>
                        <div className="flex w-full sm:w-auto space-x-2">
                            <Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} variant="secondary" className="flex-1 sm:flex-none !bg-white hover:!bg-slate-100 text-slate-900 border-slate-300">Previous</Button>
                            <Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} variant="secondary" className="flex-1 sm:flex-none !bg-white hover:!bg-slate-100 text-slate-900 border-slate-300">Next</Button>
                        </div>
                    </div>
                </GlassCard>
                </>
            )}
            
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingResident ? 'Edit Resident' : 'Add New Resident'} size="xl">
                <ResidentForm resident={editingResident} onSave={handleSave} allResidents={allResidents} />
            </Modal>
            
            {qrCodeResident && (
                <QRCodeModal 
                    isOpen={!!qrCodeResident} 
                    onClose={() => setQrCodeResident(null)} 
                    resident={qrCodeResident}
                    onUpdate={() => activeEvent ? fetchData(activeEvent.id) : fetchData()}
                />
            )}

        </div>
    );
};

export default ResidentsPage;
