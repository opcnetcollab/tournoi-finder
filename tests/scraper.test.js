import { describe, it, expect } from "vitest";
import {
  formatHoraire,
  centimesToEuros,
  deptFromPostal,
  formatContacts,
  mapTableaux,
  mapTournament,
} from "../src/scraper.js";

// ─── formatHoraire ───────────────────────────────────────────

describe("formatHoraire", () => {
  it("normalise 9h30", () => expect(formatHoraire("9h30")).toBe("9h30"));
  it("normalise 14:00", () => expect(formatHoraire("14:00")).toBe("14h"));
  it("normalise 9H00", () => expect(formatHoraire("9H00")).toBe("9h"));
  it("normalise nombre seul", () => expect(formatHoraire("10")).toBe("10h"));
  it("retourne null si vide", () => expect(formatHoraire("")).toBeNull());
  it("retourne null si null", () => expect(formatHoraire(null)).toBeNull());
});

// ─── centimesToEuros ─────────────────────────────────────────

describe("centimesToEuros", () => {
  it("convertit 800 → 8", () => expect(centimesToEuros(800)).toBe(8));
  it("convertit 1050 → 10.5", () => expect(centimesToEuros(1050)).toBe(10.5));
  it("convertit 0 → 0", () => expect(centimesToEuros(0)).toBe(0));
  it("retourne null si null", () => expect(centimesToEuros(null)).toBeNull());
});

// ─── deptFromPostal ──────────────────────────────────────────

describe("deptFromPostal", () => {
  it("extrait 76 de 76140", () => expect(deptFromPostal("76140")).toBe("76"));
  it("extrait 971 de 97100", () => expect(deptFromPostal("97100")).toBe("971"));
  it("extrait 974 de 97400", () => expect(deptFromPostal("97400")).toBe("974"));
  it("retourne null si null", () => expect(deptFromPostal(null)).toBeNull());
});

// ─── formatContacts ──────────────────────────────────────────

describe("formatContacts", () => {
  it("formate un contact complet", () => {
    const result = formatContacts([
      { givenName: "Jade", familyName: "LOMBARD", email: "jade@test.com", telephone: "0600000000" },
    ]);
    expect(result).toBe("Jade LOMBARD <jade@test.com> (0600000000)");
  });

  it("gère plusieurs contacts", () => {
    const result = formatContacts([
      { givenName: "A", familyName: "B", email: "a@b.com" },
      { givenName: "C", familyName: "D", telephone: "06" },
    ]);
    expect(result).toBe("A B <a@b.com>, C D (06)");
  });

  it("retourne null si vide", () => expect(formatContacts([])).toBeNull());
});

// ─── mapTableaux ─────────────────────────────────────────────

describe("mapTableaux", () => {
  it("mappe un tableau avec date samedi", () => {
    // 2026-04-25 is a Saturday
    const result = mapTableaux([{ name: "A", date: "2026-04-25T00:00:00", time: "9h", fee: 800 }]);
    expect(result).toEqual([{ name: "A", jour: "SAMEDI", horaire: "9h", prix: 8 }]);
  });

  it("mappe un tableau avec date dimanche", () => {
    // 2026-04-26 is a Sunday
    const result = mapTableaux([{ name: "B", date: "2026-04-26T00:00:00", time: "14h", fee: 1000 }]);
    expect(result).toEqual([{ name: "B", jour: "DIMANCHE", horaire: "14h", prix: 10 }]);
  });

  it("gère un tableau vide", () => {
    expect(mapTableaux([])).toEqual([]);
  });
});

// ─── mapTournament (structure réelle API FFTT) ───────────────

describe("mapTournament", () => {
  const RAW = {
    id: 42,
    identifier: "2399/2025-B",
    name: "5e TOURNOI NATIONAL B",
    startDate: "2026-04-25T00:00:00+02:00",
    endDate: "2026-04-26T00:00:00+02:00",
    address: {
      addressLocality: "Petit-Quevilly",
      postalCode: "76140",
      streetAddress: "69 rue Martial Spinneweber",
    },
    club: { name: "CP QUEVILLAIS" },
    type: "B",
    status: 1,
    endowment: 360000,
    contacts: [{ givenName: "Jade", familyName: "LOMBARD", email: "jade@test.com", telephone: "06" }],
    rules: { url: "https://example.com/rules.pdf" },
    tables: [{ name: "A - moins de 800 pts", date: "2026-04-25T00:00:00", time: "9h", fee: 800 }],
  };

  it("mappe tous les champs", () => {
    const t = mapTournament(RAW);
    expect(t.external_id).toBe("2399/2025-B");
    expect(t.name).toBe("5e TOURNOI NATIONAL B");
    expect(t.date_start).toBe("2026-04-25");
    expect(t.date_end).toBe("2026-04-26");
    expect(t.city).toBe("Petit-Quevilly");
    expect(t.department).toBe("76");
    expect(t.address).toBe("69 rue Martial Spinneweber");
    expect(t.club).toBe("CP QUEVILLAIS");
    expect(t.tournament_type).toBe("National B");
    expect(t.statut).toBe("Soumis");
    expect(t.dotation).toBe(3600);
    expect(t.contact).toContain("Jade LOMBARD");
    expect(t.contact).toContain("<jade@test.com>");
    expect(t.contact).toContain("(06)");
    expect(t.reglement_url).toBe("https://example.com/rules.pdf");
    expect(t.tableaux).toHaveLength(1);
    expect(t.tableaux[0].jour).toBe("SAMEDI");
  });

  it("gère les champs manquants", () => {
    const t = mapTournament({ id: 1 });
    expect(t.external_id).toBe("1");
    expect(t.name).toBe("");
    expect(t.city).toBeNull();
    expect(t.department).toBeNull();
    expect(t.tableaux).toEqual([]);
  });
});
