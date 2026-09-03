import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureTursoSchema } from "../scripts/turso-schema.mjs";

function createSeedClient(): PrismaClient {
  const url =
    process.env.TURSO_DATABASE_URL ??
    (process.env.DATABASE_URL?.startsWith("libsql:") ? process.env.DATABASE_URL : null);
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require("@prisma/adapter-libsql") as typeof import("@prisma/adapter-libsql");
    return new PrismaClient({
      adapter: new PrismaLibSQL({ url, authToken }),
    });
  }

  return new PrismaClient();
}

const prisma = createSeedClient();

const TEAM_USERS = [
  { username: "adarsh", name: "Adarsh", email: "adarsh.vasudevan@trenser.com" },
  { username: "akash", name: "Akash", email: "akash.udayan@trenser.com" },
  { username: "aparna", name: "Aparna", email: "aparna.shaji@trenser.com" },
  { username: "ashik", name: "Ashik", email: "ashik.narayanankutty@trenser.com" },
  { username: "basil", name: "Basil", email: "basil.baby@trenser.com" },
  { username: "govind", name: "Govind", email: "govind.sivadasan@trenser.com" },
  { username: "jobin", name: "Jobin", email: "jobin.edison@trenser.com" },
  { username: "krishnendu", name: "Krishnendu", email: "krishnendu.gopi@trenser.com" },
  { username: "manoj", name: "Manoj", email: "manoj.p@trenser.com" },
  {
    username: "niyas",
    name: "Niyas",
    email: "niyasudheen.moithu@trenser.com",
    password: "niyas123",
  },
  { username: "sarath", name: "Sarath", email: "sarath.krishna@trenser.com" },
] as const;

function passwordFor(user: (typeof TEAM_USERS)[number]): string {
  return "password" in user && user.password ? user.password : `${user.username}123`;
}

async function main() {
  await ensureTursoSchema();

  const adminPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@treffectivour.local" },
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@treffectivour.local",
      name: "Admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  for (const member of TEAM_USERS) {
    const passwordHash = await bcrypt.hash(passwordFor(member), 12);
    await prisma.user.upsert({
      where: { email: member.email },
      update: { name: member.name, passwordHash },
      create: {
        email: member.email,
        name: member.name,
        passwordHash,
        role: "USER",
      },
    });
  }

  await prisma.specialDay.upsert({
    where: { date: "2026-09-05" },
    update: { name: "Onam", requiredHours: 3 },
    create: { date: "2026-09-05", name: "Onam", requiredHours: 3 },
  });

  console.log("Seeded admin: admin@treffectivour.local (admin123)");
  console.log("Seeded team users:");
  for (const member of TEAM_USERS) {
    console.log(`  ${member.email} → ${passwordFor(member)}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
