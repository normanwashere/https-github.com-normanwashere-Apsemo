
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Button, Input, Icon, Modal } from './ui';

type AuthView = 'login' | 'register';

const TrustAndSafetyContent: React.FC = () => (
  <div className="space-y-4 text-slate-700 text-sm max-h-[60vh] overflow-y-auto pr-2">
    <h3 className="text-lg font-semibold text-slate-900">Our Commitment to Trust & Safety</h3>
    <p>This Disaster Management Application is a critical tool for life-saving operations. The integrity of the data and the security of the platform are our highest priorities. Your responsible use is essential.</p>
    
    <h4 className="font-semibold text-slate-800">1. Data Integrity and Accuracy</h4>
    <p>The information you enter directly impacts aid distribution and search-and-rescue efforts. We rely on you, the authorized user, to input the most accurate and up-to-date information possible. Deliberate entry of false information is strictly prohibited and may have severe consequences.</p>

    <h4 className="font-semibold text-slate-800">2. Authorized and Responsible Use</h4>
    <p>Access to this platform is restricted to authorized personnel from local government units (LGUs) and official disaster response agencies. Use of this application for any purpose other than official disaster management is a violation of our terms.</p>

    <h4 className="font-semibold text-slate-800">3. Platform Security</h4>
    <p>Our platform is built on a secure infrastructure (Supabase) that is SOC 2 certified. All data is encrypted both in transit (while it travels over the internet) and at rest (when stored in our database). We implement strict role-based access controls to ensure users can only see and modify data relevant to their designated roles.</p>
    
    <h4 className="font-semibold text-slate-800">4. Offline Data Security</h4>
    <p>The offline feature allows you to continue working in areas with no internet connectivity. You are responsible for the security of the data downloaded to your device. Please ensure your device is password-protected and secure from unauthorized access.</p>

    <h4 className="font-semibold text-slate-800">5. Reporting Concerns</h4>
    <p>If you suspect a data breach, notice significant data inaccuracies, or identify a security vulnerability, please report it immediately to your designated system administrator or IT support contact.</p>
  </div>
);

const PrivacyPolicyContent: React.FC = () => (
    <div className="space-y-4 text-slate-700 text-sm max-h-[60vh] overflow-y-auto pr-2">
        <h3 className="text-lg font-semibold text-slate-900">Privacy Policy</h3>
        <p><em>Last Updated: {new Date().toLocaleDateString()}</em></p>
        <p>This Privacy Policy describes how personal and sensitive information is collected, used, and protected through the Disaster Management Application, in compliance with the Republic Act No. 10173, or the Data Privacy Act of 2012 (DPA).</p>

        <h4 className="font-semibold text-slate-800">1. Information We Collect</h4>
        <p>We collect the following types of information solely for the purpose of disaster response and management:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li><strong>Resident Information:</strong> Name, date of birth, age, sex, address, PWD status, and family composition.</li>
            <li><strong>Resident Status Information:</strong> Health and status updates (e.g., 'Safe', 'Evacuated', 'Injured', 'Deceased'), location (including evacuation center), and timestamp of the update. This may be classified as Sensitive Personal Information under the DPA.</li>
            <li><strong>Incident Information:</strong> Details related to a resident involved in an incident, which may include photos submitted by authorized users.</li>
            <li><strong>User Account Information:</strong> Your name, email address, and assigned role for platform access control.</li>
        </ul>

        <h4 className="font-semibold text-slate-800">2. How We Use Information</h4>
        <p>The collected data is used exclusively for:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li>Identifying and locating residents in affected areas.</li>
            <li>Coordinating search, rescue, and medical aid operations.</li>
            <li>Managing evacuation center populations and logistics.</li>
            <li>Providing timely assistance and relief goods.</li>
            <li>Generating anonymized statistical reports for post-disaster analysis and future planning.</li>
        </ul>

        <h4 className="font-semibold text-slate-800">3. Data Sharing and Disclosure</h4>
        <p>Personal data will not be sold or shared with unauthorized third parties. Information will only be disclosed to:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li>Relevant government agencies (e.g., NDRRMC, DSWD, DOH) and Local Government Units (LGUs) directly involved in the disaster response.</li>
            <li>Official humanitarian partners providing aid under the supervision of the LGU.</li>
            <li>Law enforcement or other authorities when required by law.</li>
        </ul>

        <h4 className="font-semibold text-slate-800">4. Data Security</h4>
        <p>We are committed to protecting your data. We implement technical and organizational security measures including data encryption, access controls, and use a secure, compliant cloud backend to prevent unauthorized access, use, or disclosure.</p>

        <h4 className="font-semibold text-slate-800">5. Data Retention</h4>
        <p>Personal data is retained only for the duration of the disaster event and for a necessary period afterward to comply with legal and reporting obligations. Following this period, data will be securely archived, anonymized, or deleted.</p>

        <h4 className="font-semibold text-slate-800">6. Your Rights as a Data Subject</h4>
        <p>As a data subject, you have rights under the DPA, including the right to be informed, to object, access, and correct your personal data. Given the emergency context, the exercise of these rights may be subject to limitations to ensure the unhampered delivery of critical public services. To exercise your rights, please contact your LGU's Data Protection Officer or the system administrator.</p>
    </div>
);

const TermsOfServiceContent: React.FC = () => (
    <div className="space-y-4 text-slate-700 text-sm max-h-[60vh] overflow-y-auto pr-2">
        <h3 className="text-lg font-semibold text-slate-900">Terms of Service</h3>
        <p>By accessing or using the Disaster Management Application ("Service"), you agree to be bound by these Terms of Service ("Terms"). This Service is provided to authorized personnel for official use only.</p>

        <h4 className="font-semibold text-slate-800">1. User Accounts and Responsibilities</h4>
        <ul className="list-disc pl-5 space-y-1">
            <li>You must be an authorized user from a recognized government agency or partner organization to create an account.</li>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>You are responsible for the accuracy and legality of all data you input into the Service.</li>
        </ul>

        <h4 className="font-semibold text-slate-800">2. Acceptable Use</h4>
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li>Enter knowingly false or misleading information.</li>
            <li>Access or attempt to access data for which you are not authorized.</li>
            <li>Use the data for personal, commercial, or any other non-official purpose.</li>
            <li>Perform any action that could compromise the security or integrity of the Service or its data.</li>
        </ul>

        <h4 className="font-semibold text-slate-800">3. Service Availability and Disclaimer</h4>
        <p>The Service is provided "as is" and "as available". While we strive for high availability and data accuracy, we do not guarantee that the service will be uninterrupted or error-free, especially during a disaster where infrastructure may be compromised. The information within the app is a tool to aid decision-making, not replace it. On-the-ground verification remains critical.</p>

        <h4 className="font-semibold text-slate-800">4. Limitation of Liability</h4>
        <p>To the fullest extent permitted by law, the providing government authority and its technology partners (including d.vote software) shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use the Service, or from reliance on information obtained from the Service.</p>

        <h4 className="font-semibold text-slate-800">5. Termination</h4>
        <p>We reserve the right to suspend or terminate your access to the Service at any time, without notice, for any violation of these Terms or for any other operational or security reason.</p>

        <h4 className="font-semibold text-slate-800">6. Governing Law</h4>
        <p>These Terms shall be governed by the laws of the Republic of the Philippines.</p>
    </div>
);


const AuthFooter: React.FC = () => {
    const [policyModal, setPolicyModal] = useState<{ title: string, content: React.ReactNode } | null>(null);

    const handlePolicyClick = (policyType: 'Trust' | 'Privacy' | 'Terms') => {
        let title = '';
        let content: React.ReactNode = null;

        if (policyType === 'Trust') {
            title = 'Trust & Safety';
            content = <TrustAndSafetyContent />;
        }
        if (policyType === 'Privacy') {
            title = 'Privacy Policy';
            content = <PrivacyPolicyContent />;
        }
        if (policyType === 'Terms') {
            title = 'Terms of Service';
            content = <TermsOfServiceContent />;
        }
        
        setPolicyModal({ title, content });
    };
    
    return (
        <>
            <footer className="text-center p-4 text-slate-700 text-xs w-full max-w-md">
                <div className="flex justify-center items-center space-x-6 mb-4">
                    <img
                        src="https://www.supranet.net/wp-content/uploads/2019/04/SNWebSOC-Service-Org_B_Marks_2c_Web.png"
                        alt="SOC 2 Certified"
                        className="h-12 opacity-90 mix-blend-multiply"
                        title="SOC 2 Certified Backend"
                        onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = 'https://placehold.co/120x48/e2e8f0/64748b?text=SOC+2'; }}
                    />
                    <img
                        src="https://aibc.com.ph/storage/corporate_governance_file/NPC-SOR-2026.JPG"
                        alt="National Privacy Commission"
                        className="h-12 opacity-90 mix-blend-multiply"
                        title="National Privacy Commission Compliant"
                        onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = 'https://placehold.co/120x48/e2e8f0/64748b?text=NPC'; }}
                    />
                    <img
                        src="https://supabase.com/docs/img/supabase-logo-wordmark--dark.svg"
                        alt="Powered by Supabase"
                        className="h-8 opacity-80"
                        title="Powered by Supabase"
                        onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = 'https://placehold.co/120x32/e2e8f0/64748b?text=Supabase'; }}
                    />
                </div>
                <div className="flex justify-center items-center space-x-2 mb-2">
                    <Icon name="fa-shield-alt" />
                    <span>Compliant with RA 10173 (DPA) &amp; GDPR Principles</span>
                </div>
                <div className="space-x-4 mb-4">
                    <button type="button" onClick={() => handlePolicyClick('Trust')} className="hover:underline cursor-pointer text-slate-700">Trust &amp; Safety</button>
                    <span>&bull;</span>
                    <button type="button" onClick={() => handlePolicyClick('Privacy')} className="hover:underline cursor-pointer text-slate-700">Privacy Policy</button>
                    <span>&bull;</span>
                    <button type="button" onClick={() => handlePolicyClick('Terms')} className="hover:underline cursor-pointer text-slate-700">Terms of Service</button>
                </div>
                <div className="flex flex-col justify-center items-center space-y-2 mt-4">
                  <span className="opacity-80">Powered by</span>
                  <a href="https://dvotesoftware.com/" target="_blank" rel="noopener noreferrer" className="opacity-90 hover:opacity-100 transition-opacity">
                    <img 
                      src="https://albayheart.static.domains/dvote.png" 
                      alt="d.vote Logo" 
                      className="h-8"
                    />
                  </a>
                </div>
            </footer>

            {policyModal && (
                <Modal 
                    isOpen={!!policyModal} 
                    onClose={() => setPolicyModal(null)}
                    title={policyModal.title}
                    size="2xl"
                >
                    {policyModal.content}
                </Modal>
            )}
        </>
    );
};

const AuthPage: React.FC = () => {
    const [view, setView] = useState<AuthView>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setIsLoading(false);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setIsLoading(true);
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setError(error.message);
        } else {
            setMessage('Registration successful! Please check your email to verify your account.');
            setView('login');
        }
        setIsLoading(false);
    };
    
    const getHeader = () => {
        if (view === 'login') return { title: 'Disaster Management Portal', subtitle: 'Please sign in to continue' };
        if (view === 'register') return { title: 'Create Account', subtitle: 'Create a new account to get started' };
        return { title: '', subtitle: '' };
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <main className="w-full max-w-md">
                <div className="bg-white/20 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/30 mb-8">
                    <div className="text-center mb-8">
                        <div className="mx-auto mb-4 h-44 w-44 rounded-full bg-white shadow-lg overflow-hidden flex items-center justify-center">
                            <img 
                                src="https://sofia.static.domains/Logos/apsemo2.png" 
                                alt="APSEMO Logo" 
                                className="h-full w-full object-cover" 
                            />
                        </div>
                        <h1 className="text-2xl font-semibold text-slate-900">{getHeader().title}</h1>
                        <p className="text-slate-800">{getHeader().subtitle}</p>
                    </div>

                    {error && <div className="mb-4 bg-red-300/50 text-red-900 px-4 py-3 rounded-lg text-sm border border-red-400/50">{error}</div>}
                    {message && <div className="mb-4 bg-blue-300/50 text-blue-900 px-4 py-3 rounded-lg text-sm border border-blue-400/50">{message}</div>}

                    {view === 'login' ? (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <Input label="Email Address" type="email" id="login-email" value={email} onChange={e => setEmail(e.target.value)} required />
                            <Input label="Password" type="password" id="login-password" value={password} onChange={e => setPassword(e.target.value)} required />
                            <Button type="submit" className="w-full" isLoading={isLoading}>Sign In</Button>
                            <div className="text-center">
                                <button type="button" onClick={() => setView('register')} className="text-sm text-blue-800 hover:text-blue-900 font-medium">
                                    Don't have an account? Sign Up
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-6">
                            <Input label="Email Address" type="email" id="register-email" value={email} onChange={e => setEmail(e.target.value)} required />
                            <Input label="Password" type="password" id="register-password" value={password} onChange={e => setPassword(e.target.value)} required />
                            <Button type="submit" className="w-full" isLoading={isLoading}>Sign Up</Button>
                            <div className="text-center">
                                <button type="button" onClick={() => setView('login')} className="text-sm text-blue-800 hover:text-blue-900 font-medium">
                                    Already have an account? Sign In
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </main>
            <AuthFooter />
        </div>
    );
};

export default AuthPage;
