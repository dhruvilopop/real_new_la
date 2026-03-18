import { db } from '@/lib/db';
import { AccountType } from '@prisma/client';

// Default Chart of Accounts structure
export const DEFAULT_CHART_OF_ACCOUNTS: Array<{
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  isSystemAccount: boolean;
  description: string;
}> = [
  // ASSETS
  { accountCode: '1000', accountName: 'Loan Principal Outstanding', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Outstanding loan principal amount' },
  { accountCode: '1010', accountName: 'Interest Receivable', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Interest accrued but not yet received' },
  { accountCode: '1020', accountName: 'Processing Fee Receivable', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Processing fees to be collected' },
  { accountCode: '1030', accountName: 'Penalty Receivable', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Late payment penalties receivable' },
  { accountCode: '1040', accountName: 'Bank Account - Main', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Primary bank account' },
  { accountCode: '1050', accountName: 'Cash Account', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Cash on hand' },
  { accountCode: '1060', accountName: 'Other Receivables', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Other amounts receivable' },
  { accountCode: '1070', accountName: 'Prepaid Expenses', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Expenses paid in advance' },
  { accountCode: '1080', accountName: 'TDS Receivable', accountType: 'ASSET' as AccountType, isSystemAccount: true, description: 'Tax deducted at source receivable' },
  
  // LIABILITIES
  { accountCode: '2000', accountName: 'Investor Capital', accountType: 'LIABILITY' as AccountType, isSystemAccount: true, description: 'Capital from investors' },
  { accountCode: '2010', accountName: 'Borrowed Funds', accountType: 'LIABILITY' as AccountType, isSystemAccount: true, description: 'Funds borrowed from banks/lenders' },
  { accountCode: '2020', accountName: 'Accounts Payable', accountType: 'LIABILITY' as AccountType, isSystemAccount: true, description: 'Amounts owed to vendors' },
  { accountCode: '2030', accountName: 'GST Payable', accountType: 'LIABILITY' as AccountType, isSystemAccount: true, description: 'GST collected to be paid' },
  { accountCode: '2040', accountName: 'Commission Payable', accountType: 'LIABILITY' as AccountType, isSystemAccount: true, description: 'Agent commissions payable' },
  { accountCode: '2050', accountName: 'TDS Payable', accountType: 'LIABILITY' as AccountType, isSystemAccount: true, description: 'TDS to be deposited' },
  { accountCode: '2060', accountName: 'Security Deposits', accountType: 'LIABILITY' as AccountType, isSystemAccount: true, description: 'Customer security deposits' },
  
  // INCOME
  { accountCode: '3000', accountName: 'Interest Income', accountType: 'INCOME' as AccountType, isSystemAccount: true, description: 'Interest earned on loans' },
  { accountCode: '3010', accountName: 'Processing Fee Income', accountType: 'INCOME' as AccountType, isSystemAccount: true, description: 'Processing fees collected' },
  { accountCode: '3020', accountName: 'Late Fee Income', accountType: 'INCOME' as AccountType, isSystemAccount: true, description: 'Late payment charges' },
  { accountCode: '3030', accountName: 'Foreclosure Charges', accountType: 'INCOME' as AccountType, isSystemAccount: true, description: 'Foreclosure fees' },
  { accountCode: '3040', accountName: 'Bounce Charges Income', accountType: 'INCOME' as AccountType, isSystemAccount: true, description: 'Cheque/ECS bounce charges' },
  { accountCode: '3050', accountName: 'Other Income', accountType: 'INCOME' as AccountType, isSystemAccount: true, description: 'Miscellaneous income' },
  
  // EXPENSES
  { accountCode: '4000', accountName: 'Staff Salary', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Employee salaries' },
  { accountCode: '4010', accountName: 'Office Rent', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Office rent expense' },
  { accountCode: '4020', accountName: 'Marketing Expense', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Marketing and advertising' },
  { accountCode: '4030', accountName: 'Commission Paid', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Agent commissions paid' },
  { accountCode: '4040', accountName: 'Software & Hosting', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Software and hosting costs' },
  { accountCode: '4050', accountName: 'Bank Charges', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Bank transaction fees' },
  { accountCode: '4060', accountName: 'Utilities', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Electricity, internet, phone' },
  { accountCode: '4070', accountName: 'Travel Expense', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Travel and conveyance' },
  { accountCode: '4080', accountName: 'Legal & Professional', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Legal and professional fees' },
  { accountCode: '4090', accountName: 'Miscellaneous Expense', accountType: 'EXPENSE' as AccountType, isSystemAccount: true, description: 'Other expenses' },
  
  // EQUITY
  { accountCode: '5000', accountName: 'Retained Earnings', accountType: 'EQUITY' as AccountType, isSystemAccount: true, description: 'Accumulated profits' },
  { accountCode: '5010', accountName: 'Current Year Profit', accountType: 'EQUITY' as AccountType, isSystemAccount: true, description: 'Profit/loss for current year' },
];

// Initialize Chart of Accounts for a company
export async function initializeChartOfAccounts(companyId: string) {
  const existingAccounts = await db.chartOfAccount.count({
    where: { companyId }
  });
  
  if (existingAccounts > 0) {
    return { message: 'Chart of accounts already initialized', count: existingAccounts };
  }
  
  const accounts = await db.chartOfAccount.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map(acc => ({
      ...acc,
      companyId,
      isActive: true,
      openingBalance: 0,
      currentBalance: 0
    }))
  });
  
  return { message: 'Chart of accounts initialized', count: accounts.count };
}

// Get account by code
export async function getAccountByCode(accountCode: string, companyId: string) {
  return db.chartOfAccount.findFirst({
    where: { accountCode, companyId }
  });
}

// Generate journal entry number
export async function generateEntryNumber(companyId: string) {
  const settings = await db.accountingSettings.findUnique({
    where: { companyId }
  });
  
  const prefix = settings?.journalEntryPrefix || 'JE';
  const year = new Date().getFullYear();
  
  const lastEntry = await db.journalEntry.findFirst({
    where: { 
      companyId,
      entryNumber: { startsWith: `${prefix}-${year}` }
    },
    orderBy: { entryNumber: 'desc' }
  });
  
  let sequence = 1;
  if (lastEntry) {
    const parts = lastEntry.entryNumber.split('-');
    sequence = parseInt(parts[2] || '0') + 1;
  }
  
  return `${prefix}-${year}-${sequence.toString().padStart(6, '0')}`;
}

// Create journal entry
export async function createJournalEntry(data: {
  companyId: string;
  entryDate: Date;
  narration?: string;
  referenceType?: string;
  referenceId?: string;
  lines: Array<{
    accountCode: string;
    debitAmount: number;
    creditAmount: number;
    narration?: string;
    loanId?: string;
    customerId?: string;
  }>;
  paymentMode?: string;
  chequeNumber?: string;
  chequeDate?: Date;
  bankRefNumber?: string;
  bankAccountId?: string;
  createdById: string;
  isAutoEntry?: boolean;
}) {
  const totalDebit = data.lines.reduce((sum, line) => sum + line.debitAmount, 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + line.creditAmount, 0);
  
  // Validate double-entry
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`);
  }
  
  const entryNumber = await generateEntryNumber(data.companyId);
  
  // Get accounts for all lines
  const accountCodes = [...new Set(data.lines.map(l => l.accountCode))];
  const accounts = await db.chartOfAccount.findMany({
    where: { accountCode: { in: accountCodes }, companyId: data.companyId }
  });
  
  const accountMap = new Map(accounts.map(a => [a.accountCode, a]));
  
  // Validate all accounts exist
  for (const code of accountCodes) {
    if (!accountMap.has(code)) {
      throw new Error(`Account not found: ${code}`);
    }
  }
  
  const entry = await db.journalEntry.create({
    data: {
      companyId: data.companyId,
      entryNumber,
      entryDate: data.entryDate,
      narration: data.narration,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      totalDebit,
      totalCredit,
      isAutoEntry: data.isAutoEntry || false,
      paymentMode: data.paymentMode,
      chequeNumber: data.chequeNumber,
      chequeDate: data.chequeDate,
      bankRefNumber: data.bankRefNumber,
      bankAccountId: data.bankAccountId,
      createdById: data.createdById,
      isApproved: true, // Auto-approve for now
      approvedAt: new Date(),
      lines: {
        create: data.lines.map(line => ({
          accountId: accountMap.get(line.accountCode)!.id,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          narration: line.narration,
          loanId: line.loanId,
          customerId: line.customerId
        }))
      }
    },
    include: {
      lines: {
        include: {
          account: true
        }
      }
    }
  });
  
  // Update account balances
  for (const line of data.lines) {
    const account = accountMap.get(line.accountCode)!;
    const newBalance = account.currentBalance + line.debitAmount - line.creditAmount;
    
    await db.chartOfAccount.update({
      where: { id: account.id },
      data: { currentBalance: newBalance }
    });
  }
  
  return entry;
}

// Post loan disbursement entry
export async function postLoanDisbursementEntry(data: {
  loanId: string;
  companyId: string;
  customerId: string;
  principalAmount: number;
  processingFee: number;
  bankAccountId: string;
  createdById: string;
  paymentMode?: string;
  chequeNumber?: string;
  bankRefNumber?: string;
}) {
  const entryDate = new Date();
  const lines: Array<{
    accountCode: string;
    debitAmount: number;
    creditAmount: number;
    narration: string;
    loanId?: string;
    customerId?: string;
  }> = [];
  
  // Debit: Loan Principal Outstanding
  lines.push({
    accountCode: '1000',
    debitAmount: data.principalAmount,
    creditAmount: 0,
    narration: `Loan disbursement - Principal`,
    loanId: data.loanId,
    customerId: data.customerId
  });
  
  // Credit: Bank Account
  const netDisbursement = data.principalAmount - data.processingFee;
  lines.push({
    accountCode: '1040',
    debitAmount: 0,
    creditAmount: netDisbursement,
    narration: `Net disbursement after processing fee`
  });
  
  // If processing fee is deducted
  if (data.processingFee > 0) {
    // Debit: Processing Fee Receivable (or directly to income if collected)
    // Credit: Processing Fee Income
    lines.push({
      accountCode: '3010',
      debitAmount: 0,
      creditAmount: data.processingFee,
      narration: `Processing fee collected upfront`
    });
  }
  
  return createJournalEntry({
    companyId: data.companyId,
    entryDate,
    narration: `Loan Disbursement - Loan ID: ${data.loanId}`,
    referenceType: 'LOAN_DISBURSEMENT',
    referenceId: data.loanId,
    lines,
    paymentMode: data.paymentMode || 'BANK_TRANSFER',
    chequeNumber: data.chequeNumber,
    bankRefNumber: data.bankRefNumber,
    bankAccountId: data.bankAccountId,
    createdById: data.createdById,
    isAutoEntry: true
  });
}

// Post EMI payment entry
export async function postEMIPaymentEntry(data: {
  loanId: string;
  companyId: string;
  customerId: string;
  principalAmount: number;
  interestAmount: number;
  penaltyAmount?: number;
  bankAccountId?: string;
  createdById: string;
  paymentMode?: string;
  chequeNumber?: string;
  bankRefNumber?: string;
  narration?: string;
}) {
  const entryDate = new Date();
  const lines: Array<{
    accountCode: string;
    debitAmount: number;
    creditAmount: number;
    narration: string;
    loanId?: string;
    customerId?: string;
  }> = [];
  
  // Total payment
  const totalPayment = data.principalAmount + data.interestAmount + (data.penaltyAmount || 0);
  
  // Debit: Bank/Cash
  lines.push({
    accountCode: data.bankAccountId ? '1040' : '1050',
    debitAmount: totalPayment,
    creditAmount: 0,
    narration: `EMI Payment received`,
    loanId: data.loanId,
    customerId: data.customerId
  });
  
  // Credit: Loan Principal Outstanding (principal part)
  if (data.principalAmount > 0) {
    lines.push({
      accountCode: '1000',
      debitAmount: 0,
      creditAmount: data.principalAmount,
      narration: `Principal component`,
      loanId: data.loanId,
      customerId: data.customerId
    });
  }
  
  // Credit: Interest Income
  if (data.interestAmount > 0) {
    lines.push({
      accountCode: '3000',
      debitAmount: 0,
      creditAmount: data.interestAmount,
      narration: `Interest component`,
      loanId: data.loanId,
      customerId: data.customerId
    });
  }
  
  // Credit: Late Fee Income (if penalty)
  if (data.penaltyAmount && data.penaltyAmount > 0) {
    lines.push({
      accountCode: '3020',
      debitAmount: 0,
      creditAmount: data.penaltyAmount,
      narration: `Late payment charges`,
      loanId: data.loanId,
      customerId: data.customerId
    });
  }
  
  return createJournalEntry({
    companyId: data.companyId,
    entryDate,
    narration: data.narration || `EMI Payment - Loan ID: ${data.loanId}`,
    referenceType: 'EMI_PAYMENT',
    referenceId: data.loanId,
    lines,
    paymentMode: data.paymentMode || 'BANK_TRANSFER',
    chequeNumber: data.chequeNumber,
    bankRefNumber: data.bankRefNumber,
    bankAccountId: data.bankAccountId,
    createdById: data.createdById,
    isAutoEntry: true
  });
}

// Post processing fee entry
export async function postProcessingFeeEntry(data: {
  loanId: string;
  companyId: string;
  customerId: string;
  amount: number;
  bankAccountId?: string;
  createdById: string;
  paymentMode?: string;
}) {
  const lines = [
    {
      accountCode: data.bankAccountId ? '1040' : '1050',
      debitAmount: data.amount,
      creditAmount: 0,
      narration: 'Processing fee received',
      loanId: data.loanId,
      customerId: data.customerId
    },
    {
      accountCode: '3010',
      debitAmount: 0,
      creditAmount: data.amount,
      narration: 'Processing fee income'
    }
  ];
  
  return createJournalEntry({
    companyId: data.companyId,
    entryDate: new Date(),
    narration: `Processing Fee - Loan ID: ${data.loanId}`,
    referenceType: 'PROCESSING_FEE',
    referenceId: data.loanId,
    lines,
    paymentMode: data.paymentMode || 'CASH',
    createdById: data.createdById,
    isAutoEntry: true
  });
}

// Post expense entry
export async function postExpenseEntry(data: {
  companyId: string;
  expenseType: string;
  accountCode: string;
  amount: number;
  description: string;
  paymentMode: string;
  bankAccountId?: string;
  chequeNumber?: string;
  createdById: string;
}) {
  const lines = [
    {
      accountCode: data.accountCode,
      debitAmount: data.amount,
      creditAmount: 0,
      narration: data.description
    },
    {
      accountCode: data.bankAccountId ? '1040' : '1050',
      debitAmount: 0,
      creditAmount: data.amount,
      narration: `Payment for ${data.expenseType}`
    }
  ];
  
  return createJournalEntry({
    companyId: data.companyId,
    entryDate: new Date(),
    narration: `Expense: ${data.description}`,
    referenceType: 'EXPENSE',
    lines,
    paymentMode: data.paymentMode,
    chequeNumber: data.chequeNumber,
    createdById: data.createdById,
    isAutoEntry: false
  });
}

// Post commission entry
export async function postCommissionEntry(data: {
  companyId: string;
  agentId: string;
  amount: number;
  loanId?: string;
  createdById: string;
}) {
  const lines = [
    {
      accountCode: '4030', // Commission Paid
      debitAmount: data.amount,
      creditAmount: 0,
      narration: 'Agent commission',
      loanId: data.loanId
    },
    {
      accountCode: '2040', // Commission Payable
      debitAmount: 0,
      creditAmount: data.amount,
      narration: 'Commission payable to agent'
    }
  ];
  
  return createJournalEntry({
    companyId: data.companyId,
    entryDate: new Date(),
    narration: `Agent Commission - Agent ID: ${data.agentId}`,
    referenceType: 'COMMISSION',
    referenceId: data.loanId,
    lines,
    createdById: data.createdById,
    isAutoEntry: true
  });
}

// Get account balance
export async function getAccountBalance(accountId: string, financialYearId?: string) {
  if (financialYearId) {
    const ledgerBalance = await db.ledgerBalance.findUnique({
      where: {
        accountId_financialYearId: {
          accountId,
          financialYearId
        }
      }
    });
    
    if (ledgerBalance) {
      return {
        opening: ledgerBalance.openingBalance,
        debits: ledgerBalance.totalDebits,
        credits: ledgerBalance.totalCredits,
        closing: ledgerBalance.closingBalance
      };
    }
  }
  
  const account = await db.chartOfAccount.findUnique({
    where: { id: accountId }
  });
  
  return {
    opening: account?.openingBalance || 0,
    closing: account?.currentBalance || 0
  };
}

// Get trial balance
export async function getTrialBalance(companyId: string, asOfDate?: Date) {
  const accounts = await db.chartOfAccount.findMany({
    where: { companyId, isActive: true },
    orderBy: { accountCode: 'asc' }
  });
  
  const dateFilter = asOfDate ? new Date(asOfDate) : new Date();
  
  const trialBalance = await Promise.all(accounts.map(async (account) => {
    const lines = await db.journalEntryLine.aggregate({
      where: {
        accountId: account.id,
        journalEntry: {
          entryDate: { lte: dateFilter },
          isApproved: true
        }
      },
      _sum: {
        debitAmount: true,
        creditAmount: true
      }
    });
    
    const totalDebit = lines._sum.debitAmount || 0;
    const totalCredit = lines._sum.creditAmount || 0;
    
    let balance = 0;
    let balanceType = '';
    
    if (['ASSET', 'EXPENSE'].includes(account.accountType)) {
      balance = account.openingBalance + totalDebit - totalCredit;
      balanceType = balance >= 0 ? 'DEBIT' : 'CREDIT';
    } else {
      balance = account.openingBalance + totalCredit - totalDebit;
      balanceType = balance >= 0 ? 'CREDIT' : 'DEBIT';
    }
    
    return {
      ...account,
      totalDebit,
      totalCredit,
      balance: Math.abs(balance),
      balanceType
    };
  }));
  
  const totalDebitBalance = trialBalance.filter(a => a.balanceType === 'DEBIT').reduce((sum, a) => sum + a.balance, 0);
  const totalCreditBalance = trialBalance.filter(a => a.balanceType === 'CREDIT').reduce((sum, a) => sum + a.balance, 0);
  
  return {
    accounts: trialBalance,
    totalDebitBalance,
    totalCreditBalance,
    isBalanced: Math.abs(totalDebitBalance - totalCreditBalance) < 0.01
  };
}

// Get Profit & Loss Statement
export async function getProfitAndLoss(companyId: string, startDate: Date, endDate: Date) {
  const incomeAccounts = await db.chartOfAccount.findMany({
    where: { companyId, accountType: 'INCOME', isActive: true }
  });
  
  const expenseAccounts = await db.chartOfAccount.findMany({
    where: { companyId, accountType: 'EXPENSE', isActive: true }
  });
  
  const getAccountTotals = async (accounts: typeof incomeAccounts) => {
    return Promise.all(accounts.map(async (account) => {
      const lines = await db.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            companyId,
            entryDate: { gte: startDate, lte: endDate },
            isApproved: true
          }
        },
        _sum: {
          debitAmount: true,
          creditAmount: true
        }
      });
      
      // For income, credit increases balance
      const total = (lines._sum.creditAmount || 0) - (lines._sum.debitAmount || 0);
      
      return {
        ...account,
        amount: total
      };
    }));
  };
  
  const income = await getAccountTotals(incomeAccounts);
  const expenses = await getAccountTotals(expenseAccounts);
  
  const totalIncome = income.reduce((sum, acc) => sum + acc.amount, 0);
  const totalExpenses = expenses.reduce((sum, acc) => sum + acc.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  
  return {
    income: income.filter(a => a.amount !== 0),
    expenses: expenses.filter(a => a.amount !== 0),
    totalIncome,
    totalExpenses,
    netProfit,
    period: { startDate, endDate }
  };
}

// Get Balance Sheet
export async function getBalanceSheet(companyId: string, asOfDate?: Date) {
  const dateFilter = asOfDate || new Date();
  
  const assetAccounts = await db.chartOfAccount.findMany({
    where: { companyId, accountType: 'ASSET', isActive: true }
  });
  
  const liabilityAccounts = await db.chartOfAccount.findMany({
    where: { companyId, accountType: 'LIABILITY', isActive: true }
  });
  
  const equityAccounts = await db.chartOfAccount.findMany({
    where: { companyId, accountType: 'EQUITY', isActive: true }
  });
  
  const getAccountBalances = async (accounts: typeof assetAccounts, isDebitBalance: boolean) => {
    return Promise.all(accounts.map(async (account) => {
      const lines = await db.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            companyId,
            entryDate: { lte: dateFilter },
            isApproved: true
          }
        },
        _sum: {
          debitAmount: true,
          creditAmount: true
        }
      });
      
      let balance: number;
      if (isDebitBalance) {
        balance = account.openingBalance + (lines._sum.debitAmount || 0) - (lines._sum.creditAmount || 0);
      } else {
        balance = account.openingBalance + (lines._sum.creditAmount || 0) - (lines._sum.debitAmount || 0);
      }
      
      return {
        ...account,
        amount: balance
      };
    }));
  };
  
  const assets = await getAccountBalances(assetAccounts, true);
  const liabilities = await getAccountBalances(liabilityAccounts, false);
  const equity = await getAccountBalances(equityAccounts, false);
  
  const totalAssets = assets.reduce((sum, acc) => sum + acc.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.amount, 0);
  const totalEquity = equity.reduce((sum, acc) => sum + acc.amount, 0);
  
  return {
    assets: assets.filter(a => a.amount !== 0),
    liabilities: liabilities.filter(a => a.amount !== 0),
    equity: equity.filter(a => a.amount !== 0),
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    asOfDate: dateFilter
  };
}

// Get receivables aging report
export async function getReceivablesAging(companyId: string) {
  const loans = await db.loanApplication.findMany({
    where: {
      companyId,
      status: { in: ['ACTIVE', 'DISBURSED'] }
    },
    include: {
      customer: true,
      emiSchedules: {
        where: {
          paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] }
        },
        orderBy: { dueDate: 'asc' }
      }
    }
  });
  
  const today = new Date();
  const agingBuckets = {
    current: [] as any[],
    days30: [] as any[],
    days60: [] as any[],
    days90: [] as any[],
    over90: [] as any[]
  };
  
  let totalOutstanding = 0;
  let totalOverdue = 0;
  
  for (const loan of loans) {
    for (const emi of loan.emiSchedules) {
      const outstanding = emi.totalAmount - emi.paidAmount;
      if (outstanding <= 0) continue;
      
      totalOutstanding += outstanding;
      
      const daysOverdue = Math.floor((today.getTime() - emi.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const emiData = {
        loanId: loan.id,
        applicationNo: loan.applicationNo,
        customer: loan.customer,
        dueDate: emi.dueDate,
        installmentNumber: emi.installmentNumber,
        outstanding,
        daysOverdue: Math.max(0, daysOverdue)
      };
      
      if (daysOverdue <= 0) {
        agingBuckets.current.push(emiData);
      } else {
        totalOverdue += outstanding;
        if (daysOverdue <= 30) {
          agingBuckets.days30.push(emiData);
        } else if (daysOverdue <= 60) {
          agingBuckets.days60.push(emiData);
        } else if (daysOverdue <= 90) {
          agingBuckets.days90.push(emiData);
        } else {
          agingBuckets.over90.push(emiData);
        }
      }
    }
  }
  
  return {
    ...agingBuckets,
    totalOutstanding,
    totalOverdue,
    currentTotal: agingBuckets.current.reduce((sum, e) => sum + e.outstanding, 0),
    days30Total: agingBuckets.days30.reduce((sum, e) => sum + e.outstanding, 0),
    days60Total: agingBuckets.days60.reduce((sum, e) => sum + e.outstanding, 0),
    days90Total: agingBuckets.days90.reduce((sum, e) => sum + e.outstanding, 0),
    over90Total: agingBuckets.over90.reduce((sum, e) => sum + e.outstanding, 0)
  };
}

// Get loan ledger for a specific loan
export async function getLoanLedger(loanId: string) {
  const entries = await db.journalEntry.findMany({
    where: {
      OR: [
        { referenceId: loanId },
        { lines: { some: { loanId } } }
      ]
    },
    include: {
      lines: {
        include: {
          account: true
        }
      }
    },
    orderBy: { entryDate: 'asc' }
  });
  
  return entries;
}

// Get customer ledger
export async function getCustomerLedger(customerId: string, companyId: string) {
  const entries = await db.journalEntry.findMany({
    where: {
      companyId,
      lines: { some: { customerId } }
    },
    include: {
      lines: {
        include: {
          account: true
        }
      }
    },
    orderBy: { entryDate: 'desc' }
  });
  
  return entries;
}
