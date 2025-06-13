const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mjjdrqywbeqebijfbjxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qamRycXl3YmVxZWJpamZianhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTE2MTQsImV4cCI6MjA2NTMyNzYxNH0.AYVRj92sgURlpPQfnu3WZSNBUSIaTdmsWH8yy7Ig_2o';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase; 