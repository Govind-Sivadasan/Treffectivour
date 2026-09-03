import { ensureTursoSchema, getTursoConfig } from "./turso-schema";

async function main() {
  if (!getTursoConfig()) {
    console.log("Turso not configured (libsql DATABASE_URL + TURSO_AUTH_TOKEN). Skipping.");
    return;
  }

  const ready = await ensureTursoSchema();
  if (ready) {
    console.log("Turso schema is up to date.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
