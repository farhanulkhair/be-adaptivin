/**
 * Environment Variables Checker
 * Validates that all required environment variables are set
 */

export function checkRequiredEnvVars() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET",
  ];

  const optional = [
    "API_AI_KEY",
    "YOUTUBE_API_KEY",
    "FRONTEND_URL",
    "ADMIN_URL",
    "GCP_PROJECT_ID",
    "GCP_KEY_FILE",
  ];

  console.log("\n🔍 Checking Environment Variables...\n");

  let hasErrors = false;

  // Check required variables
  required.forEach((varName) => {
    if (!process.env[varName]) {
      console.error(`❌ MISSING: ${varName}`);
      hasErrors = true;
    } else {
      const value = process.env[varName];
      const preview =
        value.length > 20 ? value.substring(0, 20) + "..." : value;
      console.log(`✅ ${varName}: ${preview}`);
    }
  });

  // Check optional variables
  console.log("\n📋 Optional Variables:");
  optional.forEach((varName) => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`⚠️  ${varName}: Not set (optional)`);
    }
  });

  console.log("\n");

  if (hasErrors) {
    console.error("❌ Some required environment variables are missing!");
    console.error(
      "📌 Please set them in your deployment platform (Vercel/Railway/Render)"
    );
    throw new Error("Missing required environment variables");
  } else {
    console.log("✅ All required environment variables are set!");
  }

  return true;
}
