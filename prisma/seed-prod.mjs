import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.log("No DATABASE_URL — skipping seed");
  process.exit(0);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Only seed if no users exist
  const count = await prisma.user.count();
  if (count > 0) {
    console.log(`${count} user(s) already exist — skipping seed`);
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 12);
  await prisma.user.create({
    data: { username: "admin", passwordHash, role: "ADMIN" },
  });

  await prisma.setting.upsert({
    where: { key: "companyName" },
    update: {},
    create: { key: "companyName", value: "My Company" },
  });

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  await prisma.registerReset.upsert({
    where: { weekStart: monday },
    update: {},
    create: { amount: 200, weekStart: monday },
  });

  console.log("Seeded default admin user (admin / admin123)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Seed error:", e.message);
    prisma.$disconnect();
  });
