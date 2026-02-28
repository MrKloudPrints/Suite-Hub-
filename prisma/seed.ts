import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash },
  });

  const employeeHash = await bcrypt.hash("employee123", 12);
  await prisma.user.upsert({
    where: { username: "employee" },
    update: {},
    create: { username: "employee", passwordHash: employeeHash, role: "EMPLOYEE" },
  });

  await prisma.setting.upsert({
    where: { key: "companyName" },
    update: {},
    create: { key: "companyName", value: "My Company" },
  });

  // Seed initial register reset for current week
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

  console.log("Seeded admin (admin/admin123), employee (employee/employee123), and default settings");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
