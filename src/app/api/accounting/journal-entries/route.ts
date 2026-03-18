import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AccountingService } from '@/lib/accounting-service';

// GET - Fetch journal entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const referenceType = searchParams.get('referenceType');
    const accountId = searchParams.get('accountId');
    const loanId = searchParams.get('loanId');
    const customerId = searchParams.get('customerId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = { 
      companyId,
      isReversed: false,
    };

    if (startDate && endDate) {
      where.entryDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (referenceType && referenceType !== 'all') {
      where.referenceType = referenceType;
    }

    // If filtering by account, loan, or customer
    if (accountId || loanId || customerId) {
      where.lines = { some: {} };
      if (accountId) where.lines.some.accountId = accountId;
      if (loanId) where.lines.some.loanId = loanId;
      if (customerId) where.lines.some.customerId = customerId;
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
        take: limit,
        skip: offset,
      }),
      db.journalEntry.count({ where }),
    ]);

    return NextResponse.json({ entries, total });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}

// POST - Create manual journal entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      companyId,
      entryDate,
      narration,
      lines,
      referenceType = 'MANUAL_ENTRY',
      paymentMode,
      bankAccountId,
      chequeNumber,
      bankRefNumber,
      createdById,
    } = body;

    // Validate double-entry
    const totalDebit = lines.reduce((sum: number, line: any) => sum + (line.debitAmount || 0), 0);
    const totalCredit = lines.reduce((sum: number, line: any) => sum + (line.creditAmount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ 
        error: `Journal entry not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}` 
      }, { status: 400 });
    }

    if (lines.length < 2) {
      return NextResponse.json({ error: 'At least 2 lines required for double-entry' }, { status: 400 });
    }

    // Generate entry number
    const count = await db.journalEntry.count({
      where: { companyId: companyId || 'default' },
    });
    const entryNumber = `JE${String(count + 1).padStart(6, '0')}`;

    // Get financial year
    const accService = new AccountingService(companyId || 'default');
    const financialYearId = await accService.getCurrentFinancialYear();

    // Create journal entry with lines in transaction
    const journalEntry = await db.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          companyId: companyId || 'default',
          entryNumber,
          entryDate: new Date(entryDate),
          referenceType,
          narration,
          totalDebit,
          totalCredit,
          isAutoEntry: false,
          isApproved: true,
          createdById,
          paymentMode,
          bankAccountId,
          chequeNumber,
          bankRefNumber,
        },
      });

      // Create lines and update balances
      for (const line of lines) {
        const journalLine = await tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: line.accountId,
            debitAmount: line.debitAmount || 0,
            creditAmount: line.creditAmount || 0,
            narration: line.narration,
            loanId: line.loanId,
            customerId: line.customerId,
          },
        });

        // Update account balance
        const account = await tx.chartOfAccount.findUnique({
          where: { id: line.accountId },
        });

        if (account) {
          let balanceChange = 0;
          if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
            balanceChange = (line.debitAmount || 0) - (line.creditAmount || 0);
          } else {
            balanceChange = (line.creditAmount || 0) - (line.debitAmount || 0);
          }

          await tx.chartOfAccount.update({
            where: { id: line.accountId },
            data: {
              currentBalance: account.currentBalance + balanceChange,
            },
          });

          // Update ledger balance
          const ledgerBalance = await tx.ledgerBalance.findUnique({
            where: {
              accountId_financialYearId: {
                accountId: line.accountId,
                financialYearId,
              },
            },
          });

          if (ledgerBalance) {
            await tx.ledgerBalance.update({
              where: { id: ledgerBalance.id },
              data: {
                totalDebits: ledgerBalance.totalDebits + (line.debitAmount || 0),
                totalCredits: ledgerBalance.totalCredits + (line.creditAmount || 0),
                closingBalance: ledgerBalance.closingBalance + balanceChange,
              },
            });
          } else {
            await tx.ledgerBalance.create({
              data: {
                accountId: line.accountId,
                financialYearId,
                openingBalance: 0,
                totalDebits: line.debitAmount || 0,
                totalCredits: line.creditAmount || 0,
                closingBalance: balanceChange,
              },
            });
          }
        }
      }

      return entry;
    });

    return NextResponse.json({ journalEntry });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}

// PUT - Reverse journal entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, reversedById, reason } = body;

    const originalEntry = await db.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } } },
    });

    if (!originalEntry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (originalEntry.isReversed) {
      return NextResponse.json({ error: 'Entry already reversed' }, { status: 400 });
    }

    // Create reversal entry
    const companyId = originalEntry.companyId;
    const count = await db.journalEntry.count({ where: { companyId } });
    const entryNumber = `JE${String(count + 1).padStart(6, '0')}`;

    const accService = new AccountingService(companyId);
    const financialYearId = await accService.getCurrentFinancialYear();

    const reversalEntry = await db.$transaction(async (tx) => {
      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id },
        data: {
          isReversed: true,
          reversedById,
          reversedAt: new Date(),
        },
      });

      // Create reversal entry
      const reversal = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: new Date(),
          referenceType: 'MANUAL_ENTRY',
          narration: `REVERSAL: ${originalEntry.narration}. Reason: ${reason || 'Not specified'}`,
          totalDebit: originalEntry.totalCredit,
          totalCredit: originalEntry.totalDebit,
          isAutoEntry: false,
          isApproved: true,
          createdById: reversedById,
        },
      });

      // Create reversal lines (swap debit/credit)
      for (const line of originalEntry.lines) {
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: reversal.id,
            accountId: line.accountId,
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            narration: `Reversal of ${originalEntry.entryNumber}`,
            loanId: line.loanId,
            customerId: line.customerId,
          },
        });

        // Reverse the balance changes
        const account = line.account;
        if (account) {
          let balanceChange = 0;
          if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
            balanceChange = line.creditAmount - line.debitAmount;
          } else {
            balanceChange = line.debitAmount - line.creditAmount;
          }

          await tx.chartOfAccount.update({
            where: { id: line.accountId },
            data: {
              currentBalance: account.currentBalance + balanceChange,
            },
          });

          // Update ledger balance
          await tx.ledgerBalance.updateMany({
            where: {
              accountId: line.accountId,
              financialYearId,
            },
            data: {
              totalDebits: { increment: line.creditAmount },
              totalCredits: { increment: line.debitAmount },
            },
          });
        }
      }

      return reversal;
    });

    return NextResponse.json({ reversalEntry });
  } catch (error) {
    console.error('Error reversing journal entry:', error);
    return NextResponse.json({ error: 'Failed to reverse journal entry' }, { status: 500 });
  }
}

// DELETE - Delete journal entry (only for manual, unapproved entries)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Journal entry ID required' }, { status: 400 });
    }

    const entry = await db.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } } },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    // Can only delete manual entries that are not approved
    if (entry.isAutoEntry) {
      return NextResponse.json({ error: 'Cannot delete auto-generated entries. Use reversal instead.' }, { status: 400 });
    }

    if (entry.isApproved) {
      return NextResponse.json({ error: 'Cannot delete approved entries. Use reversal instead.' }, { status: 400 });
    }

    if (entry.isReversed) {
      return NextResponse.json({ error: 'Cannot delete reversed entries' }, { status: 400 });
    }

    // Delete entry and reverse balance changes
    await db.$transaction(async (tx) => {
      // Reverse balance changes for each line
      for (const line of entry.lines) {
        const account = line.account;
        if (account) {
          let balanceChange = 0;
          if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
            balanceChange = line.creditAmount - line.debitAmount;
          } else {
            balanceChange = line.debitAmount - line.creditAmount;
          }

          await tx.chartOfAccount.update({
            where: { id: line.accountId },
            data: {
              currentBalance: account.currentBalance + balanceChange,
            },
          });
        }
      }

      // Delete lines first
      await tx.journalEntryLine.deleteMany({
        where: { journalEntryId: id },
      });

      // Delete entry
      await tx.journalEntry.delete({
        where: { id },
      });
    });

    return NextResponse.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 });
  }
}
