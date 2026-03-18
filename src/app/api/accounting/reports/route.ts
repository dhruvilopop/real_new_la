import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LoanStatus, EMIPaymentStatus } from '@prisma/client';

// Helper to get valid company ID
async function getValidCompanyId(providedCompanyId: string): Promise<string | null> {
  if (providedCompanyId && providedCompanyId !== 'default') {
    const company = await db.company.findUnique({ where: { id: providedCompanyId } });
    if (company) return providedCompanyId;
  }
  
  // Get any company
  const anyCompany = await db.company.findFirst();
  return anyCompany?.id || null;
}

// GET - Generate various accounting reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'trial-balance';
    const providedCompanyId = searchParams.get('companyId') || 'default';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const companyId = await getValidCompanyId(providedCompanyId);

    switch (reportType) {
      case 'trial-balance':
        return await getTrialBalance(companyId);
      case 'profit-loss':
        return await getProfitAndLoss(companyId, startDate, endDate);
      case 'balance-sheet':
        return await getBalanceSheet(companyId);
      case 'portfolio':
        return await getLoanPortfolioReport(companyId);
      case 'cash-flow':
        return await getCashFlowStatement(companyId, startDate, endDate);
      case 'receivables-aging':
        return await getReceivablesAging(companyId);
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

// Trial Balance
async function getTrialBalance(companyId: string | null) {
  const where = companyId ? { companyId, isActive: true } : { isActive: true };
  
  const accounts = await db.chartOfAccount.findMany({
    where,
    orderBy: { accountCode: 'asc' },
  });

  const trialBalance = accounts.map(account => {
    let debitBalance = 0;
    let creditBalance = 0;

    // For Assets and Expenses: positive balance = debit
    // For Liabilities, Income, Equity: positive balance = credit
    if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
      if (account.currentBalance >= 0) {
        debitBalance = account.currentBalance;
      } else {
        creditBalance = Math.abs(account.currentBalance);
      }
    } else {
      if (account.currentBalance >= 0) {
        creditBalance = account.currentBalance;
      } else {
        debitBalance = Math.abs(account.currentBalance);
      }
    }

    return {
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      debitBalance,
      creditBalance,
    };
  });

  return NextResponse.json(trialBalance);
}

// Profit & Loss Statement
async function getProfitAndLoss(companyId: string | null, startDate?: string | null, endDate?: string | null) {
  const where = companyId ? { companyId, isActive: true } : { isActive: true };
  
  // Get income accounts
  const incomeAccounts = await db.chartOfAccount.findMany({
    where: { ...where, accountType: 'INCOME' },
    orderBy: { accountCode: 'asc' },
  });

  // Get expense accounts
  const expenseAccounts = await db.chartOfAccount.findMany({
    where: { ...where, accountType: 'EXPENSE' },
    orderBy: { accountCode: 'asc' },
  });

  const income = incomeAccounts.map(account => ({
    accountCode: account.accountCode,
    accountName: account.accountName,
    amount: account.currentBalance,
  }));

  const expenses = expenseAccounts.map(account => ({
    accountCode: account.accountCode,
    accountName: account.accountName,
    amount: account.currentBalance,
  }));

  const totalIncome = income.reduce((sum, acc) => sum + acc.amount, 0);
  const totalExpenses = expenses.reduce((sum, acc) => sum + acc.amount, 0);

  return NextResponse.json({
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
  });
}

// Balance Sheet
async function getBalanceSheet(companyId: string | null) {
  const where = companyId ? { companyId, isActive: true } : { isActive: true };
  
  // Get asset accounts
  const assetAccounts = await db.chartOfAccount.findMany({
    where: { ...where, accountType: 'ASSET' },
    orderBy: { accountCode: 'asc' },
  });

  // Get liability accounts
  const liabilityAccounts = await db.chartOfAccount.findMany({
    where: { ...where, accountType: 'LIABILITY' },
    orderBy: { accountCode: 'asc' },
  });

  // Get equity accounts
  const equityAccounts = await db.chartOfAccount.findMany({
    where: { ...where, accountType: 'EQUITY' },
    orderBy: { accountCode: 'asc' },
  });

  const assets = assetAccounts.map(account => ({
    accountCode: account.accountCode,
    accountName: account.accountName,
    amount: account.currentBalance,
  }));

  const liabilities = liabilityAccounts.map(account => ({
    accountCode: account.accountCode,
    accountName: account.accountName,
    amount: account.currentBalance,
  }));

  const equity = equityAccounts.map(account => ({
    accountCode: account.accountCode,
    accountName: account.accountName,
    amount: account.currentBalance,
  }));

  // Calculate profit for equity
  const incomeAccounts = await db.chartOfAccount.findMany({
    where: { ...where, accountType: 'INCOME' },
  });
  const expenseAccounts = await db.chartOfAccount.findMany({
    where: { ...where, accountType: 'EXPENSE' },
  });

  const totalIncome = incomeAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
  const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
  const currentYearProfit = totalIncome - totalExpenses;

  // Add current year profit to equity
  equity.push({
    accountCode: '5200',
    accountName: 'Current Year Profit/(Loss)',
    amount: currentYearProfit,
  });

  const totalAssets = assets.reduce((sum, acc) => sum + acc.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.amount, 0);
  const totalEquityBeforeProfit = equity.reduce((sum, acc) => sum + acc.amount, 0);

  return NextResponse.json({
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity: totalEquityBeforeProfit,
    balanceCheck: {
      assets: totalAssets,
      liabilitiesAndEquity: totalLiabilities + totalEquityBeforeProfit,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquityBeforeProfit)) < 0.01,
    },
  });
}

// Loan Portfolio Report
async function getLoanPortfolioReport(companyId: string | null) {
  try {
    // Build where clause
    const loanWhere = companyId 
      ? { companyId, status: { in: [LoanStatus.ACTIVE, LoanStatus.DISBURSED, LoanStatus.CLOSED] } } 
      : { status: { in: [LoanStatus.ACTIVE, LoanStatus.DISBURSED, LoanStatus.CLOSED] } };
    
    const activeLoanWhere = companyId 
      ? { companyId, status: { in: [LoanStatus.ACTIVE, LoanStatus.DISBURSED] } } 
      : { status: { in: [LoanStatus.ACTIVE, LoanStatus.DISBURSED] } };

    // Get loan statistics
    const [totalDisbursed, totalOutstanding, activeLoans] = await Promise.all([
      db.loanApplication.aggregate({
        where: loanWhere,
        _sum: { disbursedAmount: true },
      }),
      db.loanApplication.aggregate({
        where: activeLoanWhere,
        _sum: { disbursedAmount: true },
      }),
      db.loanApplication.count({
        where: activeLoanWhere,
      }),
    ]);

    // Get EMI statistics
    const emiWhere = companyId 
      ? { loanApplication: { companyId } } 
      : {};
    
    const [collectedInterest, pendingEMIs, overdueEMIs] = await Promise.all([
      db.eMISchedule.aggregate({
        where: {
          ...emiWhere,
          paymentStatus: 'PAID',
        },
        _sum: { interestAmount: true },
      }),
      db.eMISchedule.count({
        where: {
          ...emiWhere,
          paymentStatus: 'PENDING',
        },
      }),
      db.eMISchedule.count({
        where: {
          ...emiWhere,
          paymentStatus: 'OVERDUE',
        },
      }),
    ]);

    return NextResponse.json({
      totalDisbursed: totalDisbursed._sum.disbursedAmount || 0,
      totalOutstanding: totalOutstanding._sum.disbursedAmount || 0,
      totalInterestCollected: collectedInterest._sum.interestAmount || 0,
      pendingEMIs,
      overdueEMIs,
      activeLoans,
    });
  } catch (error) {
    console.error('Error in portfolio report:', error);
    return NextResponse.json({
      totalDisbursed: 0,
      totalOutstanding: 0,
      totalInterestCollected: 0,
      pendingEMIs: 0,
      overdueEMIs: 0,
      activeLoans: 0,
    });
  }
}

// Cash Flow Statement
async function getCashFlowStatement(companyId: string | null, startDate?: string | null, endDate?: string | null) {
  const where = companyId ? { companyId } : {};
  
  // Simplified cash flow statement
  const bankAccount = await db.chartOfAccount.findFirst({
    where: { ...where, accountCode: '1400' },
  });

  const cashAccount = await db.chartOfAccount.findFirst({
    where: { ...where, accountCode: '1500' },
  });

  return NextResponse.json({
    period: { startDate, endDate },
    openingBalance: {
      bank: bankAccount?.openingBalance || 0,
      cash: cashAccount?.openingBalance || 0,
    },
    operatingActivities: {
      interestReceived: 0,
      processingFees: 0,
      expensesPaid: 0,
      netOperatingCash: 0,
    },
    investingActivities: {
      loanDisbursements: 0,
      principalRepaid: 0,
      netInvestingCash: 0,
    },
    closingBalance: {
      bank: bankAccount?.currentBalance || 0,
      cash: cashAccount?.currentBalance || 0,
    },
    netCashChange: (bankAccount?.currentBalance || 0) - (bankAccount?.openingBalance || 0),
  });
}

// Receivables Aging Report
async function getReceivablesAging(companyId: string | null) {
  const now = new Date();
  
  try {
    const emiWhere = companyId 
      ? { paymentStatus: EMIPaymentStatus.OVERDUE, loanApplication: { companyId } } 
      : { paymentStatus: EMIPaymentStatus.OVERDUE };
    
    const overdueEMIs = await db.eMISchedule.findMany({
      where: emiWhere,
      include: {
        loanApplication: {
          include: {
            customer: true,
          },
        },
      },
    });

    const agingBuckets = {
      current: [] as any[],
      days30: [] as any[],
      days60: [] as any[],
      days90: [] as any[],
      over90: [] as any[],
    };

    let currentTotal = 0;
    let days30Total = 0;
    let days60Total = 0;
    let days90Total = 0;
    let over90Total = 0;

    for (const emi of overdueEMIs) {
      const daysOverdue = Math.floor((now.getTime() - new Date(emi.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const item = {
        loanNo: emi.loanApplication.applicationNo,
        customer: emi.loanApplication.customer?.name || 'Unknown',
        emiNo: emi.installmentNumber,
        dueDate: emi.dueDate,
        amount: emi.totalAmount,
        daysOverdue,
      };

      if (daysOverdue <= 0) {
        agingBuckets.current.push(item);
        currentTotal += emi.totalAmount;
      } else if (daysOverdue <= 30) {
        agingBuckets.days30.push(item);
        days30Total += emi.totalAmount;
      } else if (daysOverdue <= 60) {
        agingBuckets.days60.push(item);
        days60Total += emi.totalAmount;
      } else if (daysOverdue <= 90) {
        agingBuckets.days90.push(item);
        days90Total += emi.totalAmount;
      } else {
        agingBuckets.over90.push(item);
        over90Total += emi.totalAmount;
      }
    }

    return NextResponse.json({
      agingBuckets,
      totals: {
        current: currentTotal,
        days30: days30Total,
        days60: days60Total,
        days90: days90Total,
        over90: over90Total,
        total: currentTotal + days30Total + days60Total + days90Total + over90Total,
      },
    });
  } catch (error) {
    console.error('Error in receivables aging:', error);
    return NextResponse.json({
      agingBuckets: {
        current: [],
        days30: [],
        days60: [],
        days90: [],
        over90: [],
      },
      totals: {
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        over90: 0,
        total: 0,
      },
    });
  }
}
