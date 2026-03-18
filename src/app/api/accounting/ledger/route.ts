import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch ledger information
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const loanId = searchParams.get('loanId');
    const customerId = searchParams.get('customerId');

    switch (action) {
      case 'account-ledger':
        return await getAccountLedger(accountId, startDate, endDate);
      case 'loan-ledger':
        return await getLoanLedger(loanId, startDate, endDate);
      case 'customer-ledger':
        return await getCustomerLedger(customerId, startDate, endDate);
      case 'general-ledger':
        return await getGeneralLedger(startDate, endDate);
      case 'sub-ledger':
        const subAccountCode = searchParams.get('subAccountCode');
        return await getSubLedger(subAccountCode, startDate, endDate);
      default:
        return await getGeneralLedger(startDate, endDate);
    }
  } catch (error) {
    console.error('Ledger API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ==================== HELPER FUNCTIONS ====================

async function getAccountLedger(accountId: string | null, startDate: string | null, endDate: string | null) {
  if (!accountId) {
    return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
  }

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  const account = await db.chartOfAccount.findUnique({
    where: { id: accountId },
    include: {
      parentAccount: true,
      subAccounts: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const lines = await db.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        entryDate: { gte: start, lte: end },
        isApproved: true,
      },
    },
    include: {
      journalEntry: {
        include: {
          lines: {
            where: { accountId: { not: accountId } },
            include: { account: true },
          },
        },
      },
    },
    orderBy: {
      journalEntry: {
        entryDate: 'asc',
      },
    },
  });

  // Calculate running balance
  let balance = account.openingBalance;
  const isDebitAccount = account.accountType === 'ASSET' || account.accountType === 'EXPENSE';

  const ledgerLines = lines.map((line) => {
    if (isDebitAccount) {
      balance += line.debitAmount - line.creditAmount;
    } else {
      balance += line.creditAmount - line.debitAmount;
    }

    return {
      date: line.journalEntry.entryDate,
      entryNumber: line.journalEntry.entryNumber,
      narration: line.journalEntry.narration,
      referenceType: line.journalEntry.referenceType,
      referenceId: line.journalEntry.referenceId,
      debit: line.debitAmount,
      credit: line.creditAmount,
      balance,
      contraAccounts: line.journalEntry.lines.map((l) => ({
        code: l.account.accountCode,
        name: l.account.accountName,
        amount: l.debitAmount || l.creditAmount,
      })),
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      account,
      period: { start, end },
      lines: ledgerLines,
      openingBalance: account.openingBalance,
      closingBalance: balance,
      totalDebits: lines.reduce((sum, l) => sum + l.debitAmount, 0),
      totalCredits: lines.reduce((sum, l) => sum + l.creditAmount, 0),
    },
  });
}

async function getLoanLedger(loanId: string | null, startDate: string | null, endDate: string | null) {
  if (!loanId) {
    return NextResponse.json({ error: 'Loan ID required' }, { status: 400 });
  }

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
  const end = endDate ? new Date(endDate) : new Date();

  const loan = await db.loanApplication.findUnique({
    where: { id: loanId },
    include: {
      customer: true,
      sessionForm: true,
    },
  });

  if (!loan) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  }

  // Get all journal entries for this loan
  const journalLines = await db.journalEntryLine.findMany({
    where: {
      loanId,
      journalEntry: {
        entryDate: { gte: start, lte: end },
        isApproved: true,
      },
    },
    include: {
      account: true,
      journalEntry: true,
    },
    orderBy: {
      journalEntry: {
        entryDate: 'asc',
      },
    },
  });

  // Group by transaction
  const transactions: Record<string, {
    date: Date;
    entryNumber: string;
    referenceType: string;
    narration: string;
    lines: Array<{
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
    }>;
  }> = {};

  for (const line of journalLines) {
    const entryId = line.journalEntryId;
    if (!transactions[entryId]) {
      transactions[entryId] = {
        date: line.journalEntry.entryDate,
        entryNumber: line.journalEntry.entryNumber,
        referenceType: line.journalEntry.referenceType || 'MANUAL',
        narration: line.journalEntry.narration || '',
        lines: [],
      };
    }
    transactions[entryId].lines.push({
      accountCode: line.account.accountCode,
      accountName: line.account.accountName,
      debit: line.debitAmount,
      credit: line.creditAmount,
    });
  }

  // Calculate outstanding balance
  const principalEntries = journalLines.filter((l) => l.account.accountCode === '1101');
  const outstandingPrincipal = principalEntries.reduce((sum, l) => sum + l.debitAmount - l.creditAmount, 0);

  return NextResponse.json({
    success: true,
    data: {
      loan,
      period: { start, end },
      transactions: Object.values(transactions),
      outstandingPrincipal,
      totalDisbursed: loan.disbursedAmount || 0,
    },
  });
}

async function getCustomerLedger(customerId: string | null, startDate: string | null, endDate: string | null) {
  if (!customerId) {
    return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
  }

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
  const end = endDate ? new Date(endDate) : new Date();

  const customer = await db.user.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Get all journal entries for this customer
  const journalLines = await db.journalEntryLine.findMany({
    where: {
      customerId,
      journalEntry: {
        entryDate: { gte: start, lte: end },
        isApproved: true,
      },
    },
    include: {
      account: true,
      journalEntry: true,
    },
    orderBy: {
      journalEntry: {
        entryDate: 'asc',
      },
    },
  });

  // Group by loan
  const byLoan: Record<string, {
    loanId: string;
    transactions: typeof journalLines;
    totalDebit: number;
    totalCredit: number;
  }> = {};

  for (const line of journalLines) {
    const loanId = line.loanId || 'general';
    if (!byLoan[loanId]) {
      byLoan[loanId] = {
        loanId,
        transactions: [],
        totalDebit: 0,
        totalCredit: 0,
      };
    }
    byLoan[loanId].transactions.push(line);
    byLoan[loanId].totalDebit += line.debitAmount;
    byLoan[loanId].totalCredit += line.creditAmount;
  }

  return NextResponse.json({
    success: true,
    data: {
      customer,
      period: { start, end },
      journalLines,
      byLoan,
      totalDebit: journalLines.reduce((sum, l) => sum + l.debitAmount, 0),
      totalCredit: journalLines.reduce((sum, l) => sum + l.creditAmount, 0),
    },
  });
}

async function getGeneralLedger(startDate: string | null, endDate: string | null) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  // Get all accounts with their balances
  const accounts = await db.chartOfAccount.findMany({
    where: { isActive: true },
    orderBy: { accountCode: 'asc' },
  });

  // Get journal entries for the period
  const journalEntries = await db.journalEntry.findMany({
    where: {
      entryDate: { gte: start, lte: end },
      isApproved: true,
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
    orderBy: { entryDate: 'asc' },
  });

  // Build general ledger by account
  const generalLedger: Record<string, {
    account: typeof accounts[0];
    openingBalance: number;
    transactions: Array<{
      date: Date;
      entryNumber: string;
      narration: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
  }> = {};

  for (const account of accounts) {
    generalLedger[account.id] = {
      account,
      openingBalance: account.openingBalance,
      transactions: [],
      closingBalance: account.openingBalance,
      totalDebit: 0,
      totalCredit: 0,
    };
  }

  // Process journal entries
  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      const ledger = generalLedger[line.accountId];
      if (ledger) {
        const isDebitAccount = ledger.account.accountType === 'ASSET' || ledger.account.accountType === 'EXPENSE';
        
        if (isDebitAccount) {
          ledger.closingBalance += line.debitAmount - line.creditAmount;
        } else {
          ledger.closingBalance += line.creditAmount - line.debitAmount;
        }

        ledger.totalDebit += line.debitAmount;
        ledger.totalCredit += line.creditAmount;

        ledger.transactions.push({
          date: entry.entryDate,
          entryNumber: entry.entryNumber,
          narration: entry.narration || '',
          debit: line.debitAmount,
          credit: line.creditAmount,
          balance: ledger.closingBalance,
        });
      }
    }
  }

  // Filter to only show accounts with transactions
  const activeLedgers = Object.values(generalLedger).filter(
    (l) => l.transactions.length > 0 || l.closingBalance !== l.openingBalance
  );

  return NextResponse.json({
    success: true,
    data: {
      period: { start, end },
      generalLedger: activeLedgers,
      totalAccounts: accounts.length,
      activeAccounts: activeLedgers.length,
    },
  });
}

async function getSubLedger(subAccountCode: string | null, startDate: string | null, endDate: string | null) {
  if (!subAccountCode) {
    return NextResponse.json({ error: 'Sub-account code required' }, { status: 400 });
  }

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  // Get parent account
  const parentAccount = await db.chartOfAccount.findFirst({
    where: {
      OR: [
        { accountCode: subAccountCode },
        { parentAccount: { accountCode: subAccountCode } },
      ],
    },
    include: {
      subAccounts: true,
      parentAccount: true,
    },
  });

  if (!parentAccount) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // Get all sub-accounts
  const subAccounts = await db.chartOfAccount.findMany({
    where: {
      parentAccountId: parentAccount.id,
    },
  });

  // Get journal lines for all sub-accounts
  const accountIds = [parentAccount.id, ...subAccounts.map((a) => a.id)];

  const journalLines = await db.journalEntryLine.findMany({
    where: {
      accountId: { in: accountIds },
      journalEntry: {
        entryDate: { gte: start, lte: end },
        isApproved: true,
      },
    },
    include: {
      account: true,
      journalEntry: true,
    },
    orderBy: {
      journalEntry: {
        entryDate: 'asc',
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      parentAccount,
      subAccounts,
      period: { start, end },
      journalLines,
      totalBalance: parentAccount.currentBalance,
    },
  });
}
