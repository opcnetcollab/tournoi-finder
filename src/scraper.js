const API_BASE = "https://apiv2.fftt.com/api/tournament_requests";
const PAGE_SIZE = 50;
const HEADERS = {
  Accept: "application/json, text/plain, */*",
  Referer: "https://monclub.fftt.com/",
};

// ─── Public API ──────────────────────────────────────────────

/** Scrape tous les tournois FFTT entre deux dates.
 *  @param {{ startDate?: string, endDate?: string }} [opts]
 */
export async function scrape(opts = {}) {
  const { startDate, endDate } = defaultDateRange(opts);
  const raw = await fetchAll(startDate, endDate);
  return raw.map(mapTournament);
}

// ─── Date helpers ────────────────────────────────────────────

export function defaultDateRange({ startDate, endDate } = {}) {
  const now = new Date();
  if (!startDate) {
    const d = new Date(now);
    d.setDate(d.getDate() + 3);
    startDate = iso(d);
  }
  if (!endDate) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 6);
    endDate = iso(d);
  }
  return { startDate, endDate };
}

const iso = (d) => d.toISOString().slice(0, 10);

// ─── HTTP layer ──────────────────────────────────────────────

async function fetchPage(startDate, endDate, page) {
  const url = new URL(API_BASE);
  url.searchParams.set("startDate[after]", startDate);
  url.searchParams.set("endDate[before]", endDate);
  url.searchParams.set("order[startDate]", "asc");
  url.searchParams.set("page", page);
  url.searchParams.set("itemsPerPage", PAGE_SIZE);

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`FFTT API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function fetchAll(startDate, endDate) {
  const first = await fetchPage(startDate, endDate, 1);
  const total = first["hydra:totalItems"] ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);
  const items = [...(first["hydra:member"] ?? [])];

  // Fetch remaining pages in parallel
  const promises = [];
  for (let p = 2; p <= pages; p++) promises.push(fetchPage(startDate, endDate, p));
  const results = await Promise.all(promises);
  for (const r of results) items.push(...(r["hydra:member"] ?? []));

  return items;
}

// ─── Mapping ─────────────────────────────────────────────────

const TYPES = {
  I: "International", A: "National A", B: "National B",
  N: "National", R: "Régional", D: "Départemental", C: "Club",
};
const STATUTS = { 0: "Brouillon", 1: "Soumis", 2: "Validé", 3: "Refusé", 4: "Annulé" };
const JOURS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];

export function mapTournament(raw) {
  const address = raw.address ?? {};
  const postalCode = address.postalCode ?? null;

  return {
    external_id: raw.identifier ?? raw["@id"] ?? String(raw.id ?? ""),
    name: raw.name?.trim() ?? "",
    date_start: raw.startDate?.slice(0, 10) ?? null,
    date_end: raw.endDate?.slice(0, 10) ?? null,
    city: address.addressLocality?.trim() ?? null,
    department: deptFromPostal(postalCode),
    address: address.streetAddress?.trim() || null,
    club: raw.club?.name?.trim() || null,
    tournament_type: TYPES[raw.type] ?? raw.type ?? null,
    homologation: raw.identifier ?? null,
    statut: STATUTS[raw.status] ?? String(raw.status ?? ""),
    dotation: centimesToEuros(raw.endowment),
    contact: formatContacts(raw.contacts ?? []),
    reglement_url: raw.rules?.url ?? null,
    tableaux: mapTableaux(raw.tables ?? []),
    raw_data: raw,
  };
}

export function mapTableaux(tables) {
  return tables.map((t) => ({
    name: t.name?.trim() ?? "",
    jour: dayOfWeek(t.date),
    horaire: formatHoraire(t.time),
    prix: centimesToEuros(t.fee),
  }));
}

/** isoweekday: 1=lundi → 7=dimanche (same as Python isoweekday) */
function dayOfWeek(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  // getDay: 0=Sun, 1=Mon ... 6=Sat → convert to isoweekday - 1
  const day = d.getDay();
  return JOURS[day === 0 ? 6 : day - 1];
}

export function formatHoraire(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace("H", "h").replace(":", "h");
  return normalized.replace(/h00$/, "h").replace(/^(\d+)$/, "$1h");
}

export function formatContacts(contacts) {
  if (!contacts.length) return null;
  return contacts
    .map((c) => {
      const name = [c.givenName, c.familyName].filter(Boolean).join(" ");
      const parts = [name];
      if (c.email) parts.push(`<${c.email}>`);
      if (c.telephone) parts.push(`(${c.telephone})`);
      return parts.join(" ");
    })
    .join(", ");
}

export function deptFromPostal(code) {
  if (!code) return null;
  const s = String(code);
  return s.startsWith("97") || s.startsWith("98") ? s.slice(0, 3) : s.slice(0, 2);
}

export function centimesToEuros(val) {
  if (val == null) return null;
  return val / 100;
}
