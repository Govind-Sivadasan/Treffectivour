import { PrismaClient } from "@prisma/client";

function getTursoConfig(): { url: string; authToken: string } | null {
  const url =
    process.env.TURSO_DATABASE_URL ??
    (process.env.DATABASE_URL?.startsWith("libsql:")
      ? process.env.DATABASE_URL
      : null);
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    return { url, authToken };
  }

  return null;
}

function createTursoAdapter(url: string, authToken: string) {
  // Lazy load so local file-SQLite builds can skip Turso deps when unset.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSQL } = require("@prisma/adapter-libsql") as typeof import("@prisma/adapter-libsql");
  return new PrismaLibSQL({ url, authToken });
}

export function createPrismaClient(): PrismaClient {
  const turso = getTursoConfig();
  const log =
    process.env.NODE_ENV === "development" ? (["error", "warn"] as const) : (["error"] as const);

  if (turso) {
    return new PrismaClient({
      adapter: createTursoAdapter(turso.url, turso.authToken),
      log: [...log],
    });
  }

  return new PrismaClient({ log: [...log] });
}

export function isTursoDatabase(): boolean {
  return getTursoConfig() !== null;
}
