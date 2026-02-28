import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const employees = await prisma.employee.findMany();
  let created = 0;

  for (const emp of employees) {
    // Skip if this employee already has history records
    const existing = await prisma.payRateHistory.findFirst({
      where: { employeeId: emp.id },
    });
    if (existing) continue;

    await prisma.payRateHistory.create({
      data: {
        employeeId: emp.id,
        payRate: emp.payRate,
        effectiveDate: emp.createdAt,
      },
    });
    created++;
    console.log(`Created baseline history for ${emp.name || emp.code} @ $${emp.payRate}/hr (effective ${emp.createdAt.toISOString().split("T")[0]})`);
  }

  console.log(`\nDone. Created ${created} pay rate history records for ${employees.length} employees.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
