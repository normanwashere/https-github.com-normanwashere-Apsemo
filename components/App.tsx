
import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { User, LocationData, Database } from './types';
import { supabase } from './services/supabase';

import AuthPage from './components/AuthPage';
import DashboardPage from './components/DashboardPage';
import ResidentsPage from './components/ResidentsPage';
import EventsPage from './components/EventsPage';
import { StatusUpdatePage } from './components/StatusUpdatePage';
import IncidentsPage from './components/IncidentsPage';
import EvacCentersPage from './components/EvacCentersPage';
import UsersPage from './components/UsersPage';
import SettingsPage from './components/SettingsPage';
import ReportsPage from './components/ReportsPage';
import { Icon, Toast, ConfirmationModal } from './components/ui';

interface ToastState {
    message: string;
    type: 'success' | 'error';
}

interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

interface AppContextType {
    user: User | null;
    logout: () => void;
    isLoading: boolean;
    isOnline: boolean;
    locationData: LocationData;
    barangayToMunicipalityMap: { [barangay: string]: string };
    showToast: (message: string, type?: 'success' | 'error') => void;
    showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

const navLinksConfig = {
    admin: [
        { name: 'Dashboard', path: '/', icon: 'fa-tachometer-alt' },
        { name: 'Residents', path: '/residents', icon: 'fa-users' },
        { name: 'Events', path: '/events', icon: 'fa-bolt' },
        { name: 'Update', path: '/update', icon: 'fa-qrcode' },
        { name: 'Incidents', path: '/incidents', icon: 'fa-exclamation-triangle' },
        { name: 'Centers', path: '/evac-centers', icon: 'fa-hospital' },
        { name: 'Reports', path: '/reports', icon: 'fa-robot' },
        { name: 'Users', path: '/users', icon: 'fa-user-cog' },
        { name: 'Settings', path: '/settings', icon: 'fa-cog' },
    ],
    encoder: [
        { name: 'Dashboard', path: '/', icon: 'fa-tachometer-alt' },
        { name: 'Residents', path: '/residents', icon: 'fa-users' },
        { name: 'Events', path: '/events', icon: 'fa-bolt' },
        { name: 'Update', path: '/update', icon: 'fa-qrcode' },
        { name: 'Incidents', path: '/incidents', icon: 'fa-exclamation-triangle' },
        { name: 'Centers', path: '/evac-centers', icon: 'fa-hospital' },
        { name: 'Reports', path: '/reports', icon: 'fa-robot' },
        { name: 'Settings', path: '/settings', icon: 'fa-cog' },
    ],
    viewer: [
        { name: 'Dashboard', path: '/', icon: 'fa-tachometer-alt' },
        { name: 'Events', path: '/events', icon: 'fa-bolt' },
        { name: 'Incidents', path: '/incidents', icon: 'fa-exclamation-triangle' },
        { name: 'Centers', path: '/evac-centers', icon: 'fa-hospital' },
        { name: 'Settings', path: '/settings', icon: 'fa-cog' },
    ],
};

const Sidebar: React.FC = () => {
    const { user, logout, isOnline } = useApp();
    const navLinks = user ? navLinksConfig[user.role] : [];

    return (
        <aside className="bg-white/20 backdrop-blur-lg text-slate-800 w-64 p-4 flex-col fixed inset-y-0 left-0 transform -translate-x-full md:flex md:translate-x-0 transition-transform duration-300 ease-in-out z-30 border-r border-white/30">
            <div className="flex items-center mb-8 px-2">
                <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mr-3 overflow-hidden shadow-sm">
                    <img src="https://sofia.static.domains/Logos/apsemo2.png" alt="APSEMO Logo" className="h-full w-full object-cover" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">DM App</h1>
            </div>
            <nav className="space-y-1 flex-grow overflow-y-auto">
                {navLinks.map((link) => (
                    <NavLink
                        key={link.name}
                        to={link.path}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 p-3 rounded-lg text-slate-800 hover:bg-white/30 transition-colors duration-200 ${
                            isActive ? 'bg-blue-200/50 text-blue-900 font-semibold border-l-4 border-blue-600 pl-2' : ''
                            }`
                        }
                    >
                        <Icon name={link.icon} className="w-5 text-center fa-fw" />
                        <span className="font-medium">{link.name}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="mt-auto pt-4">
                <div className={`text-xs font-medium text-center p-2 rounded-lg mb-2 ${isOnline ? 'bg-green-300/50 text-green-900' : 'bg-red-300/50 text-red-900'}`}>
                    <Icon name={isOnline ? 'fa-check-circle' : 'fa-plane-slash'} className="mr-2" />
                    {isOnline ? 'Online' : 'Offline'}
                </div>
                <button onClick={logout} className="w-full text-left flex items-center space-x-3 p-3 rounded-lg text-slate-800 hover:bg-white/30 transition-colors duration-200">
                    <Icon name="fa-sign-out-alt" className="fa-fw" />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </aside>
    );
};

const BottomNav: React.FC = () => {
    const { user } = useApp();
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const location = useLocation();
    
    // Close menu when route changes
    useEffect(() => {
        setShowMoreMenu(false);
    }, [location]);

    if (!user) return null;

    const navLinks = navLinksConfig[user.role];
    const MAX_SLOTS = 5;
    
    // Logic: If links > 5, we show 4 links + "More" button. If <= 5, we show all of them.
    const showMore = navLinks.length > MAX_SLOTS;
    const visibleLinks = showMore ? navLinks.slice(0, MAX_SLOTS - 1) : navLinks;
    const hiddenLinks = showMore ? navLinks.slice(MAX_SLOTS - 1) : [];

    const isMoreActive = hiddenLinks.some(link => link.path === location.pathname);

    return (
        <>
            {/* Backdrop for More Menu */}
            {showMoreMenu && (
                <div 
                    className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm animate-fadeIn" 
                    onClick={() => setShowMoreMenu(false)}
                />
            )}

            {/* More Menu Popup */}
            <div className={`md:hidden fixed bottom-[85px] right-4 left-4 z-50 transition-all duration-200 transform origin-bottom ${showMoreMenu ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4 pointer-events-none'}`}>
                 <div className="bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-4 grid grid-cols-3 gap-3">
                    {hiddenLinks.map((link) => (
                        <NavLink
                            key={link.name}
                            to={link.path}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 text-center ${
                                isActive ? 'bg-blue-100/60 text-blue-900 shadow-inner' : 'hover:bg-white/50 text-slate-700'
                                }`
                            }
                            onClick={() => setShowMoreMenu(false)}
                        >
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm transition-colors ${location.pathname === link.path ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                <Icon name={link.icon} className="text-lg" />
                             </div>
                            <span className="text-[10px] font-bold">{link.name}</span>
                        </NavLink>
                    ))}
                 </div>
                 {/* Decorative Triangle/Arrow pointing to the More button */}
                 <div className="absolute -bottom-2 right-[10%] w-4 h-4 bg-white/90 backdrop-blur-xl border-r border-b border-white/40 transform rotate-45"></div>
            </div>

            {/* Main Bottom Bar */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl flex justify-around items-center z-50 border-t border-white/20 pb-safe pt-2 h-[80px] px-2 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] rounded-t-2xl">
                {visibleLinks.map((link) => (
                    <NavLink
                        key={link.name}
                        to={link.path}
                        className={({ isActive }) =>
                            `flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-200 group ${
                            isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'
                            }`
                        }
                    >
                         {({ isActive }) => (
                            <>
                                <div className={`relative p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-blue-100 text-blue-700 translate-y-[-5px] shadow-lg shadow-blue-500/20' : 'group-hover:bg-slate-100'}`}>
                                     <Icon name={link.icon} className="text-xl" />
                                </div>
                                <span className={`text-[10px] font-bold mt-1 transition-all duration-200 ${isActive ? 'opacity-100 translate-y-[-2px]' : 'opacity-80'}`}>{link.name}</span>
                            </>
                         )}
                    </NavLink>
                ))}

                {showMore && (
                    <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-200 group ${
                            isMoreActive || showMoreMenu ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <div className={`relative p-2 rounded-2xl transition-all duration-300 ${isMoreActive || showMoreMenu ? 'bg-blue-100 text-blue-700 translate-y-[-5px] shadow-lg shadow-blue-500/20' : 'group-hover:bg-slate-100'}`}>
                             <Icon name="fa-th-large" className={`text-xl transition-transform duration-300 ${showMoreMenu ? 'rotate-180' : ''}`} />
                        </div>
                        <span className={`text-[10px] font-bold mt-1 transition-all duration-200 ${isMoreActive || showMoreMenu ? 'opacity-100 translate-y-[-2px]' : 'opacity-80'}`}>More</span>
                    </button>
                )}
            </nav>
        </>
    );
};

const AppFooter: React.FC = () => (
    <footer className="text-center p-4 mt-8 text-slate-700 text-xs hidden md:block">
        <div className="flex justify-center items-center space-x-2">
          <span className="opacity-80">Powered by</span>
          <a href="https://dvotesoftware.com/" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 opacity-90 hover:opacity-100 transition-opacity">
            <img 
              src="https://albayheart.static.domains/dvote.png" 
              alt="d.vote Logo" 
              className="h-5 mix-blend-multiply"
            />
          </a>
        </div>
    </footer>
);


const AppContent: React.FC = () => {
    const { user, isLoading } = useApp();

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">
            <Icon name="fa-spinner" className="fa-spin text-blue-600 text-4xl" />
        </div>;
    }

    if (!user) {
        return <AuthPage />;
    }

    return (
        <div className="relative min-h-screen bg-slate-50/50">
            <Sidebar />
            {/* Added extra padding bottom for mobile to account for fixed nav */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto md:ml-64 pb-24 md:pb-6 min-h-screen">
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/residents" element={<ResidentsPage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/update" element={<StatusUpdatePage />} />
                    <Route path="/incidents" element={<IncidentsPage />} />
                    <Route path="/evac-centers" element={<EvacCentersPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
                <AppFooter />
            </main>
            <BottomNav />
        </div>
    );
};

const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [locationData, setLocationData] = useState<LocationData>({});
    const [toast, setToast] = useState<ToastState | null>(null);
    const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const navigate = useNavigate();

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    }, []);

    // Handle online/offline status changes
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchLocationData = useCallback(async () => {
        const { data, error } = await supabase.from('barangays').select('municipality, barangay');
        if (error) {
            console.error("Location data fetch error:", error);
            showToast("Failed to load location data.", "error");
            return;
        }
        const reducedData = data.reduce((acc, curr) => {
            const { municipality, barangay } = curr;
            if (!acc[municipality]) {
                acc[municipality] = [];
            }
            if (!acc[municipality].includes(barangay)) {
                acc[municipality].push(barangay);
            }
            return acc;
        }, {} as LocationData);
        setLocationData(reducedData);
    }, [showToast]);

    const barangayToMunicipalityMap = useMemo(() => {
        const map: { [barangay: string]: string } = {};
        for (const municipality in locationData) {
            for (const barangay of locationData[municipality]) {
                map[barangay] = municipality;
            }
        }
        return map;
    }, [locationData]);
    
    // Handles Auth state
    useEffect(() => {
        const fetchUserProfile = async (userId: string) => {
            const { data, error } = await supabase
                .from('users')
                .select('role, assigned_area')
                .eq('id', userId)
                .single();

            if (error) {
                // This case is when the user has an auth entry but no profile in the 'users' table.
                if (error.code === 'PGRST116') {
                    console.warn('User profile not found in database for id:', userId);
                    return { profile: null, error: 'Your user profile has not been created by an administrator. Please contact support.' };
                }
                
                // This is for any other database error.
                console.error('Database error fetching user profile:', JSON.stringify(error, null, 2));
                return { profile: null, error: 'A database error occurred while loading your profile. Please contact support.' };
            }
            return { profile: data, error: null };
        };
        
        const setUserWithProfile = async (sessionUser: any) => {
            const { profile, error } = await fetchUserProfile(sessionUser.id);

            if (error) {
                showToast(error, 'error');
                await supabase.auth.signOut();
                setUser(null);
                return;
            }
            
            if (profile) {
                setUser({ ...sessionUser, ...profile });
            } else {
                 // This case should be handled by the specific error messages above, but serves as a fallback.
                 showToast('User profile not found. Please contact an administrator.', 'error');
                 await supabase.auth.signOut();
                 setUser(null);
            }
        };

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUserWithProfile(session.user).finally(() => setIsLoading(false));
            } else {
                setIsLoading(false);
            }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsLoading(true);
            if (session?.user) {
                setUserWithProfile(session.user).finally(() => setIsLoading(false));
            } else {
                setUser(null);
                setIsLoading(false);
            }
        });

        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, [showToast]);
    
    // Handles fetching location data when user is available
    useEffect(() => {
        if(user && Object.keys(locationData).length === 0) {
            fetchLocationData();
        }
    }, [user, locationData, fetchLocationData]);


    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        navigate('/');
    }, [navigate]);

    const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
        setConfirm({ isOpen: true, title, message, onConfirm });
    }, []);

    const hideConfirm = () => {
        setConfirm({ ...confirm, isOpen: false });
    };

    const handleConfirm = () => {
        confirm.onConfirm();
        hideConfirm();
    }

    const value: AppContextType = useMemo(() => ({
        user,
        logout,
        isLoading,
        isOnline,
        locationData,
        barangayToMunicipalityMap,
        showToast,
        showConfirm,
    }), [user, isLoading, isOnline, locationData, barangayToMunicipalityMap, logout, showToast, showConfirm]);

    return (
        <AppContext.Provider value={value}>
            {children}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <ConfirmationModal 
                isOpen={confirm.isOpen}
                onClose={hideConfirm}
                onConfirm={handleConfirm}
                title={confirm.title}
                message={confirm.message}
            />
        </AppContext.Provider>
    );
};

const App: React.FC = () => (
    <HashRouter>
        <AppProvider>
            <AppContent />
        </AppProvider>
    </HashRouter>
);

export default App;
