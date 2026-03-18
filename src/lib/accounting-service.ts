/**
 * COMPLETE DOUBLE-ENTRY ACCOUNTING SERVICE
 * Money Mitra Loan Management System
 * 
 * This service handles all automatic journal entries following
 * proper double-entry accounting principles.
 * 
 * IMPORTANT: Principal is NEVER treated as income.
 * Only interest and fees are income.
 */

import { db } from './db';
import { AccountType } from '@prisma/client';

// ============================================
// CHART OF ACCOUNTS DEFAULT STRUCTURE
// ============================================

export const DEFAULT_CHART_OF_ACCOUNTS = {
  ASSETS: [
    { code: '1000', name: 'Loan Principal Outstanding', type: 'ASSET', isSystemAccount: true, description: 'Total principal amount disbursed to borrowers' },
    { code: '1100', name: 'Interest Receivable', type: 'ASSET', isSystemAccount: true, description: 'Interest accrued but not yet received' },
    { code: '1200', name: 'Processing Fee Receivable', type: 'ASSET', isSystemAccount: true, description: 'Processing fees due from customers' },
    { code: '1300', name: 'Penalty Receivable', type: 'ASSET', isSystemAccount: true, description: 'Late payment penalties due' },
    { code: '1400', name: 'Bank Account', type: 'ASSET', isSystemAccount: true, description: 'Main bank account' },
    { code: '1500', name: 'Cash Account', type: 'ASSET', isSystemAccount: true, description: 'Cash in hand' },
    { code: '1600', name: 'Other Receivables', type: 'ASSET', isSystemAccount: false, description: 'Other amounts receivable' },
    { code: '1700', name: 'TDS Receivable', type: 'ASSET', isSystemAccount: false, description: 'Tax Deducted at Source receivable' },
  ],
  LIABILITIES: [
    { code: '2000', name: 'Investor Capital', type: 'LIABILITY', isSystemAccount: true, description: 'Capital received from investors' },
    { code: '2100', name: 'Borrowed Funds', type: 'LIABILITY', isSystemAccount: true, description: 'Funds borrowed from banks/institutions' },
    { code: '2200', name: 'Payables', type: 'LIABILITY', isSystemAccount: true, description: 'Amounts payable to vendors/suppliers' },
    { code: '2300', name: 'GST Payable', type: 'LIABILITY', isSystemAccount: true, description: 'GST collected to be paid to government' },
    { code: '2400', name: 'TDS Payable', type: 'LIABILITY', isSystemAccount: true, description: 'TDS collected to be paid to government' },
    { code: '2500', name: 'Agent Commission Payable', type: 'LIABILITY', isSystemAccount: true, description: 'Commissions due to agents' },
  ],
  INCOME: [
    { code: '3000', name: 'Interest Income', type: 'INCOME', isSystemAccount: true, description: 'Interest earned on loans - MAIN INCOME' },
    { code: '3100', name: 'Processing Fee Income', type: 'INCOME', isSystemAccount: true, description: 'Processing fees collected' },
    { code: '3200', name: 'Late Fee Income', type: 'INCOME', isSystemAccount: true, description: 'Late payment fees collected' },
    { code: '3300', name: 'Foreclosure Charges Income', type: 'INCOME', isSystemAccount: true, description: 'Foreclosure/prepayment charges' },
    { code: '3400', name: 'Bounce Charges Income', type: 'INCOME', isSystemAccount: true, description: 'Cheque/ECS bounce charges' },
    { code: '3500', name: 'Other Income', type: 'INCOME', isSystemAccount: false, description: 'Other miscellaneous income' },
  ],
  EXPENSES: [
    { code: '4000', name: 'Staff Salary', type: 'EXPENSE', isSystemAccount: true, description: 'Salaries paid to staff' },
    { code: '4100', name: 'Office Rent', type: 'EXPENSE', isSystemAccount: true, description: 'Office rent expenses' },
    { code: '4200', name: 'Marketing Expense', type: 'EXPENSE', isSystemAccount: true, description: 'Marketing and advertising costs' },
    { code: '4300', name: 'Commission Paid', type: 'EXPENSE', isSystemAccount: true, description: 'Commissions paid to agents' },
    { code: '4400', name: 'Software & Hosting', type: 'EXPENSE', isSystemAccount: true, description: 'Software and server hosting costs' },
    { code: '4500', name: 'Bank Charges', type: 'EXPENSE', isSystemAccount: true, description: 'Bank transaction charges' },
    { code: '4600', name: 'Electricity & Utilities', type: 'EXPENSE', isSystemAccount: true, description: 'Electricity, water, internet bills' },
    { code: '4700', name: 'Travel Expense', type: 'EXPENSE', isSystemAccount: false, description: 'Travel and conveyance' },
    { code: '4800', name: 'Miscellaneous Expense', type: 'EXPENSE', isSystemAccount: false, description: 'Other expenses' },
    { code: '4900', name: 'Depreciation', type: 'EXPENSE', isSystemAccount: true, description: 'Asset depreciation' },
  ],
  EQUITY: [
    { code: '5000', name: 'Owner Capital', type: 'EQUITY', isSystemAccount: true, description: 'Owner\'s capital investment' },
    { code: '5100', name: 'Retained Earnings', type: 'EQUITY', isSystemAccount: true, description: 'Accumulated profits' },
    { code: '5200', name: 'Current Year Profit', type: 'EQUITY', isSystemAccount: true, description: 'Profit/loss for current year' },
  ],
};

// ============================================
// ACCOUNT CODE CONSTANTS
// ============================================

export const ACCOUNT_CODES = {
  LOAN_PRINCIPAL: '1000',
  INTEREST_RECEIVABLE: '1100',
  PROCESSING_FEE_RECEIVABLE: '1200',
  PENALTY_RECEIVABLE: '1300',
  BANK_ACCOUNT: '1400',
  CASH_ACCOUNT: '1500',
  INVESTOR_CAPITAL: '2000',
  BORROWED_FUNDS: '2100',
  PAYABLES: '2200',
  GST_PAYABLE: '2300',
  AGENT_COMMISSION_PAYABLE: '2500',
  INTEREST_INCOME: '3000',
  PROCESSING_FEE_INCOME: '3100',
  LATE_FEE_INCOME: '3200',
  FORECLOSURE_INCOME: '3300',
  BOUNCE_CHARGES_INCOME: '3400',
  OTHER_INCOME: '3050',
  STAFF_SALARY: '4000',
  COMMISSION_PAID: '4300',
};

// ============================================
// JOURNAL ENTRY TYPES
// ============================================

export type JournalEntryType = 
  | 'LOAN_DISBURSEMENT'
  | 'LOAN_REPAYMENT'
  | 'EMI_PAYMENT'
  | 'PROCESSING_FEE_COLLECTION'
  | 'INTEREST_COLLECTION'
  | 'PENALTY_COLLECTION'
  | 'LATE_FEE_COLLECTION'
  | 'FORECLOSURE'
  | 'EXPENSE_ENTRY'
  | 'COMMISSION_PAYMENT'
  | 'MANUAL_ENTRY'
  | 'OPENING_BALANCE'
  | 'YEAR_END_CLOSING'
  | 'BANK_TRANSFER'
  | 'CASH_DEPOSIT'
  | 'CASH_WITHDRAWAL';

// ============================================
// MAIN ACCOUNTING SERVICE CLASS
// ============================================

export class AccountingService {
  private companyId: string;
  private financialYearId: string | null = null;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Initialize chart of accounts for a company
   */
  async initializeChartOfAccounts(): Promise<void> {
    const allAccounts = [
      ...DEFAULT_CHART_OF_ACCOUNTS.ASSETS,
      ...DEFAULT_CHART_OF_ACCOUNTS.LIABILITIES,
      ...DEFAULT_CHART_OF_ACCOUNTS.INCOME,
      ...DEFAULT_CHART_OF_ACCOUNTS.EXPENSES,
      ...DEFAULT_CHART_OF_ACCOUNTS.EQUITY,
    ];

    for (const account of allAccounts) {
      const existing = await db.chartOfAccount.findFirst({
        where: { companyId: this.companyId, accountCode: account.code },
      });

      if (!existing) {
        await db.chartOfAccount.create({
          data: {
            companyId: this.companyId,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.type as AccountType,
            isSystemAccount: account.isSystemAccount,
            description: account.description,
            openingBalance: 0,
            currentBalance: 0,
          },
        });
      }
    }
  }

  /**
   * Get or create current financial year
   */
  async getCurrentFinancialYear(): Promise<string> {
    if (this.financialYearId) return this.financialYearId;

    const now = new Date();
    const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const yearName = `FY ${currentYear}-${currentYear + 1}`;
    const startDate = new Date(currentYear, 3, 1); // April 1
    const endDate = new Date(currentYear + 1, 2, 31); // March 31

    let financialYear = await db.financialYear.findFirst({
      where: { companyId: this.companyId, name: yearName },
    });

    if (!financialYear) {
      financialYear = await db.financialYear.create({
        data: {
          companyId: this.companyId,
          name: yearName,
          startDate,
          endDate,
          isClosed: false,
        },
      });
    }

    this.financialYearId = financialYear.id;
    return financialYear.id;
  }

  /**
   * Get account by code
   */
  async getAccountByCode(code: string): Promise<string> {
    const account = await db.chartOfAccount.findFirst({
      where: { companyId: this.companyId, accountCode: code },
    });
    if (!account) throw new Error(`Account with code ${code} not found`);
    return account.id;
  }

  /**
   * Generate next journal entry number
   */
  async generateEntryNumber(): Promise<string> {
    const count = await db.journalEntry.count({
      where: { companyId: this.companyId },
    });
    const entryNumber = `JE${String(count + 1).padStart(6, '0')}`;
    return entryNumber;
  }

  /**
   * Create a journal entry
   */
  async createJournalEntry(params: {
    entryDate: Date;
    referenceType: JournalEntryType;
    referenceId?: string;
    narration: string;
    lines: Array<{
      accountCode: string;
      debitAmount: number;
      creditAmount: number;
      loanId?: string;
      customerId?: string;
      narration?: string;
    }>;
    createdById: string;
    paymentMode?: string;
    bankAccountId?: string;
    chequeNumber?: string;
    bankRefNumber?: string;
    isAutoEntry?: boolean;
  }): Promise<string> {
    // Validate double-entry (total debit = total credit)
    const totalDebit = params.lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const totalCredit = params.lines.reduce((sum, line) => sum + line.creditAmount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal entry not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    const entryNumber = await this.generateEntryNumber();
    const financialYearId = await this.getCurrentFinancialYear();

    // Create journal entry with lines in a transaction
    const journalEntry = await db.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          companyId: this.companyId,
          entryNumber,
          entryDate: params.entryDate,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          narration: params.narration,
          totalDebit,
          totalCredit,
          isAutoEntry: params.isAutoEntry ?? true,
          createdById: params.createdById,
          paymentMode: params.paymentMode,
          bankAccountId: params.bankAccountId,
          chequeNumber: params.chequeNumber,
          bankRefNumber: params.bankRefNumber,
          isApproved: true,
        },
      });

      // Create journal entry lines
      for (const line of params.lines) {
        const accountId = await this.getAccountByCode(line.accountCode);
        
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            loanId: line.loanId,
            customerId: line.customerId,
            narration: line.narration,
          },
        });

        // Update account balance
        await this.updateAccountBalance(tx, accountId, line.debitAmount, line.creditAmount, financialYearId);
      }

      return entry;
    });

    return journalEntry.id;
  }

  /**
   * Update account balance (with debit/credit rules)
   */
  private async updateAccountBalance(
    tx: any,
    accountId: string,
    debitAmount: number,
    creditAmount: number,
    financialYearId: string
  ): Promise<void> {
    const account = await tx.chartOfAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) return;

    // Balance calculation based on account type
    // Assets & Expenses: Debit increases, Credit decreases
    // Liabilities, Income & Equity: Credit increases, Debit decreases
    let balanceChange = 0;
    
    if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
      balanceChange = debitAmount - creditAmount;
    } else {
      balanceChange = creditAmount - debitAmount;
    }

    // Update current balance
    await tx.chartOfAccount.update({
      where: { id: accountId },
      data: {
        currentBalance: account.currentBalance + balanceChange,
      },
    });

    // Update ledger balance for the financial year
    const ledgerBalance = await tx.ledgerBalance.findUnique({
      where: {
        accountId_financialYearId: {
          accountId,
          financialYearId,
        },
      },
    });

    if (ledgerBalance) {
      await tx.ledgerBalance.update({
        where: { id: ledgerBalance.id },
        data: {
          totalDebits: ledgerBalance.totalDebits + debitAmount,
          totalCredits: ledgerBalance.totalCredits + creditAmount,
          closingBalance: ledgerBalance.closingBalance + balanceChange,
        },
      });
    } else {
      await tx.ledgerBalance.create({
        data: {
          accountId,
          financialYearId,
          openingBalance: 0,
          totalDebits: debitAmount,
          totalCredits: creditAmount,
          closingBalance: balanceChange,
        },
      });
    }
  }

  // ============================================
  // AUTOMATIC JOURNAL ENTRY METHODS
  // ============================================

  /**
   * LOAN DISBURSEMENT
   * Debit: Loan Principal Outstanding (Asset)
   * Credit: Bank Account (Asset)
   */
  async recordLoanDisbursement(params: {
    loanId: string;
    customerId: string;
    amount: number;
    disbursementDate: Date;
    createdById: string;
    bankAccountId?: string;
    paymentMode: string;
    reference?: string;
  }): Promise<string> {
    return this.createJournalEntry({
      entryDate: params.disbursementDate,
      referenceType: 'LOAN_DISBURSEMENT',
      referenceId: params.loanId,
      narration: `Loan disbursement - Principal: ₹${params.amount.toLocaleString()}`,
      lines: [
        {
          accountCode: ACCOUNT_CODES.LOAN_PRINCIPAL,
          debitAmount: params.amount,
          creditAmount: 0,
          loanId: params.loanId,
          customerId: params.customerId,
          narration: 'Loan principal disbursed',
        },
        {
          accountCode: ACCOUNT_CODES.BANK_ACCOUNT,
          debitAmount: 0,
          creditAmount: params.amount,
          narration: 'Payment from bank',
        },
      ],
      createdById: params.createdById,
      paymentMode: params.paymentMode,
      bankAccountId: params.bankAccountId,
      bankRefNumber: params.reference,
      isAutoEntry: true,
    });
  }

  /**
   * EMI PAYMENT
   * Splits EMI into Principal and Interest components
   * 
   * Debit: Bank Account (Asset)
   * Credit: Loan Principal Outstanding (Asset) - Principal part
   * Credit: Interest Income (Income) - Interest part
   */
  async recordEMIPayment(params: {
    loanId: string;
    customerId: string;
    paymentId: string;
    totalAmount: number;
    principalComponent: number;
    interestComponent: number;
    penaltyComponent?: number;
    paymentDate: Date;
    createdById: string;
    paymentMode: string;
    bankAccountId?: string;
    reference?: string;
  }): Promise<string> {
    const lines: Array<{
      accountCode: string;
      debitAmount: number;
      creditAmount: number;
      loanId?: string;
      customerId?: string;
      narration?: string;
    }> = [];

    // Debit Bank Account (total received)
    lines.push({
      accountCode: ACCOUNT_CODES.BANK_ACCOUNT,
      debitAmount: params.totalAmount,
      creditAmount: 0,
      narration: `EMI received - Principal: ₹${params.principalComponent.toLocaleString()}, Interest: ₹${params.interestComponent.toLocaleString()}`,
    });

    // Credit Loan Principal Outstanding (reduces asset)
    if (params.principalComponent > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.LOAN_PRINCIPAL,
        debitAmount: 0,
        creditAmount: params.principalComponent,
        loanId: params.loanId,
        customerId: params.customerId,
        narration: 'Principal repayment',
      });
    }

    // Credit Interest Income (this is income!)
    if (params.interestComponent > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.INTEREST_INCOME,
        debitAmount: 0,
        creditAmount: params.interestComponent,
        loanId: params.loanId,
        customerId: params.customerId,
        narration: 'Interest income earned',
      });
    }

    // Credit Late Fee Income (if penalty)
    if (params.penaltyComponent && params.penaltyComponent > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.LATE_FEE_INCOME,
        debitAmount: 0,
        creditAmount: params.penaltyComponent,
        loanId: params.loanId,
        customerId: params.customerId,
        narration: 'Late payment penalty',
      });
    }

    return this.createJournalEntry({
      entryDate: params.paymentDate,
      referenceType: 'EMI_PAYMENT',
      referenceId: params.paymentId,
      narration: `EMI Payment - Loan: ${params.loanId}`,
      lines,
      createdById: params.createdById,
      paymentMode: params.paymentMode,
      bankAccountId: params.bankAccountId,
      bankRefNumber: params.reference,
      isAutoEntry: true,
    });
  }

  /**
   * PROCESSING FEE COLLECTION
   * Debit: Bank Account
   * Credit: Processing Fee Income
   */
  async recordProcessingFee(params: {
    loanId: string;
    customerId: string;
    amount: number;
    collectionDate: Date;
    createdById: string;
    paymentMode: string;
    bankAccountId?: string;
    reference?: string;
  }): Promise<string> {
    return this.createJournalEntry({
      entryDate: params.collectionDate,
      referenceType: 'PROCESSING_FEE_COLLECTION',
      referenceId: params.loanId,
      narration: `Processing fee collected: ₹${params.amount.toLocaleString()}`,
      lines: [
        {
          accountCode: ACCOUNT_CODES.BANK_ACCOUNT,
          debitAmount: params.amount,
          creditAmount: 0,
          narration: 'Processing fee received',
        },
        {
          accountCode: ACCOUNT_CODES.PROCESSING_FEE_INCOME,
          debitAmount: 0,
          creditAmount: params.amount,
          loanId: params.loanId,
          customerId: params.customerId,
          narration: 'Processing fee income',
        },
      ],
      createdById: params.createdById,
      paymentMode: params.paymentMode,
      bankAccountId: params.bankAccountId,
      bankRefNumber: params.reference,
      isAutoEntry: true,
    });
  }

  /**
   * AGENT COMMISSION PAYMENT
   * Debit: Commission Paid (Expense)
   * Credit: Bank Account
   */
  async recordCommissionPayment(params: {
    agentId: string;
    loanId?: string;
    amount: number;
    paymentDate: Date;
    createdById: string;
    paymentMode: string;
    bankAccountId?: string;
    reference?: string;
  }): Promise<string> {
    return this.createJournalEntry({
      entryDate: params.paymentDate,
      referenceType: 'COMMISSION_PAYMENT',
      referenceId: params.loanId,
      narration: `Agent commission paid: ₹${params.amount.toLocaleString()}`,
      lines: [
        {
          accountCode: ACCOUNT_CODES.COMMISSION_PAID,
          debitAmount: params.amount,
          creditAmount: 0,
          loanId: params.loanId,
          narration: 'Commission expense',
        },
        {
          accountCode: ACCOUNT_CODES.BANK_ACCOUNT,
          debitAmount: 0,
          creditAmount: params.amount,
          narration: 'Commission payment',
        },
      ],
      createdById: params.createdById,
      paymentMode: params.paymentMode,
      bankAccountId: params.bankAccountId,
      bankRefNumber: params.reference,
      isAutoEntry: true,
    });
  }

  /**
   * EXPENSE ENTRY
   * Debit: Expense Account
   * Credit: Bank Account or Payables
   */
  async recordExpense(params: {
    expenseId: string;
    expenseType: string;
    expenseAccountCode: string;
    amount: number;
    description: string;
    expenseDate: Date;
    createdById: string;
    paymentMode: string;
    bankAccountId?: string;
    reference?: string;
    isPayable?: boolean;
  }): Promise<string> {
    const lines: Array<{
      accountCode: string;
      debitAmount: number;
      creditAmount: number;
      narration?: string;
    }> = [];

    // Debit Expense Account
    lines.push({
      accountCode: params.expenseAccountCode,
      debitAmount: params.amount,
      creditAmount: 0,
      narration: params.description,
    });

    // Credit Bank or Payables
    if (params.isPayable) {
      lines.push({
        accountCode: ACCOUNT_CODES.PAYABLES,
        debitAmount: 0,
        creditAmount: params.amount,
        narration: 'Expense payable',
      });
    } else {
      lines.push({
        accountCode: ACCOUNT_CODES.BANK_ACCOUNT,
        debitAmount: 0,
        creditAmount: params.amount,
        narration: 'Expense paid',
      });
    }

    return this.createJournalEntry({
      entryDate: params.expenseDate,
      referenceType: 'EXPENSE_ENTRY',
      referenceId: params.expenseId,
      narration: `Expense: ${params.description} - ₹${params.amount.toLocaleString()}`,
      lines,
      createdById: params.createdById,
      paymentMode: params.paymentMode,
      bankAccountId: params.bankAccountId,
      bankRefNumber: params.reference,
      isAutoEntry: true,
    });
  }

  /**
   * FORECLOSURE SETTLEMENT
   * Debit: Bank Account (total received)
   * Credit: Loan Principal Outstanding (remaining principal)
   * Credit: Interest Income (pending interest)
   * Credit: Foreclosure Charges Income (foreclosure fee)
   */
  async recordForeclosure(params: {
    loanId: string;
    customerId: string;
    foreclosureId: string;
    outstandingPrincipal: number;
    pendingInterest: number;
    foreclosureCharges: number;
    totalSettlement: number;
    settlementDate: Date;
    createdById: string;
    paymentMode: string;
    bankAccountId?: string;
    reference?: string;
  }): Promise<string> {
    const lines: Array<{
      accountCode: string;
      debitAmount: number;
      creditAmount: number;
      loanId?: string;
      customerId?: string;
      narration?: string;
    }> = [];

    // Debit Bank (total received)
    lines.push({
      accountCode: ACCOUNT_CODES.BANK_ACCOUNT,
      debitAmount: params.totalSettlement,
      creditAmount: 0,
      narration: 'Foreclosure settlement received',
    });

    // Credit Loan Principal (reduces outstanding)
    if (params.outstandingPrincipal > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.LOAN_PRINCIPAL,
        debitAmount: 0,
        creditAmount: params.outstandingPrincipal,
        loanId: params.loanId,
        customerId: params.customerId,
        narration: 'Principal settlement',
      });
    }

    // Credit Interest Income
    if (params.pendingInterest > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.INTEREST_INCOME,
        debitAmount: 0,
        creditAmount: params.pendingInterest,
        loanId: params.loanId,
        customerId: params.customerId,
        narration: 'Interest income',
      });
    }

    // Credit Foreclosure Charges Income
    if (params.foreclosureCharges > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.FORECLOSURE_INCOME,
        debitAmount: 0,
        creditAmount: params.foreclosureCharges,
        loanId: params.loanId,
        customerId: params.customerId,
        narration: 'Foreclosure charges',
      });
    }

    return this.createJournalEntry({
      entryDate: params.settlementDate,
      referenceType: 'FORECLOSURE',
      referenceId: params.foreclosureId,
      narration: `Loan Foreclosure - Total: ₹${params.totalSettlement.toLocaleString()}`,
      lines,
      createdById: params.createdById,
      paymentMode: params.paymentMode,
      bankAccountId: params.bankAccountId,
      bankRefNumber: params.reference,
      isAutoEntry: true,
    });
  }

  // ============================================
  // REPORTING METHODS
  // ============================================

  /**
   * Get Trial Balance
   */
  async getTrialBalance(asOfDate?: Date): Promise<Array<{
    accountCode: string;
    accountName: string;
    accountType: string;
    debitBalance: number;
    creditBalance: number;
  }>> {
    const accounts = await db.chartOfAccount.findMany({
      where: { companyId: this.companyId, isActive: true },
      orderBy: { accountCode: 'asc' },
    });

    return accounts.map(account => {
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
  }

  /**
   * Get Profit & Loss Statement
   */
  async getProfitAndLoss(startDate: Date, endDate: Date): Promise<{
    income: Array<{ accountCode: string; accountName: string; amount: number }>;
    expenses: Array<{ accountCode: string; accountName: string; amount: number }>;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  }> {
    const incomeAccounts = await db.chartOfAccount.findMany({
      where: { companyId: this.companyId, accountType: 'INCOME', isActive: true },
    });

    const expenseAccounts = await db.chartOfAccount.findMany({
      where: { companyId: this.companyId, accountType: 'EXPENSE', isActive: true },
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

    return {
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
    };
  }

  /**
   * Get Balance Sheet
   */
  async getBalanceSheet(asOfDate: Date): Promise<{
    assets: Array<{ accountCode: string; accountName: string; amount: number }>;
    liabilities: Array<{ accountCode: string; accountName: string; amount: number }>;
    equity: Array<{ accountCode: string; accountName: string; amount: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  }> {
    const assetAccounts = await db.chartOfAccount.findMany({
      where: { companyId: this.companyId, accountType: 'ASSET', isActive: true },
    });

    const liabilityAccounts = await db.chartOfAccount.findMany({
      where: { companyId: this.companyId, accountType: 'LIABILITY', isActive: true },
    });

    const equityAccounts = await db.chartOfAccount.findMany({
      where: { companyId: this.companyId, accountType: 'EQUITY', isActive: true },
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

    return {
      assets,
      liabilities,
      equity,
      totalAssets: assets.reduce((sum, acc) => sum + acc.amount, 0),
      totalLiabilities: liabilities.reduce((sum, acc) => sum + acc.amount, 0),
      totalEquity: equity.reduce((sum, acc) => sum + acc.amount, 0),
    };
  }

  /**
   * Get Loan Portfolio Report
   */
  async getLoanPortfolioReport(): Promise<{
    totalDisbursed: number;
    totalOutstanding: number;
    totalInterestAccrued: number;
    totalInterestCollected: number;
    npaAmount: number;
    overdueAmount: number;
  }> {
    // Get totals from chart of accounts
    const loanPrincipalAccount = await db.chartOfAccount.findFirst({
      where: { companyId: this.companyId, accountCode: ACCOUNT_CODES.LOAN_PRINCIPAL },
    });

    const interestReceivableAccount = await db.chartOfAccount.findFirst({
      where: { companyId: this.companyId, accountCode: ACCOUNT_CODES.INTEREST_RECEIVABLE },
    });

    const interestIncomeAccount = await db.chartOfAccount.findFirst({
      where: { companyId: this.companyId, accountCode: ACCOUNT_CODES.INTEREST_INCOME },
    });

    // Calculate from journal entries for more accuracy
    const disbursementEntries = await db.journalEntry.aggregate({
      where: {
        companyId: this.companyId,
        referenceType: 'LOAN_DISBURSEMENT',
      },
      _sum: { totalCredit: true },
    });

    return {
      totalDisbursed: disbursementEntries._sum.totalCredit || 0,
      totalOutstanding: loanPrincipalAccount?.currentBalance || 0,
      totalInterestAccrued: interestReceivableAccount?.currentBalance || 0,
      totalInterestCollected: interestIncomeAccount?.currentBalance || 0,
      npaAmount: 0, // Calculate from NPA tracking
      overdueAmount: 0, // Calculate from EMI schedules
    };
  }

  /**
   * Get Journal Entries with filters
   */
  async getJournalEntries(params: {
    startDate?: Date;
    endDate?: Date;
    referenceType?: string;
    accountId?: string;
    loanId?: string;
    customerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    entries: Array<any>;
    total: number;
  }> {
    const where: any = { companyId: this.companyId, isReversed: false };

    if (params.startDate && params.endDate) {
      where.entryDate = {
        gte: params.startDate,
        lte: params.endDate,
      };
    }

    if (params.referenceType) {
      where.referenceType = params.referenceType;
    }

    if (params.loanId || params.customerId) {
      where.lines = {
        some: {},
      };
      if (params.loanId) where.lines.some.loanId = params.loanId;
      if (params.customerId) where.lines.some.customerId = params.customerId;
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
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      db.journalEntry.count({ where }),
    ]);

    return { entries, total };
  }

  /**
   * Get Account Ledger (Account Statement)
   */
  async getAccountLedger(accountId: string, startDate?: Date, endDate?: Date): Promise<Array<{
    date: Date;
    entryNumber: string;
    narration: string;
    debit: number;
    credit: number;
    balance: number;
    referenceType?: string;
    referenceId?: string;
  }>> {
    const where: any = {
      accountId,
      journalEntry: { companyId: this.companyId, isReversed: false },
    };

    if (startDate && endDate) {
      where.journalEntry.entryDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const lines = await db.journalEntryLine.findMany({
      where,
      include: {
        journalEntry: true,
        account: true,
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    let runningBalance = 0;
    const account = lines[0]?.account;

    return lines.map(line => {
      // Calculate running balance based on account type
      if (account?.accountType === 'ASSET' || account?.accountType === 'EXPENSE') {
        runningBalance += line.debitAmount - line.creditAmount;
      } else {
        runningBalance += line.creditAmount - line.debitAmount;
      }

      return {
        date: line.journalEntry.entryDate,
        entryNumber: line.journalEntry.entryNumber,
        narration: line.narration || line.journalEntry.narration || '',
        debit: line.debitAmount,
        credit: line.creditAmount,
        balance: runningBalance,
        referenceType: line.journalEntry.referenceType || undefined,
        referenceId: line.journalEntry.referenceId || undefined,
      };
    });
  }

  /**
   * Get Customer Ledger (All transactions for a customer)
   */
  async getCustomerLedger(customerId: string, startDate?: Date, endDate?: Date): Promise<{
    entries: Array<any>;
    summary: {
      totalDisbursed: number;
      totalRepaid: number;
      outstandingPrincipal: number;
      totalInterestCharged: number;
      totalInterestPaid: number;
    };
  }> {
    const { entries } = await this.getJournalEntries({
      customerId,
      startDate,
      endDate,
      limit: 1000,
    });

    // Calculate summary
    let totalDisbursed = 0;
    let totalRepaid = 0;
    let totalInterestCharged = 0;
    let totalInterestPaid = 0;

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.account?.accountCode === ACCOUNT_CODES.LOAN_PRINCIPAL) {
          if (line.debitAmount > 0) totalDisbursed += line.debitAmount;
          if (line.creditAmount > 0) totalRepaid += line.creditAmount;
        }
        if (line.account?.accountCode === ACCOUNT_CODES.INTEREST_INCOME) {
          totalInterestCharged += line.creditAmount;
        }
      }
    }

    return {
      entries,
      summary: {
        totalDisbursed,
        totalRepaid,
        outstandingPrincipal: totalDisbursed - totalRepaid,
        totalInterestCharged,
        totalInterestPaid: totalInterestCharged, // Simplified
      },
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function getAccountTypeName(type: string): string {
  const names: Record<string, string> = {
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    INCOME: 'Income',
    EXPENSE: 'Expenses',
    EQUITY: 'Equity',
  };
  return names[type] || type;
}

// ============================================
// STANDALONE HELPER FUNCTIONS FOR API INTEGRATION
// These can be called directly from API routes
// ============================================

/**
 * Create journal entry for loan disbursement
 * Called when Cashier disburses a loan
 */
export async function createLoanDisbursementEntry(params: {
  loanId: string;
  customerId: string;
  amount: number;
  disbursementDate: Date;
  createdById: string;
  bankAccountId?: string;
  paymentMode?: string;
  reference?: string;
}): Promise<string> {
  // Get company ID from the loan
  const loan = await db.loanApplication.findUnique({
    where: { id: params.loanId },
    select: { companyId: true }
  });
  
  if (!loan?.companyId) {
    throw new Error('Loan company not found');
  }
  
  const accountingService = new AccountingService(loan.companyId);
  
  // Initialize chart of accounts if needed
  await accountingService.initializeChartOfAccounts();
  
  return accountingService.recordLoanDisbursement({
    loanId: params.loanId,
    customerId: params.customerId,
    amount: params.amount,
    disbursementDate: params.disbursementDate,
    createdById: params.createdById,
    paymentMode: params.paymentMode || 'BANK_TRANSFER',
    bankAccountId: params.bankAccountId,
    reference: params.reference
  });
}

/**
 * Create journal entry for EMI payment collection
 * Called when any role collects an EMI payment
 */
export async function createEMIPaymentEntry(params: {
  loanId: string;
  customerId: string;
  paymentId: string;
  totalAmount: number;
  principalComponent: number;
  interestComponent: number;
  penaltyComponent?: number;
  paymentDate: Date;
  createdById: string;
  paymentMode: string;
  bankAccountId?: string;
  reference?: string;
}): Promise<string> {
  // Get company ID from the loan
  const loan = await db.loanApplication.findUnique({
    where: { id: params.loanId },
    select: { companyId: true }
  });
  
  if (!loan?.companyId) {
    throw new Error('Loan company not found');
  }
  
  const accountingService = new AccountingService(loan.companyId);
  
  // Initialize chart of accounts if needed
  await accountingService.initializeChartOfAccounts();
  
  return accountingService.recordEMIPayment({
    loanId: params.loanId,
    customerId: params.customerId,
    paymentId: params.paymentId,
    totalAmount: params.totalAmount,
    principalComponent: params.principalComponent,
    interestComponent: params.interestComponent,
    penaltyComponent: params.penaltyComponent,
    paymentDate: params.paymentDate,
    createdById: params.createdById,
    paymentMode: params.paymentMode,
    bankAccountId: params.bankAccountId,
    reference: params.reference
  });
}

/**
 * Create journal entry for foreclosure
 * Called when a loan is foreclosed
 */
export async function createForeclosureEntry(params: {
  loanId: string;
  customerId: string;
  principalAmount: number;
  interestAmount: number;
  foreclosureCharges: number;
  foreclosureDate: Date;
  createdById: string;
  paymentMode?: string;
  bankAccountId?: string;
  reference?: string;
}): Promise<string> {
  // Get company ID from the loan
  const loan = await db.loanApplication.findUnique({
    where: { id: params.loanId },
    select: { companyId: true }
  });
  
  if (!loan?.companyId) {
    throw new Error('Loan company not found');
  }
  
  const accountingService = new AccountingService(loan.companyId);
  
  // Initialize chart of accounts if needed
  await accountingService.initializeChartOfAccounts();
  
  const totalSettlement = params.principalAmount + params.interestAmount + params.foreclosureCharges;
  
  return accountingService.recordForeclosure({
    loanId: params.loanId,
    customerId: params.customerId,
    foreclosureId: `FORECLOSE-${params.loanId}-${Date.now()}`,
    outstandingPrincipal: params.principalAmount,
    pendingInterest: params.interestAmount,
    foreclosureCharges: params.foreclosureCharges,
    totalSettlement,
    settlementDate: params.foreclosureDate,
    createdById: params.createdById,
    paymentMode: params.paymentMode || 'BANK_TRANSFER',
    bankAccountId: params.bankAccountId,
    reference: params.reference
  });
}

/**
 * Create journal entry for processing fee collection
 * Called when processing fee is collected
 */
export async function createProcessingFeeEntry(params: {
  loanId: string;
  customerId: string;
  amount: number;
  collectionDate: Date;
  createdById: string;
  paymentMode?: string;
  bankAccountId?: string;
  reference?: string;
}): Promise<string> {
  // Get company ID from the loan
  const loan = await db.loanApplication.findUnique({
    where: { id: params.loanId },
    select: { companyId: true }
  });
  
  if (!loan?.companyId) {
    throw new Error('Loan company not found');
  }
  
  const accountingService = new AccountingService(loan.companyId);
  
  // Initialize chart of accounts if needed
  await accountingService.initializeChartOfAccounts();
  
  return accountingService.recordProcessingFee({
    loanId: params.loanId,
    customerId: params.customerId,
    amount: params.amount,
    collectionDate: params.collectionDate,
    createdById: params.createdById,
    paymentMode: params.paymentMode || 'CASH',
    bankAccountId: params.bankAccountId,
    reference: params.reference
  });
}

/**
 * Create journal entry for expense recording
 * Called when any expense is recorded
 */
export async function createExpenseEntry(params: {
  companyId: string;
  expenseId: string;
  expenseType: string;
  amount: number;
  description: string;
  expenseDate: Date;
  createdById: string;
  paymentMode: string;
  bankAccountId?: string;
  reference?: string;
}): Promise<string> {
  const accountingService = new AccountingService(params.companyId);
  
  // Initialize chart of accounts if needed
  await accountingService.initializeChartOfAccounts();
  
  // Map expense type to account code
  const expenseCodeMap: Record<string, string> = {
    'SALARY': '4000',
    'RENT': '4100',
    'MARKETING': '4200',
    'COMMISSION': '4300',
    'SOFTWARE': '4400',
    'BANK_CHARGES': '4500',
    'UTILITIES': '4600',
    'TRAVEL': '4700',
    'MISCELLANEOUS': '4800',
    'OTHER': '4800'
  };
  
  const expenseAccountCode = expenseCodeMap[params.expenseType.toUpperCase()] || '4800';
  
  return accountingService.recordExpense({
    expenseId: params.expenseId,
    expenseType: params.expenseType,
    expenseAccountCode,
    amount: params.amount,
    description: params.description,
    expenseDate: params.expenseDate,
    createdById: params.createdById,
    paymentMode: params.paymentMode,
    bankAccountId: params.bankAccountId,
    reference: params.reference
  });
}

/**
 * Create journal entry for settlement (money transfer between roles)
 * When money moves from Agent/Staff to Cashier
 */
export async function createSettlementEntry(params: {
  companyId: string;
  settlementId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  paymentMode: string;
  settlementDate: Date;
  createdById: string;
  reference?: string;
}): Promise<string> {
  const accountingService = new AccountingService(params.companyId);
  
  // Initialize chart of accounts if needed
  await accountingService.initializeChartOfAccounts();
  
  // Get entry number
  const entryNumber = await accountingService.generateEntryNumber();
  const financialYearId = await accountingService.getCurrentFinancialYear();
  
  // Create a manual journal entry for the settlement
  return accountingService.createJournalEntry({
    entryDate: params.settlementDate,
    referenceType: 'BANK_TRANSFER',
    referenceId: params.settlementId,
    narration: `Settlement transfer - ₹${params.amount.toLocaleString()}`,
    lines: [
      {
        accountCode: ACCOUNT_CODES.CASH_ACCOUNT,
        debitAmount: params.amount,
        creditAmount: 0,
        narration: 'Cash received from settlement'
      },
      {
        accountCode: ACCOUNT_CODES.BANK_ACCOUNT,
        debitAmount: 0,
        creditAmount: params.amount,
        narration: 'Settlement transfer'
      }
    ],
    createdById: params.createdById,
    paymentMode: params.paymentMode,
    bankRefNumber: params.reference,
    isAutoEntry: true
  });
}

/**
 * Create journal entry for credit increase (when someone deposits money)
 */
export async function createCreditDepositEntry(params: {
  companyId: string;
  userId: string;
  amount: number;
  paymentMode: string;
  depositDate: Date;
  createdById: string;
  description?: string;
  reference?: string;
}): Promise<string> {
  const accountingService = new AccountingService(params.companyId);
  
  // Initialize chart of accounts if needed
  await accountingService.initializeChartOfAccounts();
  
  return accountingService.createJournalEntry({
    entryDate: params.depositDate,
    referenceType: 'CASH_DEPOSIT',
    narration: params.description || `Credit deposit by user - ₹${params.amount.toLocaleString()}`,
    lines: [
      {
        accountCode: ACCOUNT_CODES.BANK_ACCOUNT,
        debitAmount: params.amount,
        creditAmount: 0,
        narration: 'Cash/Bank deposit received'
      },
      {
        accountCode: ACCOUNT_CODES.INVESTOR_CAPITAL,
        debitAmount: 0,
        creditAmount: params.amount,
        narration: 'Capital contribution'
      }
    ],
    createdById: params.createdById,
    paymentMode: params.paymentMode,
    bankRefNumber: params.reference,
    isAutoEntry: true
  });
}

/**
 * Get all journal entries for a company (for accountant portal)
 */
export async function getAllJournalEntries(params: {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
  referenceType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: any[]; total: number }> {
  const accountingService = new AccountingService(params.companyId);
  return accountingService.getJournalEntries({
    startDate: params.startDate,
    endDate: params.endDate,
    referenceType: params.referenceType,
    limit: params.limit || 100,
    offset: params.offset || 0
  });
}

/**
 * Initialize accounting for a new company
 */
export async function initializeCompanyAccounting(companyId: string): Promise<void> {
  const accountingService = new AccountingService(companyId);
  await accountingService.initializeChartOfAccounts();
  await accountingService.getCurrentFinancialYear();
}
