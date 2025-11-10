import app from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;

// For local development - start traditional server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

// For Vercel serverless deployment - export app as default
// Vercel will handle the server startup automatically
export default app;
