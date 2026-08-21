import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  const userPassword = await bcrypt.hash("user123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@treffectivour.local" },
    update: {},
    create: {
      email: "admin@treffectivour.local",
      name: "Admin",
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@treffectivour.local" },
    update: {},
    create: {
      email: "user@treffectivour.local",
      name: "Demo User",
      passwordHash: userPassword,
      role: Role.USER,
    },
  });

  await prisma.specialDay.deleteMany({ where: { date: "2026-08-21" } });
  await prisma.specialDay.upsert({
    where: { date: "2026-09-05" },
    update: { name: "Onam", requiredHours: 3 },
    create: { date: "2026-09-05", name: "Onam", requiredHours: 3 },
  });

  console.log("Seeded:", { admin: admin.email, user: user.email });
  console.log("Default passwords: admin123 / user123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
