import { describe, it, expect, beforeEach } from "vitest";
import { createDb } from "../src/db.js";
import { saveTournaments } from "../src/repository.js";

describe("saveTournaments", () => {
  let db;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  const makeTournament = (overrides = {}) => ({
    external_id: "TEST-001",
    name: "Tournoi Test",
    date_start: "2026-05-01",
    date_end: "2026-05-02",
    city: "Paris",
    department: "75",
    address: null,
    club: "Club Test",
    tournament_type: "National B",
    homologation: "TEST-001",
    statut: "Soumis",
    dotation: 3600,
    contact: "Jean <jean@test.com>",
    reglement_url: null,
    tableaux: [{ name: "A - moins de 800 pts", jour: "SAMEDI", horaire: "9h", prix: 8 }],
    raw_data: { id: 1 },
    ...overrides,
  });

  it("insère un nouveau tournoi", () => {
    const stats = saveTournaments(db, [makeTournament()]);
    expect(stats.inserted).toBe(1);
    expect(stats.errors).toBe(0);

    const row = db.prepare("SELECT * FROM tournaments WHERE external_id = ?").get("TEST-001");
    expect(row.name).toBe("Tournoi Test");
    expect(row.dotation).toBe(3600);

    const tabs = db.prepare("SELECT * FROM tableaux WHERE tournament_id = ?").all(row.id);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe("A - moins de 800 pts");
  });

  it("met à jour un tournoi existant (upsert)", () => {
    saveTournaments(db, [makeTournament()]);
    const stats = saveTournaments(db, [makeTournament({ name: "Tournoi Modifié", dotation: 5000 })]);

    expect(stats.updated).toBe(1);

    const row = db.prepare("SELECT * FROM tournaments WHERE external_id = ?").get("TEST-001");
    expect(row.name).toBe("Tournoi Modifié");
    expect(row.dotation).toBe(5000);
  });

  it("gère plusieurs tournois en batch", () => {
    const stats = saveTournaments(db, [
      makeTournament({ external_id: "A", name: "Tournoi A" }),
      makeTournament({ external_id: "B", name: "Tournoi B" }),
      makeTournament({ external_id: "C", name: "Tournoi C" }),
    ]);
    expect(stats.inserted).toBe(3);

    const count = db.prepare("SELECT COUNT(*) as n FROM tournaments").get();
    expect(count.n).toBe(3);
  });

  it("supprime et recrée les tableaux à chaque upsert", () => {
    saveTournaments(db, [makeTournament()]);

    // Second save with different tableaux
    saveTournaments(db, [
      makeTournament({
        tableaux: [
          { name: "X", jour: "DIMANCHE", horaire: "14h", prix: 10 },
          { name: "Y", jour: "DIMANCHE", horaire: "16h", prix: 12 },
        ],
      }),
    ]);

    const row = db.prepare("SELECT id FROM tournaments WHERE external_id = ?").get("TEST-001");
    const tabs = db.prepare("SELECT * FROM tableaux WHERE tournament_id = ?").all(row.id);
    expect(tabs).toHaveLength(2);
    expect(tabs.map((t) => t.name)).toEqual(["X", "Y"]);
  });
});
