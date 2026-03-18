import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AccountType } from '@prisma/client';
import { 
  getTrialBalance, 
  getProfitAndLoss, 
  getBalanceSheet,
  initializeChartOfAccounts,
} from '@/lib/accounting';

// GET - Fetch accounting overview data
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const companyId = searchParams.get('companyId') || 'default';

    switch (action) {
      case 'overview':
        return await getOverview(companyId);
      case 'trial-balance':
        return await getTrialBalanceHandler(companyId);
      case 'chart-of-accounts':
        return await getChartOfAccounts(companyId);
      case 'account-ledger':
        const accountId = searchParams.get('accountId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        return await getAccountLedger(accountId, startDate, endDate, companyId);
      case 'receivables-aging':
        return await getReceivablesAging(companyId);
      case 'profit-loss':
        const plStart = searchParams.get('startDate');
        const plEnd = searchParams.get('endDate');
        return await getProfitLossHandler(companyId, plStart, plEnd);
      case 'balance-sheet':
        const bsDate = searchParams.get('asOfDate');
        return await getBalanceSheetHandler(companyId, bsDate);
      case 'cash-flow':
        const cfStart = searchParams.get('startDate');
        const cfEnd = searchParams.get('endDate');
        return await getCashFlowHandler(companyId, cfStart, cfEnd);
      case 'initialize':
        return await initializeAccounting(companyId);
      case 'settings':
        return await getAccountingSettings(companyId);
      default:
        return await getOverview(companyId);
    }
  } catch (error) {
    console.error('Accounting API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create manual journal entry or initialize
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, companyId, data } = body;

    switch (type) {
      case 'initialize':
        return await initializeAccounting(companyId || 'default');
      case 'update-settings':
        return await updateAccountingSettings(companyId, data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Accounting POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update account or settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case 'update-account':
        return await updateAccount(data);
      case 'update-settings':
        const { companyId } = body;
        return await updateAccountingSettings(companyId, data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Accounting PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ==================== HELPER FUNCTIONS ====================

async function getOverview(companyId: string) {
  const isMultiCompany = !companyId || companyId === 'all';
  
  // Build where clause
  const accountWhere = { isActive: true, ...(isMultiCompany ? {} : { companyId }) };
  const journalWhere = { ...(isMultiCompany ? {} : { companyId }) };
  
  // Get current financial year
  const currentYear = await db.financialYear.findFirst({
    where: { 
      isClosed: false,
      ...(isMultiCompany ? {} : { companyId })
    },
    orderBy: { startDate: 'desc' },
  });

  // Get account balances by type
  const accounts = await db.chartOfAccount.findMany({
    where: accountWhere,
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      currentBalance: true,
      companyId: true,
    },
  });

  // Calculate totals by type
  const totalsByType: Record<AccountType, number> = {
    ASSET: 0,
    LIABILITY: 0,
    INCOME: 0,
    EXPENSE: 0,
    EQUITY: 0,
  };

  accounts.forEach((account) => {
    totalsByType[account.accountType] += account.currentBalance;
  });

  // Get recent journal entries
  const recentEntries = await db.journalEntry.findMany({
    where: journalWhere,
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
      company: {
        select: { id: true, name: true, code: true }
      }
    },
  });

  // Get total loan outstanding
  const totalLoanOutstanding = totalsByType.ASSET > 0 
    ? accounts.filter(a => a.accountCode === '1000').reduce((sum, a) => sum + a.currentBalance, 0) 
    : 0;

  // Get bank balance
  const bankAccount = await db.bankAccount.findFirst({
    where: { 
      isDefault: true,
      ...(isMultiCompany ? {} : { companyId })
    },
  });

  // Get income and expense totals
  const totalIncome = totalsByType.INCOME;
  const totalExpenses = totalsByType.EXPENSE;
  const netProfit = totalIncome - totalExpenses;

  // Get journal entry counts
  const totalJournalEntries = await db.journalEntry.count({ where: journalWhere });
  const todayEntries = await db.journalEntry.count({
    where: {
      ...journalWhere,
      entryDate: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  // Multi-company aggregation
  let companyBreakdown: Array<{
    id: string;
    name: string;
    code: string;
    totals: Record<string, number>;
    netProfit: number;
    totalAssets: number;
  }> | null = null;
  
  if (isMultiCompany) {
    const companies = await db.company.findMany({
      where: { isActive: true },
      include: {
        chartOfAccounts: {
          where: { isActive: true },
          select: { accountType: true, currentBalance: true }
        }
      }
    });
    
    companyBreakdown = companies.map(company => {
      const totals: Record<string, number> = {
        ASSET: 0, LIABILITY: 0, INCOME: 0, EXPENSE: 0, EQUITY: 0
      };
      company.chartOfAccounts.forEach(acc => {
        totals[acc.accountType] += acc.currentBalance;
      });
      return {
        id: company.id,
        name: company.name,
        code: company.code,
        totals,
        netProfit: totals.INCOME - totals.EXPENSE,
        totalAssets: totals.ASSET
      };
    });
  }

  // Get key metrics
  const activeLoans = await db.loanApplication.count({
    where: {
      status: { in: ['ACTIVE', 'DISBURSED'] },
      ...(isMultiCompany ? {} : { companyId })
    }
  });

  const pendingPayments = await db.eMISchedule.count({
    where: {
      paymentStatus: { in: ['PENDING', 'OVERDUE'] },
      loanApplication: {
        ...(isMultiCompany ? {} : { companyId })
      }
    }
  });

  return NextResponse.json({
    success: true,
    data: {
      financialYear: currentYear,
      totalsByType,
      totalLoanOutstanding,
      bankBalance: bankAccount?.currentBalance || 0,
      totalIncome,
      totalExpenses,
      netProfit,
      totalJournalEntries,
      todayEntries,
      recentEntries,
      accounts,
      companyBreakdown,
      isMultiCompanyView: isMultiCompany,
      activeLoans,
      pendingPayments,
    },
  });
}

async function getTrialBalanceHandler(companyId: string) {
  const trialBalance = await getTrialBalance(companyId);
  
  return NextResponse.json({
    success: true,
    data: {
      ...trialBalance,
      isMultiCompanyView: companyId === 'all',
    },
  });
}

async function getChartOfAccounts(companyId: string) {
  const isMultiCompany = !companyId || companyId === 'all';
  const accountWhere = { isActive: true, ...(isMultiCompany ? {} : { companyId }) };
  
  const accounts = await db.chartOfAccount.findMany({
    where: accountWhere,
    include: {
      subAccounts: true,
      parentAccount: true,
      company: {
        select: { id: true, name: true, code: true }
      }
    },
    orderBy: { accountCode: 'asc' },
  });

  // Group by type
  const grouped: Record<AccountType, typeof accounts> = {
    ASSET: [],
    LIABILITY: [],
    INCOME: [],
    EXPENSE: [],
    EQUITY: [],
  };

  accounts.forEach((account) => {
    grouped[account.accountType].push(account);
  });

  return NextResponse.json({
    success: true,
    data: {
      accounts,
      grouped,
      isMultiCompanyView: isMultiCompany,
    },
  });
}

async function getAccountLedger(accountId: string | null, startDate: string | null, endDate: string | null, companyId: string | null) {
  if (!accountId) {
    return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
  }

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  const account = await db.chartOfAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const lines = await db.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        entryDate: {
          gte: start,
          lte: end,
        },
        isApproved: true,
        ...(companyId ? { companyId } : {})
      },
    },
    include: {
      journalEntry: true,
    },
    orderBy: {
      journalEntry: {
        entryDate: 'asc',
      },
    },
  });

  // Calculate running balance
  let balance = account.openingBalance;
  const ledgerLines = lines.map((line) => {
    if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
      balance += line.debitAmount - line.creditAmount;
    } else {
      balance += line.creditAmount - line.debitAmount;
    }

    return {
      ...line,
      balance,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      account,
      lines: ledgerLines,
      openingBalance: account.openingBalance,
      closingBalance: balance,
      totalDebits: lines.reduce((sum, l) => sum + l.debitAmount, 0),
      totalCredits: lines.reduce((sum, l) => sum + l.creditAmount, 0),
    },
  });
}

async function getReceivablesAging(companyId: string | null) {
  const isMultiCompany = !companyId || companyId === 'all';
  
  // Get all active loans with outstanding balance
  const activeLoans = await db.loanApplication.findMany({
    where: {
      status: 'ACTIVE',
      ...(isMultiCompany ? {} : { companyId })
    },
    include: {
      emiSchedules: {
        where: {
          paymentStatus: {
            in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'],
          },
        },
      },
      customer: true,
      company: {
        select: { id: true, name: true, code: true }
      }
    },
  });

  const aging = {
    current: { count: 0, amount: 0 },
    days30: { count: 0, amount: 0 },
    days60: { count: 0, amount: 0 },
    days90: { count: 0, amount: 0 },
    days180: { count: 0, amount: 0 },
    above180: { count: 0, amount: 0 },
  };

  const today = new Date();
  const receivablesList: Array<{
    loanId: string;
    applicationNo: string;
    customerName: string;
    outstandingAmount: number;
    daysOverdue: number;
    agingBucket: string;
  }> = [];

  for (const loan of activeLoans) {
    let totalOutstanding = 0;
    let maxDaysOverdue = 0;

    for (const emi of loan.emiSchedules) {
      const outstanding = emi.totalAmount - emi.paidAmount + emi.penaltyAmount - emi.penaltyPaid;
      totalOutstanding += outstanding;

      if (emi.paymentStatus === 'OVERDUE' || emi.dueDate < today) {
        const daysOverdue = Math.floor((today.getTime() - emi.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
      }
    }

    if (totalOutstanding > 0) {
      const receivable = {
        loanId: loan.id,
        applicationNo: loan.applicationNo,
        customerName: loan.customer?.name || 'Unknown',
        outstandingAmount: totalOutstanding,
        daysOverdue: maxDaysOverdue,
        agingBucket: getAgingBucket(maxDaysOverdue),
      };

      receivablesList.push(receivable);

      // Categorize by aging
      if (maxDaysOverdue <= 0) {
        aging.current.count++;
        aging.current.amount += totalOutstanding;
      } else if (maxDaysOverdue <= 30) {
        aging.days30.count++;
        aging.days30.amount += totalOutstanding;
      } else if (maxDaysOverdue <= 60) {
        aging.days60.count++;
        aging.days60.amount += totalOutstanding;
      } else if (maxDaysOverdue <= 90) {
        aging.days90.count++;
        aging.days90.amount += totalOutstanding;
      } else if (maxDaysOverdue <= 180) {
        aging.days180.count++;
        aging.days180.amount += totalOutstanding;
      } else {
        aging.above180.count++;
        aging.above180.amount += totalOutstanding;
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      aging,
      receivablesList: receivablesList.sort((a, b) => b.daysOverdue - a.daysOverdue),
    },
  });
}

function getAgingBucket(days: number): string {
  if (days <= 0) return 'Current';
  if (days <= 30) return '1-30 Days';
  if (days <= 60) return '31-60 Days';
  if (days <= 90) return '61-90 Days';
  if (days <= 180) return '91-180 Days';
  return 'Above 180 Days';
}

async function getProfitLossHandler(companyId: string, startDate: string | null, endDate: string | null) {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
  const end = endDate ? new Date(endDate) : new Date();

  const plData = await getProfitAndLoss(companyId, start, end);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Profit & Loss Statement',
      ...plData,
      generatedAt: new Date(),
    },
  });
}

async function getBalanceSheetHandler(companyId: string, asOfDate: string | null) {
  const asOf = asOfDate ? new Date(asOfDate) : new Date();

  const bsData = await getBalanceSheet(companyId, asOf);

  // Get bank balances
  const bankAccounts = await db.bankAccount.findMany({
    where: { companyId, isActive: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Balance Sheet',
      bankAccounts,
      ...bsData,
      generatedAt: new Date(),
    },
  });
}

// Helper function for cash flow statement
async function getCashFlow(companyId: string, startDate: Date, endDate: Date) {
  const where = companyId ? { companyId } : {};
  
  // Get cash/bank accounts
  const bankAccount = await db.chartOfAccount.findFirst({
    where: { ...where, accountCode: '1040' },
  });

  const cashAccount = await db.chartOfAccount.findFirst({
    where: { ...where, accountCode: '1050' },
  });

  // Get journal entries for the period to calculate cash flows
  const journalEntries = await db.journalEntry.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      entryDate: { gte: startDate, lte: endDate },
      isApproved: true,
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
  });

  // Calculate operating cash flows
  let interestReceived = 0;
  let processingFees = 0;
  let expensesPaid = 0;
  let loanDisbursements = 0;
  let principalRepaid = 0;

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      // Interest income
      if (line.account.accountCode === '3000') {
        interestReceived += line.creditAmount - line.debitAmount;
      }
      // Processing fees
      if (line.account.accountCode === '3010') {
        processingFees += line.creditAmount - line.debitAmount;
      }
      // Expenses
      if (line.account.accountType === 'EXPENSE') {
        expensesPaid += line.debitAmount - line.creditAmount;
      }
      // Loan principal
      if (line.account.accountCode === '1000') {
        if (line.debitAmount > 0) {
          loanDisbursements += line.debitAmount;
        }
        if (line.creditAmount > 0) {
          principalRepaid += line.creditAmount;
        }
      }
    }
  }

  const netOperatingCash = interestReceived + processingFees - expensesPaid;
  const netInvestingCash = principalRepaid - loanDisbursements;

  return {
    openingBalance: {
      bank: bankAccount?.openingBalance || 0,
      cash: cashAccount?.openingBalance || 0,
    },
    operatingActivities: {
      interestReceived,
      processingFees,
      expensesPaid,
      netOperatingCash,
    },
    investingActivities: {
      loanDisbursements,
      principalRepaid,
      netInvestingCash,
    },
    closingBalance: {
      bank: bankAccount?.currentBalance || 0,
      cash: cashAccount?.currentBalance || 0,
    },
    netCashChange: (bankAccount?.currentBalance || 0) - (bankAccount?.openingBalance || 0),
    period: { startDate, endDate },
  };
}

async function getCashFlowHandler(companyId: string, startDate: string | null, endDate: string | null) {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
  const end = endDate ? new Date(endDate) : new Date();

  const cfData = await getCashFlow(companyId, start, end);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Cash Flow Statement',
      ...cfData,
      generatedAt: new Date(),
    },
  });
}

async function initializeAccounting(companyId: string) {
  try {
    // Initialize chart of accounts
    const coaResult = await initializeChartOfAccounts(companyId);
    
    // Initialize accounting settings (inline)
    let settingsResult: Awaited<ReturnType<typeof db.accountingSettings.upsert>> | null = null;
    try {
      settingsResult = await db.accountingSettings.upsert({
        where: { companyId },
        create: { companyId },
        update: { updatedAt: new Date() }
      });
    } catch {
      // Settings might already exist
    }

    // Create default bank account
    const existingBank = await db.bankAccount.findFirst({
      where: { companyId }
    });

    if (!existingBank) {
      await db.bankAccount.create({
        data: {
          companyId,
          bankName: 'Default Bank',
          accountNumber: '0000000000',
          accountName: 'Default Operating Account',
          accountType: 'CURRENT',
          openingBalance: 0,
          currentBalance: 0,
          isDefault: true,
          isActive: true,
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Accounting initialized successfully',
      data: {
        chartOfAccounts: coaResult,
        settings: settingsResult,
      },
    });
  } catch (error) {
    console.error('Accounting initialization error:', error);
    return NextResponse.json({ error: 'Failed to initialize accounting' }, { status: 500 });
  }
}

async function getAccountingSettings(companyId: string) {
  let settings = await db.accountingSettings.findUnique({
    where: { companyId }
  });

  if (!settings) {
    settings = await db.accountingSettings.create({
      data: { companyId }
    });
  }

  const companySettings = await db.companyAccountingSettings.findUnique({
    where: { companyId }
  });

  return NextResponse.json({
    success: true,
    data: {
      settings,
      companySettings,
    },
  });
}

async function updateAccountingSettings(companyId: string, data: Record<string, unknown>) {
  const settings = await db.accountingSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      ...data,
    },
    update: {
      ...data,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    data: settings,
    message: 'Settings updated successfully',
  });
}

async function updateAccount(data: {
  accountId: string;
  accountName?: string;
  description?: string;
  isActive?: boolean;
}) {
  const { accountId, ...updateData } = data;

  const account = await db.chartOfAccount.update({
    where: { id: accountId },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    data: account,
    message: 'Account updated successfully',
  });
}
