import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://auhwwwlcyjgkwelhglwg.supabase.co';
const supabaseKey = 'sb_publishable_y25W3H8Xg29_Si4cj1swbw_ppPlyOdT';

export const supabase = createClient(supabaseUrl, supabaseKey);