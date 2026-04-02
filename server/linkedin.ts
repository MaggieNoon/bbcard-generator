/**
 * LinkedIn Profile Scraper
 * Uses public LinkedIn profile pages (no auth needed for public profiles)
 * Falls back to Proxycurl-style data extraction
 */
import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";



export interface ExperienceEntry {
  dateRange: string;
  company: string;
  title: string;
  isSubRole?: boolean;
}

export interface EducationEntry {
  school: string;
  degree: string;
  honors?: string;
}

export interface LinkedInProfile {
  name: string;
  title: string;
  company: string;
  location: string;
  companyLocation: string;
  companyType: string;
  companyDescription: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  photoUrl?: string;
}

// Headers to mimic a real browser
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

export async function scrapeLinkedIn(url: string): Promise<LinkedInProfile> {
  // Normalize LinkedIn URL
  const cleanUrl = url.split("?")[0].replace(/\/$/, "");

  try {
    const response = await axios.get(cleanUrl, {
      headers: HEADERS,
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);
    const profile = parseLinkedInPage($, response.data);
    return profile;
  } catch (err: any) {
    // If direct fetch fails (LinkedIn blocking), try to extract from JSON-LD
    throw new Error(
      `Unable to fetch LinkedIn profile. LinkedIn may require authentication for this profile. Please use the manual data entry option. (${err.message})`
    );
  }
}

function parseLinkedInPage($: cheerio.CheerioAPI, html: string): LinkedInProfile {
  // Try to extract from JSON-LD structured data
  let name = "";
  let title = "";
  let company = "";
  let location = "";
  let photoUrl = "";

  // JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      if (json["@type"] === "Person") {
        name = name || json.name || "";
        title = title || json.jobTitle || "";
        company = company || (json.worksFor && json.worksFor[0]?.name) || "";
        location = location || json.address?.addressLocality || "";
        photoUrl = photoUrl || json.image || "";
      }
    } catch {}
  });

  // Open Graph fallback
  if (!name) name = $('meta[property="og:title"]').attr("content") || "";
  if (!title) title = $('meta[name="description"]').attr("content")?.split(" | ")[0] || "";

  // Try standard LinkedIn selectors
  if (!name) name = $(".top-card-layout__title").text().trim();
  if (!title) title = $(".top-card-layout__headline").text().trim();
  if (!location) location = $(".top-card-layout__first-subline .not-first-middot").first().text().trim();
  if (!photoUrl) photoUrl = $(".top-card__profile-image").attr("src") || "";

  // Experience section
  const experience: ExperienceEntry[] = [];
  $("section.experience-section li, .experience__list li, ul.experience__list > li").each((_, el) => {
    const dateRange = $(el).find("span.date-range, .experience-item__duration").text().trim();
    const companyName = $(el).find("span.experience-item__subtitle, .experience-item__company-name").text().trim();
    const roleTitle = $(el).find("h3, .experience-item__title").text().trim();
    if (companyName || roleTitle) {
      experience.push({ dateRange, company: companyName, title: roleTitle });
    }
  });

  // Education
  const education: EducationEntry[] = [];
  $("section.education-section li, .education__list li").each((_, el) => {
    const school = $(el).find("h3, .education__school-name").text().trim();
    const degree = $(el).find(".education__item--degree-info, span.education__item").text().trim();
    if (school) {
      education.push({ school, degree });
    }
  });

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
    photoUrl,
  };
}

export async function downloadPhoto(photoUrl: string, destDir: string): Promise<string | null> {
  if (!photoUrl) return null;
  try {
    const response = await axios.get(photoUrl, {
      headers: HEADERS,
      responseType: "arraybuffer",
      timeout: 10000,
    });
    const filename = `photo_${Date.now()}.jpg`;
    const destPath = path.join(destDir, filename);
    fs.writeFileSync(destPath, response.data);
    return destPath;
  } catch {
    return null;
  }
}
