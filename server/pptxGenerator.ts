
const __dir = path.resolve(process.cwd(), "server");
/**
 * Baseball Card PPTX Generator
 * Clones the master template and fills in candidate data
 * using XML manipulation to preserve all template styling
 */
import * as fs from "fs";
import * as path from "path";

import AdmZip from "adm-zip";
import type { ExperienceEntry, EducationEntry } from "./linkedin";


export interface CandidateData {
  name: string;
  title: string;
  company: string;
  location: string;
  companyLocation: string;
  companyType: string;
  companyDescription: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  photoPath?: string | null;
  logoPath?: string | null;
}

const MASTER_TEMPLATE = (() => {
  const { existsSync } = require("fs");
  for (const p of TEMPLATE_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return TEMPLATE_CANDIDATES[0]; // fallback
})();

function buildTitleXml(data: CandidateData): string {
  const lines = [data.name, data.title, data.company, data.location].filter(Boolean);
  // Build as a single paragraph with line breaks (matching original format)
  let inner = "";
  for (let i = 0; i < lines.length; i++) {
    inner += `<a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escXml(lines[i])}</a:t></a:r>`;
    if (i < lines.length - 1) {
      inner += `<a:br><a:rPr lang="en-US" dirty="0"/></a:br>`;
    }
  }
  return `<a:p>${inner}</a:p>`;
}

function buildCompanyXml(data: CandidateData): string {
  const parts: string[] = [];

  if (data.company) {
    parts.push(`<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escXml(data.company)}</a:t></a:r></a:p>`);
  }
  parts.push(`<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>`);

  if (data.companyType) {
    parts.push(`<a:p><a:r><a:rPr lang="en-US" b="0" u="none" dirty="0"/><a:t>${escXml(data.companyType)}</a:t></a:r></a:p>`);
    parts.push(`<a:p><a:endParaRPr lang="en-US" b="0" u="none" dirty="0"/></a:p>`);
  }

  if (data.companyDescription) {
    parts.push(
      `<a:p><a:r><a:rPr lang="en-US" b="0" i="1" u="none" dirty="0"/><a:t>${escXml(
        data.companyDescription
      )}</a:t></a:r></a:p>`
    );
  }

  return parts.join("");
}

function buildExperienceXml(experience: ExperienceEntry[]): string {
  if (!experience || experience.length === 0) {
    return `<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>`;
  }

  const parts: string[] = [];
  let lastCompany = "";

  for (let i = 0; i < experience.length; i++) {
    const entry = experience[i];
    const isSubRole = entry.isSubRole || (!entry.company && !!entry.title);
    const isNewCompany = !isSubRole && entry.company && entry.company !== lastCompany;

    if (isNewCompany && entry.company) {
      // Add spacer before new company (not for first entry)
      if (parts.length > 0) {
        parts.push(`<a:p><a:endParaRPr lang="en-US" sz="400" b="0" dirty="0"/></a:p>`);
      }
      lastCompany = entry.company;
      // Date + underlined company name
      parts.push(
        `<a:p><a:r><a:rPr lang="en-US" sz="1020" dirty="0"/><a:t>${escXml(entry.dateRange || "")}\t</a:t></a:r><a:r><a:rPr lang="en-US" sz="1020" u="sng" dirty="0"/><a:t>${escXml(entry.company)}</a:t></a:r></a:p>`
      );
      if (entry.title) {
        parts.push(
          `<a:p><a:r><a:rPr lang="en-US" sz="1020" b="0" dirty="0"/><a:t>\t${escXml(entry.title)}</a:t></a:r></a:p>`
        );
      }
    } else {
      // Sub-role or continuation line
      const prefix = entry.dateRange ? `${entry.dateRange}\t` : "\t";
      parts.push(
        `<a:p><a:r><a:rPr lang="en-US" sz="1020" b="0" dirty="0"/><a:t>${escXml(prefix)}${escXml(entry.title)}</a:t></a:r></a:p>`
      );
    }
  }

  return parts.join("");
}

function buildEducationXml(education: EducationEntry[]): string {
  const parts: string[] = [
    `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Education / Certifications</a:t></a:r></a:p>`,
    `<a:p><a:endParaRPr lang="en-US" b="0" u="none" dirty="0"/></a:p>`,
  ];

  if (!education || education.length === 0) {
    return parts.join("");
  }

  for (const edu of education) {
    if (edu.school) {
      parts.push(
        `<a:p><a:r><a:rPr lang="en-US" u="none" dirty="0"/><a:t>${escXml(edu.school)}</a:t></a:r></a:p>`
      );
    }
    if (edu.degree) {
      parts.push(
        `<a:p><a:r><a:rPr lang="en-US" b="0" u="none" dirty="0"/><a:t>${escXml(edu.degree)}</a:t></a:r></a:p>`
      );
    }
    if (edu.honors) {
      parts.push(
        `<a:p><a:r><a:rPr lang="en-US" b="0" i="1" u="none" dirty="0"/><a:t>${escXml(edu.honors)}</a:t></a:r></a:p>`
      );
    }
  }

  return parts.join("");
}

function escXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function generatePptx(data: CandidateData, outputPath: string): Promise<void> {
  // Read the master template
  const templateBuffer = fs.readFileSync(MASTER_TEMPLATE);
  const zip = new (AdmZip as any)(templateBuffer);

  // Get slide1.xml
  const slideEntry = zip.getEntry("ppt/slides/slide1.xml");
  if (!slideEntry) throw new Error("Could not find slide1.xml in master template");

  let slideXml = slideEntry.getData().toString("utf8");

  // Build replacement content for each placeholder
  const titleContent = buildTitleXml(data);
  const companyLocationContent = data.companyLocation
    ? `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escXml(data.companyLocation)}</a:t></a:r></a:p>`
    : `<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>`;
  const companyContent = buildCompanyXml(data);
  const experienceContent = buildExperienceXml(data.experience);
  const educationContent = buildEducationXml(data.education);

  // Replace placeholder content
  slideXml = replaceTextPlaceholder(slideXml, 'type="title"', titleContent);
  slideXml = replaceBodyPlaceholder(slideXml, 'idx="10"', companyLocationContent);
  slideXml = replaceBodyPlaceholder(slideXml, 'idx="11"', companyContent);
  slideXml = replaceBodyPlaceholder(slideXml, 'idx="12"', experienceContent);
  slideXml = replaceBodyPlaceholder(slideXml, 'idx="15"', educationContent);

  // Manage new image relationships
  const newRels: string[] = [];
  const relsEntry = zip.getEntry("ppt/slides/_rels/slide1.xml.rels");
  let relsXml = relsEntry ? relsEntry.getData().toString("utf8") : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;

  // Handle candidate headshot photo → rId2
  if (data.photoPath && fs.existsSync(data.photoPath)) {
    try {
      const photoData = fs.readFileSync(data.photoPath);
      const photoExt = path.extname(data.photoPath).toLowerCase().replace(".", "") || "jpeg";
      const mediaName = `image_photo_${Date.now()}.${photoExt}`;
      zip.addFile(`ppt/media/${mediaName}`, photoData);
      newRels.push(`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`);

      // Replace the picture placeholder sp element with a real pic element using rId2
      const picElement = `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Picture Placeholder 1"/><p:cNvPicPr><a:picLocks noGrp="1" noChangeAspect="1"/></p:cNvPicPr><p:nvPr><p:ph type="pic" sz="quarter" idx="14"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:srcRect l="4191" r="4191"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;

      // Remove the empty picture placeholder sp
      slideXml = slideXml.replace(
        /<p:sp>(?:(?!<p:sp>).)*?<p:ph type="pic" sz="quarter" idx="14"[^/]*\/>(?:(?!<\/p:sp>).)*?<\/p:sp>/s,
        picElement
      );
    } catch (err) {
      console.warn("Could not embed candidate photo:", err);
    }
  }

  // Handle company logo → rId3 (optional)
  if (data.logoPath && fs.existsSync(data.logoPath)) {
    try {
      const logoData = fs.readFileSync(data.logoPath);
      const logoExt = path.extname(data.logoPath).toLowerCase().replace(".", "") || "png";
      const mediaName = `image_logo_${Date.now()}.${logoExt}`;
      zip.addFile(`ppt/media/${mediaName}`, logoData);
      newRels.push(`<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`);

      // Add logo picture element to header area (top-right, matching Diez sample positions)
      const logoPicXml = `<p:pic><p:nvPicPr><p:cNvPr id="5" name="Company Logo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId3"/><a:srcRect l="2143" t="6487"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="7570295" y="486860"/><a:ext cx="1483485" cy="427540"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
      slideXml = slideXml.replace("</p:spTree>", logoPicXml + "</p:spTree>");
    } catch (err) {
      console.warn("Could not embed company logo:", err);
    }
  }

  // Update rels
  if (newRels.length > 0) {
    relsXml = relsXml.replace("</Relationships>", newRels.join("") + "</Relationships>");
    if (relsEntry) {
      zip.updateFile("ppt/slides/_rels/slide1.xml.rels", Buffer.from(relsXml, "utf8"));
    } else {
      zip.addFile("ppt/slides/_rels/slide1.xml.rels", Buffer.from(relsXml, "utf8"));
    }
  }

  // Update slide XML in zip
  zip.updateFile("ppt/slides/slide1.xml", Buffer.from(slideXml, "utf8"));

  // Write output file
  const outBuffer = zip.toBuffer();
  fs.writeFileSync(outputPath, outBuffer);
}

function replaceTextPlaceholder(xml: string, phAttr: string, newContent: string): string {
  const spRegex = new RegExp(
    `(<p:sp>(?:(?!<p:sp>).)*?<p:ph[^>]*${escapeRegex(phAttr)}[^>]*/>(?:(?!<\\/p:sp>).)*?<p:txBody>[^]*?<a:bodyPr[^/]*/?>(?:<a:lstStyle/>)?)((?:<a:p>[^]*?<\\/a:p>|<a:p\\/>)*?)(<\\/p:txBody>)`,
    "s"
  );

  return xml.replace(spRegex, (_match, before, _oldContent, after) => {
    return before + newContent + after;
  });
}

function replaceBodyPlaceholder(xml: string, idxAttr: string, newContent: string): string {
  return replaceTextPlaceholder(xml, idxAttr, newContent);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
