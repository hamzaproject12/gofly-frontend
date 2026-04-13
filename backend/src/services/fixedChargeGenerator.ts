import type { PrismaClient } from '@prisma/client';

const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

export function formatYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function generateFixedChargesTestRun(
  prisma: PrismaClient,
  runAt: Date = new Date()
): Promise<{ created: number; runAt: string }> {
  const charges = await prisma.fixedCharge.findMany({
    where: { isActive: true },
  });

  let created = 0;
  const runAtIso = runAt.toISOString();

  for (const fc of charges) {
    await prisma.expense.create({
      data: {
        description: `[TEST CRON] ${fc.label} (${runAtIso})`,
        amount: fc.amount,
        date: runAt,
        type: `Charge fixe test — ${fc.category}`,
        programId: null,
        reservationId: null,
      },
    });
    created++;
  }

  return { created, runAt: runAtIso };
}

export async function generateFixedChargesForYearMonth(
  prisma: PrismaClient,
  yearMonth: string
): Promise<{ created: number; skipped: number; yearMonth: string }> {
  if (!YEAR_MONTH_RE.test(yearMonth)) {
    throw new Error('yearMonth invalide (attendu YYYY-MM)');
  }

  const charges = await prisma.fixedCharge.findMany({
    where: { isActive: true },
  });

  let created = 0;
  let skipped = 0;

  for (const fc of charges) {
    const exists = await prisma.fixedChargeOccurrence.findUnique({
      where: {
        fixedChargeId_yearMonth: { fixedChargeId: fc.id, yearMonth },
      },
    });
    if (exists) {
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const description = `[Charge fixe] ${fc.label} (${yearMonth})`;
      const expense = await tx.expense.create({
        data: {
          description,
          amount: fc.amount,
          date: new Date(`${yearMonth}-01T12:00:00.000Z`),
          type: `Charge fixe — ${fc.category}`,
          programId: null,
          reservationId: null,
        },
      });
      await tx.fixedChargeOccurrence.create({
        data: {
          fixedChargeId: fc.id,
          yearMonth,
          amount: fc.amount,
          expenseId: expense.id,
        },
      });
    });
    created++;
  }

  return { created, skipped, yearMonth };
}
