import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch bank accounts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'list':
        return await getBankAccounts();
      case 'transactions':
        const accountId = searchParams.get('accountId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        return await getBankTransactions(accountId, startDate, endDate);
      case 'summary':
        return await getBankSummary();
      default:
        return await getBankAccounts();
    }
  } catch (error) {
    console.error('Bank API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create bank account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bankName,
      accountNumber,
      accountName,
      branchName,
      ifscCode,
      accountType,
      openingBalance,
      isDefault,
    } = body;

    // If this is default, unset other defaults
    if (isDefault) {
      await db.bankAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const bankAccount = await db.bankAccount.create({
      data: {
        bankName,
        accountNumber,
        accountName,
        branchName,
        ifscCode,
        accountType,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
        isDefault: isDefault || false,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: bankAccount,
      message: 'Bank account created successfully',
    });
  } catch (error) {
    console.error('Bank account creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update bank account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, action, data } = body;

    if (action === 'update') {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await db.bankAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const bankAccount = await db.bankAccount.update({
        where: { id: accountId },
        data,
      });

      return NextResponse.json({
        success: true,
        data: bankAccount,
        message: 'Bank account updated successfully',
      });
    }

    if (action === 'adjust-balance') {
      const { amount, reason } = data;
      
      const bankAccount = await db.bankAccount.update({
        where: { id: accountId },
        data: {
          currentBalance: {
            increment: amount,
          },
        },
      });

      // Log adjustment
      // Could create a journal entry here for audit

      return NextResponse.json({
        success: true,
        data: bankAccount,
        message: 'Balance adjusted successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Bank account update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Deactivate bank account
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    const bankAccount = await db.bankAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      data: bankAccount,
      message: 'Bank account deactivated successfully',
    });
  } catch (error) {
    console.error('Bank account deactivation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ==================== HELPER FUNCTIONS ====================

async function getBankAccounts() {
  const accounts = await db.bankAccount.findMany({
    where: { isActive: true },
    orderBy: { isDefault: 'desc' },
  });

  return NextResponse.json({
    success: true,
    data: accounts,
  });
}

async function getBankTransactions(accountId: string | null, startDate: string | null, endDate: string | null) {
  if (!accountId) {
    return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
  }

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  const bankAccount = await db.bankAccount.findUnique({
    where: { id: accountId },
  });

  if (!bankAccount) {
    return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
  }

  // Get journal entries involving this bank account
  // We'll get transactions from journal entries where bank account code is 1201
  const transactions = await db.journalEntryLine.findMany({
    where: {
      account: {
        accountCode: '1201', // Bank Account code
      },
      journalEntry: {
        entryDate: { gte: start, lte: end },
        isApproved: true,
      },
    },
    include: {
      journalEntry: true,
    },
    orderBy: {
      journalEntry: {
        entryDate: 'desc',
      },
    },
  });

  // Calculate running balance
  let balance = bankAccount.openingBalance;
  const formattedTransactions = transactions.map((t) => {
    balance += t.debitAmount - t.creditAmount;
    return {
      date: t.journalEntry.entryDate,
      entryNumber: t.journalEntry.entryNumber,
      narration: t.journalEntry.narration,
      referenceType: t.journalEntry.referenceType,
      debit: t.debitAmount,
      credit: t.creditAmount,
      balance,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      account: bankAccount,
      transactions: formattedTransactions,
      openingBalance: bankAccount.openingBalance,
      closingBalance: balance,
      totalDebits: transactions.reduce((sum, t) => sum + t.debitAmount, 0),
      totalCredits: transactions.reduce((sum, t) => sum + t.creditAmount, 0),
    },
  });
}

async function getBankSummary() {
  const accounts = await db.bankAccount.findMany({
    where: { isActive: true },
  });

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  // Get this month's transactions
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const thisMonthTransactions = await db.journalEntryLine.findMany({
    where: {
      account: {
        accountCode: '1201',
      },
      journalEntry: {
        entryDate: { gte: thisMonth },
        isApproved: true,
      },
    },
  });

  const totalInflow = thisMonthTransactions.reduce((sum, t) => sum + t.debitAmount, 0);
  const totalOutflow = thisMonthTransactions.reduce((sum, t) => sum + t.creditAmount, 0);

  return NextResponse.json({
    success: true,
    data: {
      accounts,
      totalBalance,
      thisMonth: {
        inflow: totalInflow,
        outflow: totalOutflow,
        netFlow: totalInflow - totalOutflow,
      },
    },
  });
}
