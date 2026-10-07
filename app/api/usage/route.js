import { createClient } from '@supabase/supabase-js';
import { createMonitorHandler } from '@/lib/usage-server';
export const runtime='nodejs';
export const GET=createMonitorHandler({authenticate:async bearer=>{
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(bearer.slice(7));
 return error?null:data.user;
}});
