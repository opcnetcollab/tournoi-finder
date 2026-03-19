import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, "..", "data", "tournois.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tournaments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id    TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  date_start     TEXT,
  date_end       TEXT,
  city           TEXT,
  department     TEXT,
  address        TEXT,
  club           TEXT,
  tournament_type TEXT,
  homologation   TEXT,
  statut         TEXT,
  dotation       REAL,
  contact        TEXT,
  reglement_url  TEXT,
  raw_data       TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tableaux (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  jour          TEXT,
  horaire       TEXT,
  prix          REAL,
  vainqueur     TEXT,
  finaliste     TEXT,
  troisieme     TEXT,
  quatrieme     TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(date_start);
CREATE INDEX IF NOT EXISTS idx_tableaux_tournament ON tableaux(tournament_id);
`;

/** @param {string} [dbPath] */
export function createDb(dbPath = DEFAULT_PATH) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
