
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import { supabase } from '../services/supabase';
import { Database } from '../types';
import { GlassCard, Icon, Button, Modal, Select, Input } from './ui';

type UserProfile = Database['public']['Tables']['users']['Row'];

const UserEditModal: React.FC<{
    userToEdit: UserProfile,
    onClose: () => void,
    onSave: () => void
}> = ({ userToEdit, onClose, onSave }) => {
    const { user: currentUser, showToast, locationData } = useApp();
    const [formData, setFormData] = useState(userToEdit);
    const [isLoading, setIsLoading] = useState(false);

    // Dropdown states
    const [scope, setScope] = useState<'Province' | 'Municipality' | 'Barangay'>('Province');
    const [municipality, setMunicipality] = useState('');
    const [barangay, setBarangay] = useState('');

    // Parse existing assigned_area on mount
    useEffect(() => {
        const current = userToEdit.assigned_area;
        if (!current) {
            setScope('Province');
            return;
        }

        // Check for "Municipality, Barangay" format
        if (current.includes(',')) {
            const [m, b] = current.split(',').map(s => s.trim());
            if (locationData[m]) {
                setScope('Barangay');
                setMunicipality(m);
                setBarangay(b);
                return;
            }
        }

        // Check if it matches a Municipality
        if (locationData[current]) {
            setScope('Municipality');
            setMunicipality(current);
            return;
        }

        // Default fallback
        setScope('Province');
    }, [userToEdit.assigned_area, locationData]);

    // Update formData when dropdowns change
    useEffect(() => {
        let area: string | null = null;
        if (scope === 'Municipality' && municipality) {
            area = municipality;
        } else if (scope === 'Barangay' && municipality && barangay) {
            area = `${municipality}, ${barangay}`;
        }
        // If scope is Province, area remains null
        setFormData(prev => ({ ...prev, assigned_area: area }));
    }, [scope, municipality, barangay]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        // Safety check: admin cannot demote themselves
        if (currentUser && currentUser.id === formData.id) {
            if (formData.role !== 'admin') {
                showToast("Admins cannot change their own role.", "error");
                return;
            }
        }
        
        setIsLoading(true);
        const { error } = await supabase
            .from('users')
            .update({ role: formData.role, assigned_area: formData.assigned_area || null })
            .eq('id', formData.id);
        
        setIsLoading(false);

        if (error) {
            showToast(error.message, "error");
        } else {
            showToast('User updated successfully.', 'success');
            onSave();
        }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose} title={`Edit User: ${userToEdit.email}`}>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <Input label="Email" value={userToEdit.email} disabled className="bg-slate-200/50" />
                <Select label="Role" name="role" value={formData.role} onChange={handleChange}>
                    <option value="admin">Admin</option>
                    <option value="encoder">Encoder</option>
                    <option value="viewer">Viewer</option>
                </Select>
                
                <div className="space-y-4 border-t border-white/20 pt-4 mt-4">
                    <h4 className="font-medium text-slate-800">Area Assignment</h4>
                    
                    <Select 
                        label="Scope" 
                        value={scope} 
                        onChange={(e) => {
                            setScope(e.target.value as any);
                            // Reset selections when scope changes upwards
                            if(e.target.value === 'Province') {
                                setMunicipality('');
                                setBarangay('');
                            } else if (e.target.value === 'Municipality') {
                                setBarangay('');
                            }
                        }}
                    >
                        <option value="Province">Provincial (All Areas)</option>
                        <option value="Municipality">Specific Municipality</option>
                        <option value="Barangay">Specific Barangay</option>
                    </Select>

                    {scope !== 'Province' && (
                        <Select 
                            label="Municipality" 
                            value={municipality} 
                            onChange={(e) => {
                                setMunicipality(e.target.value);
                                setBarangay(''); // Reset barangay when muni changes
                            }}
                        >
                            <option value="">Select Municipality</option>
                            {Object.keys(locationData).sort().map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </Select>
                    )}

                    {scope === 'Barangay' && (
                        <Select 
                            label="Barangay" 
                            value={barangay} 
                            onChange={(e) => setBarangay(e.target.value)}
                            disabled={!municipality}
                        >
                            <option value="">Select Barangay</option>
                            {(locationData[municipality] || []).map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </Select>
                    )}

                    <div className="text-xs text-slate-600 bg-white/20 p-2 rounded">
                        <strong>Preview:</strong> {formData.assigned_area || 'All Areas (Province-wide)'}
                    </div>
                </div>

                 <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} isLoading={isLoading}>Save Changes</Button>
                </div>
            </div>
        </Modal>
    );
};

const UsersPage: React.FC = () => {
    const { user, showToast, isOnline } = useApp();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('users').select('*').order('email');
        if (error) {
            showToast(error.message, 'error');
        } else {
            setUsers(data || []);
        }
        setIsLoading(false);
    }, [showToast]);

    useEffect(() => {
        if (user?.role === 'admin' && isOnline) {
            fetchUsers();
        }
    }, [user, isOnline, fetchUsers]);

    const handleSave = () => {
        setEditingUser(null);
        fetchUsers();
    };
    
    if (user?.role !== 'admin') {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Access Denied</h2>
                <GlassCard>
                    <div className="text-center py-10">
                         <Icon name="fa-lock" className="text-4xl text-red-500 mb-4" />
                        <p className="text-slate-700">You do not have permission to view this page.</p>
                    </div>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">User Management</h2>
            
             {isLoading ? (
                <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>
            ) : !isOnline ? (
                <GlassCard><div className="text-center py-10 text-slate-700">User management is unavailable while offline.</div></GlassCard>
            ) : (
                <>
                {/* Desktop View: Table */}
                <div className="hidden lg:block bg-white/20 backdrop-blur-lg rounded-2xl shadow-lg border border-white/30 overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-white/30">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Assigned Area</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-white/20">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-white/20">
                                    <td data-label="Email" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{u.email}</td>
                                    <td data-label="Role" className="px-6 py-4 whitespace-nowrap text-sm capitalize text-slate-800">{u.role}</td>
                                    <td data-label="Assigned Area" className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{u.assigned_area || 'N/A'}</td>
                                    <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Button variant="ghost" size="sm" onClick={() => setEditingUser(u)}>Edit</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                      </table>
                </div>

                {/* Mobile/Tablet View: Cards */}
                <div className="lg:hidden space-y-4">
                     {users.map(u => (
                        <div key={u.id} className="bg-white/40 backdrop-blur-md rounded-xl p-4 shadow-sm border border-white/40 flex flex-col gap-3">
                             <div className="flex justify-between items-start gap-4">
                                 <div className="min-w-0 flex-1">
                                     <h3 className="font-bold text-slate-900 break-all">{u.email}</h3>
                                     <span className="inline-block px-2 py-0.5 mt-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 capitalize border border-blue-200">
                                        {u.role}
                                     </span>
                                 </div>
                                 <Button variant="ghost" size="sm" onClick={() => setEditingUser(u)} className="text-blue-700 flex-shrink-0">
                                     <Icon name="fa-pen" />
                                 </Button>
                             </div>
                             
                             <div className="flex items-center text-sm text-slate-700 bg-white/20 p-2 rounded">
                                 <Icon name="fa-map-marker-alt" className="mr-2 text-slate-500"/>
                                 <span>{u.assigned_area || 'No Assigned Area'}</span>
                             </div>
                        </div>
                     ))}
                </div>
                </>
            )}
            
             {editingUser && (
                <UserEditModal 
                    userToEdit={editingUser} 
                    onClose={() => setEditingUser(null)} 
                    onSave={handleSave} 
                />
            )}
        </div>
    );
};

export default UsersPage;
