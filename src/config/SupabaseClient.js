import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg =
    "❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables";
  console.error(errorMsg);
  console.error("📌 Please set these variables in your deployment platform");
  throw new Error(errorMsg);
}

console.log("✅ Supabase Client initialized");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
