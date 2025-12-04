import React, { useState, useCallback } from 'react';
import { useApp } from '../App';
import { supabase } from '../services/supabase';
import { generateReport } from '../services/geminiService';
import { DisasterEvent, ResidentStatus, Incident, EvacuationCenter, Resident } from '../types';
import { Button, Icon, Select, GlassCard, Spinner } from './ui';

const ReportsPage: React.FC = () => {
    const { user, showToast, isOnline } = useApp();
    const [reportType, setReportType] = useState('Executive Summary');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedReport, setGeneratedReport] = useState<string | null>(null);
    const [reportTitle, setReportTitle] = useState('');

    const handleGenerateReport = useCallback(async () => {
        if (!isOnline) {
            showToast("Cannot generate reports while offline.", "error");
            return;
        }
        setIsLoading(true);
        setGeneratedReport(null);

        try {
            // 1. Get active event
            const { data: eventData, error: eventError } = await supabase.from('events').select('*').eq('status', 'Active').limit(1).single();
            if (eventError || !eventData) {
                throw new Error("No active event found. Cannot generate report.");
            }
            
            setReportTitle(`${reportType} for "${eventData.name}"`);

            // 2. Fetch all necessary data in parallel
            const [residentsRes, incidentsRes, evacCentersRes] = await Promise.all([
                supabase.rpc('get_residents_with_status', { p_event_id: eventData.id }),
                supabase.from('incident_reports').select(`*, resident:residents(barangay)`).eq('event_id', eventData.id),
                supabase.from('evacuation_centers').select('*')
            ]);
            
            if (residentsRes.error) throw new Error(`Failed to fetch resident data: ${residentsRes.error.message}`);
            if (incidentsRes.error) throw new Error(`Failed to fetch incidents: ${incidentsRes.error.message}`);
            if (evacCentersRes.error) throw new Error(`Failed to fetch evac centers: ${evacCentersRes.error.message}`);
            
            const residents = (residentsRes.data as Resident[]) || [];
            const incidents = (incidentsRes.data as Incident[]) || [];
            const evacCenters = (evacCentersRes.data as EvacuationCenter[]) || [];

            // 3. Calculate stats from resident data
            const stats = { Safe: 0, Evacuated: 0, Injured: 0, Missing: 0, Deceased: 0, Unknown: 0 };
            residents.forEach(res => {
                if (res.status && stats.hasOwnProperty(res.status)) {
                    stats[res.status]++;
                } else {
                    stats.Unknown++;
                }
            });
            stats.Unknown += (residents.length > 0 ? 0 : (await supabase.from('residents').select('id', { count: 'exact' })).count || 0) - residents.length;


            // 4. Call Gemini Service
            const reportText = await generateReport(reportType, {
                event: eventData,
                stats,
                incidents,
                evacCenters
            });

            setGeneratedReport(reportText);

        } catch (error: any) {
            showToast(error.message, 'error');
            setGeneratedReport(`Failed to generate report:\n${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [reportType, isOnline, showToast]);
    
    if (user?.role === 'viewer') {
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
            <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">AI-Powered Report Generation</h2>

            <GlassCard>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <Select
                        label="Report Type"
                        value={reportType}
                        onChange={e => setReportType(e.target.value)}
                        className="w-full"
                    >
                        <option>Executive Summary</option>
                        <option>Logistics Needs Assessment</option>
                        <option>Incident Hotspot Analysis</option>
                    </Select>
                    <Button
                        onClick={handleGenerateReport}
                        isLoading={isLoading}
                        className="w-full sm:w-auto flex-shrink-0"
                        disabled={!isOnline}
                    >
                        <Icon name="fa-bolt" className="mr-2" />
                        Generate Report
                    </Button>
                </div>
                {!isOnline && <p className="text-center text-sm text-yellow-800 bg-yellow-200/50 p-2 rounded-lg mt-4">Report generation is disabled while offline.</p>}
            </GlassCard>

            <GlassCard className="min-h-[400px]">
                <h3 className="font-semibold text-xl mb-4 text-slate-900 border-b border-white/30 pb-3">{isLoading ? "Generating Report..." : (reportTitle || "Report Output")}</h3>
                <div className="prose prose-sm max-w-none text-slate-800">
                    {isLoading ? (
                         <div className="flex flex-col items-center justify-center h-64">
                            <Spinner className="w-10 h-10 text-blue-600"/>
                            <p className="mt-4 text-slate-700">Analyzing data and generating report...</p>
                         </div>
                    ) : generatedReport ? (
                        <pre className="whitespace-pre-wrap font-sans bg-transparent p-0">{generatedReport}</pre>
                    ) : (
                        <div className="text-center py-10">
                            <Icon name="fa-file-alt" className="text-4xl text-slate-500 mb-4" />
                            <p className="text-slate-700">Select a report type and click "Generate Report" to begin.</p>
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
};

export default ReportsPage;
