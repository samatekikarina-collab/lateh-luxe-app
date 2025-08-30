// js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabaseUrl = 'https://ggderhinbbtxkdjnskbo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnZGVyaGluYmJ0eGtkam5za2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMTIwODcsImV4cCI6MjA3MDY4ODA4N30.4Pk48BBxbla9ULJ--VdUMd4uHpiYErBKKe-KDwIYIwI';
export const supabase = createClient(supabaseUrl, supabaseKey);
