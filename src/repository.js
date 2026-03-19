/**
 * Upsert tournaments + tableaux into SQLite (node:sqlite compatible).
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {Array<object>} tournaments
 */
export function saveTournaments(db, tournaments) {
  const stats = { inserted: 0, updated: 0, errors: 0 };

  const upsertTournament = db.prepare(`
    INSERT INTO tournaments (
      external_id, name, date_start, date_end, city, department, address,
      club, tournament_type, homologation, statut, dotation, contact,
      reglement_url, raw_data, updated_at
    ) VALUES (
      $external_id, $name, $date_start, $date_end, $city, $department, $address,
      $club, $tournament_type, $homologation, $statut, $dotation, $contact,
      $reglement_url, $raw_data, datetime('now')
    )
    ON CONFLICT(external_id) DO UPDATE SET
      name=excluded.name, date_start=excluded.date_start, date_end=excluded.date_end,
      city=excluded.city, department=excluded.department, address=excluded.address,
      club=excluded.club, tournament_type=excluded.tournament_type,
      homologation=excluded.homologation, statut=excluded.statut,
      dotation=excluded.dotation, contact=excluded.contact,
      reglement_url=excluded.reglement_url, raw_data=excluded.raw_data,
      updated_at=datetime('now')
  `);

  const findExisting = db.prepare("SELECT id FROM tournaments WHERE external_id = $id");
  const deleteTableaux = db.prepare("DELETE FROM tableaux WHERE tournament_id = $tournament_id");

  const insertTableau = db.prepare(`
    INSERT INTO tableaux (tournament_id, name, jour, horaire, prix)
    VALUES ($tournament_id, $name, $jour, $horaire, $prix)
  `);

  db.exec("BEGIN");
  try {
    for (const t of tournaments) {
      try {
        const existing = findExisting.get({ $id: t.external_id });
        const { tableaux, raw_data, ...fields } = t;

        // Build named params with $ prefix for node:sqlite
        const params = {};
        for (const [k, v] of Object.entries(fields)) params[`$${k}`] = v ?? null;
        params.$raw_data = JSON.stringify(raw_data ?? {});

        upsertTournament.run(params);

        if (existing) stats.updated++;
        else stats.inserted++;

        const row = findExisting.get({ $id: t.external_id });
        const tournamentId = row.id;

        if (tableaux?.length) {
          deleteTableaux.run({ $tournament_id: tournamentId });
          for (const tab of tableaux) {
            insertTableau.run({
              $tournament_id: tournamentId,
              $name: tab.name ?? null,
              $jour: tab.jour ?? null,
              $horaire: tab.horaire ?? null,
              $prix: tab.prix ?? null,
            });
          }
        }
      } catch (err) {
        console.error(`[repo] Error saving ${t.external_id}: ${err.message}`);
        stats.errors++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return stats;
}
