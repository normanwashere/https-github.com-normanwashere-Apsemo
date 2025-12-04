import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

const supabaseUrl = 'https://relgoefialnkgicedlxq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbGdvZWZpYWxua2dpY2VkbHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyOTMxNzksImV4cCI6MjA2Njg2OTE3OX0.UwEeU3wSPjsOvv8svcc2OgE88s06qlQ7oKsBPV3MMbg';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
