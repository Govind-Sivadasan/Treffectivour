import { createClient } from "@libsql/client";
import { config as loadEnv } from "dotenv";
import { execSync } from "child_process";
import path from "path";

loadEnv();

export function getTursoConfig(): { url: string; authToken: string } | null {
  const url =
    process.env.TURSO_DATABASE_URL ??
    (process.env.DATABASE_URL?.startsWith("libsql:") ? process.env.DATABASE_URL : null);
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    return { url, authToken };
  }

  return null;
}

function prismaBin(): string {
  const ext = process.platform === "win32" ? ".cmd" : "";
  return path.join("node_modules", ".bin", `prisma${ext}`);
}

function generateCreateSql(): string {
  return execSync(
    `"${prismaBin()}" migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`,
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "file:./prisma/dev.db",
      },
    }
  );
}

function parseSqlScript(sql: string): string[] {
  const statements: string[] = [];
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

export async function ensureTursoSchema(): Promise<boolean> {
  const turso = getTursoConfig();
  if (!turso) {
    return false;
  }

  const client = createClient(turso);
  const existing = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'"
  );

  if (existing.rows.length > 0) {
    return true;
  }

  console.log("Turso has no schema yet — creating tables…");
  const statements = parseSqlScript(generateCreateSql());

  for (const statement of statements) {
    await client.execute(statement);
  }

  console.log(`Turso schema ready (${statements.length} statements).`);
  return true;
}
