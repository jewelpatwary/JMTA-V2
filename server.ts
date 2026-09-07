import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  }) : null;

  // Trust proxy for Cloud Run/Nginx
  app.set('trust proxy', true);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Initialize Vite or Static serving
  if (process.env.NODE_ENV !== "production") {
    console.log('🛠️ Initializing Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log('✅ Vite middleware ready.');
  } else {
    console.log('📦 Serving static files from dist...');
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('❌ FATAL ERROR STARTING SERVER:', err);
});
