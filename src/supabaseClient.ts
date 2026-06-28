import { createClient } from '@supabase/supabase-js';

// Helper to clean environment variables (removes quotes, spaces, and handles accidental REST endpoint copy-paste)
const cleanEnvVar = (val: string | undefined): string => {
  if (!val) return '';
  let cleaned = val.trim().replace(/^['"]|['"]$/g, '').trim();
  
  // Auto-detect and fix if the user pasted the RESTful endpoint instead of the project base URL
  if (cleaned.endsWith('/rest/v1/')) {
    cleaned = cleaned.substring(0, cleaned.length - 9);
  } else if (cleaned.endsWith('/rest/v1')) {
    cleaned = cleaned.substring(0, cleaned.length - 8);
  }
  
  // Ensure no trailing slash remains
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }
  
  return cleaned;
};

const supabaseUrl = cleanEnvVar(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnvVar(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Check if credentials are set (must be non-empty and not the placeholder)
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder')
);

// Use dummy values if not configured to prevent runtime crash during initialization
const activeUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project-id.supabase.co';
const activeKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(activeUrl, activeKey);

export type DatabaseProfile = {
  id: string;
  role: 'admin' | 'student';
  full_name: string;
  updated_at?: string;
};

export type ContentBlock = 
  | { id: string; type: 'text'; value: string }
  | { id: string; type: 'youtube'; value: string }
  | { id: string; type: 'pdf'; value: string; file_name?: string }
  | { id: string; type: 'quiz'; questions: QuizQuestion[] }
  | { id: string; type: 'code'; language: string; value: string; description?: string };

export type QuizQuestion = {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
};

export type LearningPage = {
  id: string;
  title: string;
  slug: string;
  content: ContentBlock[];
  estimated_duration?: string;
  created_at: string;
};

export type QuizSubmission = {
  id: string;
  page_id: string;
  user_id: string;
  answers: Record<string, number>; // questionId -> selectedOptionIndex
  score: number;
  total_questions: number;
  created_at: string;
  profiles?: DatabaseProfile;
  learning_pages?: { title: string; slug: string };
};
