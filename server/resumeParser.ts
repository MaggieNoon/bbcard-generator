/**
 * Resume Parser
 * Extracts candidate data from a PDF resume using text extraction + AI-style parsing
 */
import * as fs from "fs";
import * as path from "path";
import type { ExperienceEntry, EducationEntry } from "./linkedin";

export interface ParsedResume {
  name: string;
  title: string;
  company: string;
  location: string;
  companyLocation: string;
  companyType: string;
  companyDescription: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
}

export async function parseResume(filePath: string): Promise<ParsedResume> {
  // Dynamically import pdf-parse to avoid ESM issues
  const pdfParse = (await import("pdf-parse")).default;
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text;

  return extractFromText(text);
}

function extractFromText(text: string): ParsedResume {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // --- Name: usually the first non-empty line ---
  const name = lines[0] || "";

  // --- Title and current company ---
  let title = "";
  let company = "";
  let location = "";

  // Look for common patterns in first 10 lines
  for (let i = 1; i < Math.min(15, lines.length); i++) {
    const line = lines[i];
    // Skip email, phone, LinkedIn URLs
    if (line.match(/[@|linkedin|http|www|\d{3}[-.)]\d{3}]/i)) continue;
    // Location pattern: "City, State" or "City, ST"
    if (!location && line.match(/^[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}|^[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z]+$/)) {
      location = line;
      continue;
    }
    // Title is often the second non-empty, non-contact line
    if (!title && line.length < 80 && !line.match(/^\d/)) {
      title = line;
      continue;
    }
  }

  // --- Experience ---
  const experience: ExperienceEntry[] = [];
  const expSectionStart = findSectionStart(lines, ["experience", "work history", "employment", "career"]);
  const expSectionEnd = findNextSectionStart(lines, expSectionStart + 1, ["education", "skills", "certif", "awards"]);

  if (expSectionStart >= 0) {
    const expLines = lines.slice(expSectionStart + 1, expSectionEnd > 0 ? expSectionEnd : undefined);
    parseExperienceLines(expLines, experience);
  }

  // Current company from first experience entry
  if (experience.length > 0 && experience[0].company) {
    company = experience[0].company;
    if (!title && experience[0].title) {
      title = experience[0].title;
    }
  }

  // --- Education ---
  const education: EducationEntry[] = [];
  const eduSectionStart = findSectionStart(lines, ["education", "academic"]);
  const eduSectionEnd = findNextSectionStart(lines, eduSectionStart + 1, ["skills", "certif", "awards", "publications", "experience"]);

  if (eduSectionStart >= 0) {
    const eduLines = lines.slice(eduSectionStart + 1, eduSectionEnd > 0 ? eduSectionEnd : undefined);
    parseEducationLines(eduLines, education);
  }

  return {
    name,
    title,
    company,
    location,
    companyLocation: "",
    companyType: "",
    companyDescription: "",
    experience,
    education,
  };
}

function findSectionStart(lines: string[], keywords: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (keywords.some((k) => lower === k || lower.startsWith(k + " ") || lower.endsWith(" " + k))) {
      return i;
    }
  }
  return -1;
}

function findNextSectionStart(lines: string[], from: number, keywords: string[]): number {
  for (let i = from; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (keywords.some((k) => lower === k || lower.startsWith(k + " ") || lower.endsWith(" " + k))) {
      return i;
    }
  }
  return -1;
}

// Date range patterns
const DATE_PATTERN = /(\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|Present|Current)/i;
const DATE_RANGE_PATTERN = /(\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4})\s*[-–—to]+\s*(\d{4}|Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4})/i;

function parseExperienceLines(lines: string[], experience: ExperienceEntry[]) {
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check if this line contains a date range
    const dateMatch = line.match(DATE_RANGE_PATTERN);

    if (dateMatch) {
      const dateRange = dateMatch[0].trim();
      // The company/title might be on the same line or next lines
      const rest = line.replace(DATE_RANGE_PATTERN, "").trim();

      let company = "";
      let title = "";

      if (rest) {
        // Date and company on same line
        company = rest.replace(/[|·•–—]/g, " ").trim();
      } else if (i + 1 < lines.length) {
        // Company on next line
        company = lines[i + 1];
        i++;
      }

      // Title usually on the line after company
      if (i + 1 < lines.length && !lines[i + 1].match(DATE_RANGE_PATTERN)) {
        title = lines[i + 1];
        i++;
      }

      if (company || title) {
        experience.push({ dateRange, company: company || "", title: title || "" });
      }
    } else if (line.length > 2 && line.length < 100 && !line.match(/^[•\-*]/)) {
      // Could be a company name without an explicit date
      // Look ahead for a date or title
      let company = line;
      let dateRange = "";
      let title = "";

      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextDateMatch = nextLine.match(DATE_RANGE_PATTERN);
        if (nextDateMatch) {
          dateRange = nextDateMatch[0];
          i++;
          if (i + 1 < lines.length && !lines[i + 1].match(DATE_RANGE_PATTERN)) {
            title = lines[i + 1];
            i++;
          }
        } else if (nextLine.length < 80 && !nextLine.match(/^[•\-*]/)) {
          title = nextLine;
          i++;
        }
      }

      if (dateRange || title) {
        experience.push({ dateRange, company, title });
      }
    }

    i++;
  }
}

function parseEducationLines(lines: string[], education: EducationEntry[]) {
  let i = 0;
  while (i < lines.length && education.length < 5) {
    const line = lines[i];

    // Skip very short lines and bullet points
    if (line.length < 3 || line.startsWith("•") || line.startsWith("-")) {
      i++;
      continue;
    }

    // Look for a school name (usually a proper noun, length > 5)
    if (line.length > 5 && line.match(/university|college|school|institute|academy/i)) {
      const school = line;
      let degree = "";
      let honors = "";

      // Degree usually on next line
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.match(/bachelor|master|mba|b\.a|b\.s|m\.a|m\.s|ph\.d|degree|major|minor/i) || next.length < 80) {
          degree = next;
          i++;
        }
      }

      // Honors on the line after that
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.match(/honor|cum laude|distinction|gpa|dean/i)) {
          honors = next;
          i++;
        }
      }

      education.push({ school, degree, honors });
    } else if (line.match(/b\.a|b\.s|m\.a|m\.s|mba|ph\.d|bachelor|master/i) && education.length === 0) {
      // Degree mentioned before school name
      education.push({ school: "", degree: line, honors: "" });
    }

    i++;
  }
}
