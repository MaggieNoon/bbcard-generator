import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { cards, type Card, type InsertCard } from "@shared/schema";
import { eq } from "drizzle-orm";

const sqlite = new Database("bbcards.db");
const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linkedin_url TEXT NOT NULL,
    name TEXT,
    title TEXT,
    company TEXT,
    location TEXT,
    company_location TEXT,
    company_type TEXT,
    company_description TEXT,
    experience TEXT,
    education TEXT,
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    pptx_path TEXT
  )
`);

export interface IStorage {
  createCard(data: Partial<InsertCard>): Card;
  getCard(id: number): Card | undefined;
  updateCard(id: number, data: Partial<Card>): Card | undefined;
  getAllCards(): Card[];
}

export const storage: IStorage = {
  createCard(data) {
    return db.insert(cards).values({ linkedinUrl: data.linkedinUrl || "", ...data }).returning().get();
  },
  getCard(id) {
    return db.select().from(cards).where(eq(cards.id, id)).get();
  },
  updateCard(id, data) {
    return db.update(cards).set(data).where(eq(cards.id, id)).returning().get();
  },
  getAllCards() {
    return db.select().from(cards).all();
  },
};
