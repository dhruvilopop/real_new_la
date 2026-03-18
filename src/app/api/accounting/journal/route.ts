import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch journal entries
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const referenceType = searchParams.get('referenceType');
    const entryNumber = searchParams.get('entryNumber');
    const isAutoEntry = searchParams.get('isAutoEntry');

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      where.entryDate = {} as { gte?: Date; lte?: Date };
      if (startDate) (where.entryDate as { gte?: Date }).gte = new Date(startDate);
      if (endDate) (where.entryDate as { lte?: Date }).lte = new Date(endDate);
    }

    if (referenceType) {
      where.referenceType = referenceType;
    }

    if (entryNumber) {
      where.entryNumber = { contains: entryNumber };
    }

    if (isAutoEntry !== null && isAutoEntry !== undefined) {
      where.isAutoEntry = isAutoEntry === 'true';
    }

    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
        orderBy: { entryDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.journalEntry.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Journal entries fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Reverse a journal entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, entryId, reversedById } = body;

    if (action === 'reverse') {
      const originalEntry = await db.journalEntry.findUnique({
        where: { id: entryId },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      });

      if (!originalEntry) {
        return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
      }

      if (originalEntry.isReversed) {
        return NextResponse.json({ error: 'Entry already reversed' }, { status: 400 });
      }

      // Generate reversal entry number
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');

      const lastEntry = await db.journalEntry.findFirst({
        where: {
          entryNumber: {
            startsWith: `JE${year}${month}`,
          },
        },
        orderBy: { entryNumber: 'desc' },
      });

      let sequence = 1;
      if (lastEntry) {
        const lastSequence = parseInt(lastEntry.entryNumber.slice(-5));
        sequence = lastSequence + 1;
      }

      const reversalEntryNumber = `JE${year}${month}${sequence.toString().padStart(5, '0')}`;

      // Create reversal entry (swap debits and credits)
      const reversalEntry = await db.journalEntry.create({
        data: {
          entryNumber: reversalEntryNumber,
          entryDate: new Date(),
          referenceType: 'REVERSAL',
          referenceId: originalEntry.id,
          narration: `Reversal of ${originalEntry.entryNumber}`,
          totalDebit: originalEntry.totalCredit,
          totalCredit: originalEntry.totalDebit,
          isAutoEntry: false,
          isApproved: true,
          approvedById: reversedById,
          approvedAt: new Date(),
          createdById: reversedById,
          lines: {
            create: originalEntry.lines.map((line) => ({
              accountId: line.accountId,
              debitAmount: line.creditAmount,
              creditAmount: line.debitAmount,
              narration: `Reversal - ${line.narration || ''}`,
              loanId: line.loanId,
              customerId: line.customerId,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      });

      // Mark original as reversed
      await db.journalEntry.update({
        where: { id: entryId },
        data: {
          isReversed: true,
          reversedById,
          reversedAt: new Date(),
        },
      });

      // Update account balances (reverse the effect)
      for (const line of reversalEntry.lines) {
        const account = await db.chartOfAccount.findUnique({
          where: { id: line.accountId },
        });

        if (account) {
          const isDebitAccount = account.accountType === 'ASSET' || account.accountType === 'EXPENSE';
          const balanceChange = isDebitAccount
            ? line.debitAmount - line.creditAmount
            : line.creditAmount - line.debitAmount;

          await db.chartOfAccount.update({
            where: { id: line.accountId },
            data: {
              currentBalance: {
                increment: balanceChange,
              },
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: reversalEntry,
        message: 'Journal entry reversed successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Journal entry action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
