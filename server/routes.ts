
const __dir = path.resolve(process.cwd(), "server");
import type { Express } from "express";
import type { Server } from "http";
import * as fs from "fs";
import * as path from "path";

import multer from "multer";
import { storage } from "./storage";
import { scrapeLinkedIn, downloadPhoto } from "./linkedin";
import { parseResume } from "./resumeParser";
import { generatePptx, type CandidateData } from "./pptxGenerator";


const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });
const uploadFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]);

export function registerRoutes(httpServer: Server, app: Express) {
  // POST /api/cards — create a new card generation job from LinkedIn URL
  app.post("/api/cards", async (req, res) => {
    const { linkedinUrl, manualData } = req.body;

    if (!linkedinUrl && !manualData) {
      return res.status(400).json({ error: "LinkedIn URL or manual data is required" });
    }

    // Create card record
    const card = storage.createCard({ linkedinUrl: linkedinUrl || "manual", status: "processing" });

    // Process async
    processCard(card.id, linkedinUrl, manualData).catch((err) => {
      console.error("Card processing error:", err);
      storage.updateCard(card.id, { status: "error", errorMessage: err.message });
    });

    res.json(card);
  });

  // POST /api/cards/manual — create from manual form data
  app.post("/api/cards/manual", uploadFields, async (req, res) => {
    try {
      const manualData = JSON.parse(req.body.data);
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const photoPath = files?.photo?.[0]?.path || null;
      const logoPath = files?.logo?.[0]?.path || null;

      const card = storage.createCard({ linkedinUrl: "manual", status: "processing" });

      processManualCard(card.id, manualData, photoPath, logoPath).catch((err) => {
        console.error("Manual card error:", err);
        storage.updateCard(card.id, { status: "error", errorMessage: err.message });
      });

      res.json(card);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/cards/:id — poll card status
  app.get("/api/cards/:id", (req, res) => {
    const card = storage.getCard(parseInt(req.params.id));
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  });

  // GET /api/cards/:id/download — download the PPTX
  app.get("/api/cards/:id/download", (req, res) => {
    const card = storage.getCard(parseInt(req.params.id));
    if (!card || !card.pptxPath) return res.status(404).json({ error: "File not ready" });
    if (!fs.existsSync(card.pptxPath)) return res.status(404).json({ error: "File not found on disk" });

    const filename = `${(card.name || "candidate").replace(/[^a-z0-9]/gi, "-")}-baseball-card.pptx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(card.pptxPath));
  });

  // POST /api/cards/resume — parse a resume PDF and generate a card
  app.post("/api/cards/resume", upload.single("resume"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No resume file uploaded" });

      const card = storage.createCard({ linkedinUrl: "resume", status: "processing" });

      processResumeCard(card.id, req.file.path).catch((err) => {
        console.error("Resume card error:", err);
        storage.updateCard(card.id, { status: "error", errorMessage: err.message });
      });

      res.json(card);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/cards — get all cards (history)
  app.get("/api/cards", (req, res) => {
    res.json(storage.getAllCards());
  });
}

async function processCard(cardId: number, linkedinUrl: string, manualData?: any) {
  try {
    let profileData: CandidateData;

    if (manualData) {
      profileData = manualData;
    } else {
      // Scrape LinkedIn
      const profile = await scrapeLinkedIn(linkedinUrl);

      // Download photo if available
      let photoPath: string | null = null;
      if (profile.photoUrl) {
        photoPath = await downloadPhoto(profile.photoUrl, UPLOADS_DIR);
      }

      profileData = {
        name: profile.name,
        title: profile.title,
        company: profile.company,
        location: profile.location,
        companyLocation: profile.companyLocation,
        companyType: profile.companyType,
        companyDescription: profile.companyDescription,
        experience: profile.experience,
        education: profile.education,
        photoPath,
      };
    }

    // Save parsed data to DB
    storage.updateCard(cardId, {
      name: profileData.name,
      title: profileData.title,
      company: profileData.company,
      location: profileData.location,
      companyLocation: profileData.companyLocation,
      companyType: profileData.companyType,
      companyDescription: profileData.companyDescription,
      experience: JSON.stringify(profileData.experience),
      education: JSON.stringify(profileData.education),
    });

    // Generate PPTX
    const outputPath = path.join(UPLOADS_DIR, `card-${cardId}.pptx`);
    await generatePptx(profileData, outputPath);

    storage.updateCard(cardId, { status: "done", pptxPath: outputPath });
  } catch (err: any) {
    storage.updateCard(cardId, { status: "error", errorMessage: err.message });
  }
}

async function processResumeCard(cardId: number, resumePath: string) {
  try {
    const parsed = await parseResume(resumePath);

    storage.updateCard(cardId, {
      name: parsed.name,
      title: parsed.title,
      company: parsed.company,
      location: parsed.location,
      companyLocation: parsed.companyLocation,
      companyType: parsed.companyType,
      companyDescription: parsed.companyDescription,
      experience: JSON.stringify(parsed.experience),
      education: JSON.stringify(parsed.education),
    });

    const profileData: CandidateData = { ...parsed, photoPath: null, logoPath: null };
    const outputPath = path.join(UPLOADS_DIR, `card-${cardId}.pptx`);
    await generatePptx(profileData, outputPath);
    storage.updateCard(cardId, { status: "done", pptxPath: outputPath });
  } catch (err: any) {
    storage.updateCard(cardId, { status: "error", errorMessage: err.message });
  }
}

async function processManualCard(cardId: number, data: CandidateData, photoPath: string | null, logoPath: string | null = null) {
  const profileData: CandidateData = { ...data, photoPath, logoPath };

  storage.updateCard(cardId, {
    name: profileData.name,
    title: profileData.title,
    company: profileData.company,
    location: profileData.location,
    companyLocation: profileData.companyLocation,
    companyType: profileData.companyType,
    companyDescription: profileData.companyDescription,
    experience: JSON.stringify(profileData.experience),
    education: JSON.stringify(profileData.education),
  });

  const outputPath = path.join(UPLOADS_DIR, `card-${cardId}.pptx`);
  await generatePptx(profileData, outputPath);
  storage.updateCard(cardId, { status: "done", pptxPath: outputPath });
}
