import { createDb } from "./db.js";
import { scrape } from "./scraper.js";
import { saveTournaments } from "./repository.js";

async function main() {
  console.log("[main] Démarrage du scraping FFTT…");

  const tournaments = await scrape();
  console.log(`[main] ${tournaments.length} tournois récupérés depuis l'API`);

  const db = createDb();
  const stats = saveTournaments(db, tournaments);
  db.close();

  console.log(`[main] Terminé — ${stats.inserted} insérés, ${stats.updated} mis à jour, ${stats.errors} erreurs`);
}

main().catch((err) => {
  console.error("[main] Erreur fatale:", err);
  process.exit(1);
});
