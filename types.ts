

export interface User {
  id: string;
  email?: string;
  role: 'admin' | 'encoder' | 'viewer';
  assigned_area?: string;
}

export type ResidentStatus = 'Safe' | 'Evacuated' | 'Injured' | 'Missing' | 'Deceased' | 'Unknown';

export interface Resident {
  id: string;
  created_at?: string;
  first_name: string;
  last_name: string;
  dob?: string;
  age?: number;
  sex?: 'M' | 'F' | 'O';
  municipality: string;
  barangay: string;
  purok?: string;
  street?: string;
  is_pwd?: boolean;
  head_of_family_name?: string;
  is_head_of_family?: boolean;
  user_id?: string;
  status?: ResidentStatus;
  evac_center_id?: string;
  full_name?: string; // For RPC results
  qr_code_url?: string;
}

export type EventStatus = 'Active' | 'Monitoring' | 'Resolved';
export type EventType = 'Storm' | 'Fire' | 'Landslide' | 'Earthquake' | 'Flood' | 'Other';

export interface DisasterEvent {
  id: string;
  created_at: string;
  name: string;
  type: EventType;
  status: EventStatus;
  description?: string;
  affected_locations: {
    municipalities: string[];
    barangays: string[];
  };
}

export interface Incident {
    id: string;
    timestamp: string;
    event: { name: string };
    resident: { first_name: string, last_name: string, barangay: string, municipality: string };
    type: string;
    description: string;
    photo_url?: string;
}

export interface EvacuationCenter {
    id: string;
    name: string;
    barangay: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    capacity: number;
    occupancy?: number;
}

export interface LocationData {
    [municipality: string]: string[];
}

export interface Database {
  public: {
    Tables: {
      residents: {
        Row: {
          id: string;
          created_at?: string;
          first_name: string;
          last_name: string;
          dob?: string;
          age?: number;
          sex?: 'M' | 'F' | 'O';
          municipality: string;
          barangay: string;
          purok?: string;
          street?: string;
          is_pwd?: boolean;
          head_of_family_name?: string;
          is_head_of_family?: boolean;
          user_id?: string;
          qr_code_url?: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          first_name: string;
          last_name: string;
          dob?: string;
          age?: number;
          sex?: 'M' | 'F' | 'O';
          municipality: string;
          barangay: string;
          purok?: string;
          street?: string;
          is_pwd?: boolean;
          head_of_family_name?: string;
          is_head_of_family?: boolean;
          user_id?: string;
          qr_code_url?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          first_name?: string;
          last_name?: string;
          dob?: string;
          age?: number;
          sex?: 'M' | 'F' | 'O';
          municipality?: string;
          barangay?: string;
          purok?: string;
          street?: string;
          is_pwd?: boolean;
          head_of_family_name?: string;
          is_head_of_family?: boolean;
          user_id?: string;
          qr_code_url?: string;
        };
      };
      events: {
        Row: DisasterEvent;
        Insert: Omit<DisasterEvent, 'id' | 'created_at'>;
        Update: {
          name?: string;
          type?: EventType;
          status?: EventStatus;
          description?: string;
          affected_locations?: {
            municipalities: string[];
            barangays: string[];
          };
        };
      };
      incident_reports: {
        Row: {
          id: string;
          timestamp: string;
          event_id: string;
          resident_id: string;
          type: string;
          description: string;
          photo_url?: string;
        };
        Insert: {
          event_id: string;
          resident_id: string;
          type: string;
          description: string;
          photo_url?: string;
        };
        Update: {
          event_id?: string;
          resident_id?: string;
          type?: string;
          description?: string;
          photo_url?: string;
        };
      };
      evacuation_centers: {
        Row: EvacuationCenter;
        Insert: Omit<EvacuationCenter, 'id' | 'occupancy'>;
        Update: {
          name?: string;
          barangay?: string;
          address?: string;
          latitude?: number;
          longitude?: number;
          capacity?: number;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          role: 'admin' | 'encoder' | 'viewer';
          assigned_area?: string;
        };
        Insert: {
          id: string;
          email: string;
          role: 'admin' | 'encoder' | 'viewer';
          assigned_area?: string;
        };
        Update: {
          email?: string;
          role?: 'admin' | 'encoder' | 'viewer';
          assigned_area?: string;
        };
      };
      barangays: {
        Row: {
          id: number;
          municipality: string;
          barangay: string;
        };
        Insert: {
          municipality: string;
          barangay: string;
        };
        Update: {
          municipality?: string;
          barangay?: string;
        };
      };
      resident_status_log: {
        Row: {
          id: number;
          resident_id: string;
          status: ResidentStatus;
          event_id: string;
          timestamp: string;
          evac_center_id?: string;
        };
        Insert: {
          resident_id: string;
          status: ResidentStatus;
          event_id: string;
          evac_center_id?: string | null;
        };
        Update: {
          status?: ResidentStatus;
          evac_center_id?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_residents_with_status: {
        Args: { p_event_id: string };
        Returns: Resident[];
      };
      search_family_heads: {
        Args: { p_barangay: string; p_keyword: string };
        Returns: Resident[];
      };
    };
  };
}