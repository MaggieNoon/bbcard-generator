import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  linkedinUrl: text("linkedin_url").notNull(),
  name: text("name"),
  title: text("title"),
  company: text("company"),
  location: text("location"),
  companyLocation: text("company_location"),
  companyType: text("company_type"),
  companyDescription: text("company_description"),
  experience: text("experience"), // JSON
  education: text("education"),   // JSON
  photoUrl: text("photo_url"),
  status: text("status").notNull().default("pending"), // pending | processing | done | error
  errorMessage: text("error_message"),
  pptxPath: text("pptx_path"),
});

export const insertCardSchema = createInsertSchema(cards).omit({ id: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;
