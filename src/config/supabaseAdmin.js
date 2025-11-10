import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  const errorMsg =
    "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables";
  console.error(errorMsg);
  console.error("📌 Please set these variables in your deployment platform");
  throw new Error(errorMsg);
}

console.log("✅ Supabase Admin initialized with URL:", supabaseUrl);

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
  global: {
    headers: {
      "x-client-info": "supabase-admin",
    },
  },
});
