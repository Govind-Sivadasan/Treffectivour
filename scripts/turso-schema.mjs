import { createClient } from "@libsql/client/http";
import { config as loadEnv } from "dotenv";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

loadEnv();

const scriptDir = dirname(fileURLToPath(import.meta.url));

export function getTursoConfig() {
  const url =
    process.env.TURSO_DATABASE_URL ??
    (process.env.DATABASE_URL?.startsWith("libsql:") ? process.env.DATABASE_URL : null);
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    return { url, authToken };
  }

  return null;
}

function loadInitSql() {
  const sqlPath = join(scriptDir, "..", "prisma", "turso-init.sql");
  return readFileSync(sqlPath, "utf8");
}

function parseSqlScript(sql) {
  const statements = [];
  let current = "";

  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") || trimmed.length === 0) {
      continue;
    }

    current += `${line}\n`;
    if (trimmed.endsWith(";")) {
      statements.push(current.trim());
      current = "";
    }
  }

  return statements;
}

async function migratePunchSortOrder(client) {
  const punchTable = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Punch'"
  );
  if (punchTable.rows.length === 0) {
    return;
  }

  const columns = await client.execute('PRAGMA table_info("Punch")');
  const hasSortOrder = columns.rows.some((row) => {
    const name = row.name ?? row[1];
    return name === "sortOrder";
  });

  if (hasSortOrder) {
    return;
  }

  console.log('Turso migration — adding Punch.sortOrder…');
  await client.execute(
    'ALTER TABLE "Punch" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0'
  );
  await client.execute(
    'CREATE INDEX IF NOT EXISTS "Punch_dayRecordId_sortOrder_idx" ON "Punch"("dayRecordId", "sortOrder")'
  );
}

export async function ensureTursoSchema() {
  const turso = getTursoConfig();
  if (!turso) {
    return false;
  }

  const client = createClient(turso);
  const existing = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'"
  );

  if (existing.rows.length === 0) {
    console.log("Turso has no schema yet — creating tables…");
    const statements = parseSqlScript(loadInitSql());

    for (const statement of statements) {
      await client.execute(statement);
    }

    console.log(`Turso schema ready (${statements.length} statements).`);
  }

  await migratePunchSortOrder(client);
  return true;
}

async function main() {
  if (!getTursoConfig()) {
    console.log("Turso not configured (libsql DATABASE_URL + TURSO_AUTH_TOKEN). Skipping.");
    return;
  }

  await ensureTursoSchema();
  console.log("Turso schema is up to date.");
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
