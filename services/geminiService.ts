
import { GoogleGenAI } from "@google/genai";
import { DisasterEvent, EvacuationCenter, Incident } from "../types";

// Safely retrieve API Key to prevent crash in non-Node environments
const getApiKey = () => {
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env.API_KEY;
        }
    } catch (e) {
        // process is not defined
    }
    return undefined;
};

const API_KEY = getApiKey();

if (!API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled.");
}

// Initialize lazily or with a dummy key if missing to prevent constructor error
const ai = new GoogleGenAI({ apiKey: API_KEY || 'MISSING_KEY' });

export const generateDashboardSummary = async (stats: { [key: string]: number }): Promise<string> => {
  if (!API_KEY) {
    return "AI feature is disabled. Please configure the API Key.";
  }
  
  const statsString = Object.entries(stats)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(', ');

  const prompt = `You are a disaster response coordinator. Based on the following data, provide a concise, one-paragraph summary of the current situation for a status report. Highlight the most critical numbers. Data: ${statsString}.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });
    return response.text || "No summary generated.";
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    return "Could not generate AI summary at this time.";
  }
};

type ReportData = {
    event: DisasterEvent;
    stats: { [key: string]: number };
    incidents: Incident[];
    evacCenters: EvacuationCenter[];
}

export const generateReport = async (reportType: string, data: ReportData): Promise<string> => {
  if (!API_KEY) {
    return "AI feature is disabled. Please configure the API Key.";
  }
  
  let prompt = '';

  const { event, stats, incidents } = data;
  const statsString = Object.entries(stats)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(', ');

  switch (reportType) {
    case 'Executive Summary':
      prompt = `
        You are a Disaster Response Chief preparing an executive summary for government officials regarding the "${event.name}" event. 
        The event is currently "${event.status}".
        
        Current key statistics are: ${statsString}.
        
        Based on this data, provide a formal, well-structured executive summary. Include:
        1. A brief overview of the situation.
        2. Key figures on affected populations (Safe, Evacuated, Injured, Missing, Deceased).
        3. A concluding sentence on the current response focus.
        
        Format the output clearly with headings.
      `;
      break;

    case 'Logistics Needs Assessment':
        const totalEvacuated = stats.Evacuated || 0;
        prompt = `
        You are a Logistics Coordinator for the "${event.name}" disaster response.
        There are currently ${totalEvacuated} individuals registered as "Evacuated".

        Based on this number, provide a logistics needs assessment. Estimate the daily requirements for the following, assuming standard humanitarian rations:
        1.  **Food:** (e.g., number of food packs, assuming 1 pack per family of 5).
        2.  **Water:** (in liters, assuming 3 liters per person for drinking and sanitation).
        3.  **Medical Supplies:** Mention the most likely needed supplies (e.g., first aid kits, hygiene kits, medicine for common ailments).

        Present this as a brief, actionable report for the logistics team. Start with a summary of the total evacuees, followed by a bulleted list of estimated needs.
      `;
      break;

    case 'Incident Hotspot Analysis':
      const barangayCounts = incidents.reduce((acc, incident) => {
        if(incident.resident?.barangay) {
            const barangay = incident.resident.barangay;
            acc[barangay] = (acc[barangay] || 0) + 1;
        }
        return acc;
      }, {} as {[key: string]: number});

      const incidentDataString = Object.entries(barangayCounts)
        .sort(([,a],[,b]) => b - a)
        .map(([barangay, count]) => `- ${barangay}: ${count} incident(s)`)
        .join('\n');

      prompt = `
        You are a Data Analyst for the disaster response team, focusing on the "${event.name}" event.
        You have been given a list of reported incidents aggregated by barangay.

        Incident Data:
        ${incidentDataString || "No incidents with location data reported."}

        Please perform the following:
        1.  Identify the top 3 barangays with the highest number of incidents. These are the "hotspots".
        2.  If there are no incidents, state that clearly.
        3.  Provide a brief recommendation, suggesting that response teams may need to focus their efforts on these hotspot areas.

        Format the analysis as a short, clear memo for the operations chief.
      `;
      break;

    default:
      return "Invalid report type selected.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.4,
      }
    });
    return response.text || "No report generated.";
  } catch (error) {
    console.error("Error generating report with Gemini:", error);
    return "An error occurred while generating the AI report. Please check the console for details.";
  }
};
