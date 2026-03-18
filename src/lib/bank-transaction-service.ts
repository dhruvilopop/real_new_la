/**
 * BANK TRANSACTION SERVICE
 * Money Mitra Loan Management System
 * v2.0 - Fixed Prisma relation issue
 * 
 * This service handles all bank transactions ensuring:
 * 1. BankAccount.currentBalance is updated in real-time
 * 2. BankTransaction log is created for audit trail
 * 3. JournalEntry is created for double-entry bookkeeping
 * 
 * All three happen in a single transaction for data integrity.
 */

import { db } from './db';
import { AccountingService, ACCOUNT_CODES, JournalEntryType } from './accounting-service';

// Transaction types
export type BankTransactionType = 
  | 'LOAN_DISBURSEMENT'    // Money going out for loan
  | 'EMI_PAYMENT'          // Money coming in from EMI
  | 'PROCESSING_FEE'       // Money coming in from processing fee
  | 'EXPENSE'              // Money going out for expenses
  | 'DEPOSIT'              // Money added to bank
  | 'WITHDRAWAL'           // Money taken from bank
  | 'INTEREST_INCOME'      // Interest collected
  | 'PENALTY'              // Late fee/penalty collected
  | 'COMMISSION_PAID'      // Agent commission paid
  | 'TRANSFER_IN'          // Transfer from another account
  | 'TRANSFER_OUT'         // Transfer to another account
  | 'OPENING_BALANCE';     // Initial balance setup

export interface BankTransactionParams {
  bankAccountId: string;
  transactionType: BankTransactionType;
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdById: string;
  transactionDate?: Date;
  // For journal entry
  companyId: string;
  loanId?: string;
  customerId?: string;
  // For EMI payments
  principalComponent?: number;
  interestComponent?: number;
  penaltyComponent?: number;
  // Additional details
  paymentMode?: string;
  chequeNumber?: string;
  bankRefNumber?: string;
}

export interface BankTransactionResult {
  bankTransactionId: string;
  journalEntryId: string;
  balanceAfter: number;
}

/**
 * Process a bank transaction with full double-entry bookkeeping
 */
export async function processBankTransaction(params: BankTransactionParams): Promise<BankTransactionResult> {
  const {
    bankAccountId,
    transactionType,
    amount,
    description,
    referenceType,
    referenceId,
    createdById,
    transactionDate = new Date(),
    companyId,
    loanId,
    customerId,
    principalComponent,
    interestComponent,
    penaltyComponent,
    paymentMode = 'BANK_TRANSFER',
    chequeNumber,
    bankRefNumber
  } = params;

  // Determine if money is coming in (CREDIT) or going out (DEBIT)
  const isCredit = ['EMI_PAYMENT', 'PROCESSING_FEE', 'DEPOSIT', 'INTEREST_INCOME', 'PENALTY', 'TRANSFER_IN', 'OPENING_BALANCE'].includes(transactionType);
  
  const result = await db.$transaction(async (tx) => {
    // 1. Get current bank account
    const bankAccount = await tx.bankAccount.findUnique({
      where: { id: bankAccountId }
    });

    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    // 2. Calculate new balance
    const newBalance = isCredit 
      ? bankAccount.currentBalance + amount 
      : bankAccount.currentBalance - amount;

    // 3. Update bank account balance
    await tx.bankAccount.update({
      where: { id: bankAccountId },
      data: { 
        currentBalance: newBalance,
        updatedAt: new Date()
      }
    });

    // 4. Create bank transaction record
    const bankTransaction = await tx.bankTransaction.create({
      data: {
        bankAccountId,
        transactionType: isCredit ? 'CREDIT' : 'DEBIT',
        amount,
        balanceAfter: newBalance,
        description,
        referenceType: transactionType,
        referenceId,
        createdById,
        transactionDate
      }
    });

    // 5. Create journal entry using accounting service
    const accountingService = new AccountingService(companyId);
    await accountingService.initializeChartOfAccounts();
    
    let journalEntryId: string;

    // Create journal entry based on transaction type
    switch (transactionType) {
      case 'LOAN_DISBURSEMENT':
        journalEntryId = await accountingService.recordLoanDisbursement({
          loanId: loanId!,
          customerId: customerId!,
          amount,
          disbursementDate: transactionDate,
          createdById,
          paymentMode,
          bankAccountId,
          reference: bankRefNumber
        });
        break;

      case 'EMI_PAYMENT':
        journalEntryId = await accountingService.recordEMIPayment({
          loanId: loanId!,
          customerId: customerId!,
          paymentId: referenceId || 'OFFLINE_PAYMENT',
          totalAmount: amount,
          principalComponent: principalComponent || 0,
          interestComponent: interestComponent || 0,
          penaltyComponent: penaltyComponent || 0,
          paymentDate: transactionDate,
          createdById,
          paymentMode,
          bankAccountId,
          reference: bankRefNumber
        });
        break;

      case 'PROCESSING_FEE':
        journalEntryId = await accountingService.recordProcessingFee({
          loanId: loanId!,
          customerId: customerId!,
          amount,
          collectionDate: transactionDate,
          createdById,
          paymentMode,
          bankAccountId,
          reference: bankRefNumber
        });
        break;

      case 'DEPOSIT':
      case 'OPENING_BALANCE':
        journalEntryId = await accountingService.createJournalEntry({
          entryDate: transactionDate,
          referenceType: 'OPENING_BALANCE',
          narration: description,
          lines: [
            { accountCode: ACCOUNT_CODES.BANK_ACCOUNT, debitAmount: amount, creditAmount: 0 },
            { accountCode: ACCOUNT_CODES.INVESTOR_CAPITAL, debitAmount: 0, creditAmount: amount }
          ],
          createdById,
          paymentMode,
          bankAccountId,
          bankRefNumber
        });
        break;

      case 'EXPENSE':
        journalEntryId = await accountingService.recordExpense({
          expenseId: referenceId || 'EXPENSE',
          expenseType: referenceType || 'MISCELLANEOUS',
          expenseAccountCode: ACCOUNT_CODES.STAFF_SALARY, // Default, should be passed
          amount,
          description,
          expenseDate: transactionDate,
          createdById,
          paymentMode,
          bankAccountId,
          reference: bankRefNumber
        });
        break;

      default:
        // Generic journal entry
        journalEntryId = await accountingService.createJournalEntry({
          entryDate: transactionDate,
          referenceType: (referenceType || 'MANUAL_ENTRY') as JournalEntryType,
          referenceId,
          narration: description,
          lines: isCredit ? [
            { accountCode: ACCOUNT_CODES.BANK_ACCOUNT, debitAmount: amount, creditAmount: 0 },
            { accountCode: ACCOUNT_CODES.OTHER_INCOME, debitAmount: 0, creditAmount: amount }
          ] : [
            { accountCode: ACCOUNT_CODES.PAYABLES, debitAmount: amount, creditAmount: 0 },
            { accountCode: ACCOUNT_CODES.BANK_ACCOUNT, debitAmount: 0, creditAmount: amount }
          ],
          createdById,
          paymentMode,
          bankAccountId,
          bankRefNumber
        });
    }

    return {
      bankTransactionId: bankTransaction.id,
      journalEntryId,
      balanceAfter: newBalance
    };
  });

  return result;
}

/**
 * Get bank account summary with all transactions
 */
export async function getBankAccountSummary(bankAccountId: string) {
  const bankAccount = await db.bankAccount.findUnique({
    where: { id: bankAccountId },
    include: {
      transactions: {
        orderBy: { transactionDate: 'desc' },
        take: 100
      }
    }
  });

  if (!bankAccount) {
    throw new Error('Bank account not found');
  }

  // Calculate totals
  const totalCredits = bankAccount.transactions
    .filter(t => t.transactionType === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebits = bankAccount.transactions
    .filter(t => t.transactionType === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    ...bankAccount,
    totalCredits,
    totalDebits,
    netFlow: totalCredits - totalDebits
  };
}

/**
 * Get all bank accounts summary for a company
 * If companyId is 'default' or null/undefined, fetch ALL bank accounts (ecosystem-wide)
 */
export async function getAllBankAccountsSummary(companyId: string | null | undefined) {
  // Determine if we should fetch ecosystem-wide (for accountant/cashier without company assignment)
  const isEcosystemWide = !companyId || companyId === 'default' || companyId === 'null';
  
  // Get bank accounts - if ecosystem-wide, get ALL bank accounts from ALL companies
  const bankAccounts = await db.bankAccount.findMany({
    where: isEcosystemWide 
      ? { isActive: true } 
      : { companyId, isActive: true },
    orderBy: { isDefault: 'desc' }
  });

  // Get all transactions for these accounts
  const bankAccountIds = bankAccounts.map(a => a.id);
  const allTransactions = await db.bankTransaction.findMany({
    where: { bankAccountId: { in: bankAccountIds } },
    orderBy: { transactionDate: 'desc' }
  });

  const summary = bankAccounts.map(account => {
    const accountTransactions = allTransactions.filter(t => t.bankAccountId === account.id);
    
    const totalCredits = accountTransactions
      .filter(t => t.transactionType === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = accountTransactions
      .filter(t => t.transactionType === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      ...account,
      transactions: accountTransactions.slice(0, 10),
      totalCredits,
      totalDebits,
      netFlow: totalCredits - totalDebits,
      transactionCount: accountTransactions.length
    };
  });

  const totalBalance = summary.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalCreditsAll = summary.reduce((sum, a) => sum + a.totalCredits, 0);
  const totalDebitsAll = summary.reduce((sum, a) => sum + a.totalDebits, 0);

  return {
    accounts: summary,
    totals: {
      totalBalance,
      totalCredits: totalCreditsAll,
      totalDebits: totalDebitsAll,
      netFlow: totalCreditsAll - totalDebitsAll
    }
  };
}

/**
 * Sync existing loan transactions to bank transactions
 * This is useful for migrating existing data
 */
export async function syncExistingLoanTransactions(companyId: string) {
  // Get default bank account
  const defaultBank = await db.bankAccount.findFirst({
    where: { companyId, isDefault: true }
  });

  if (!defaultBank) {
    // Create default bank account if none exists
    const newBank = await db.bankAccount.create({
      data: {
        companyId,
        bankName: 'Primary Bank Account',
        accountNumber: 'PRIMARY',
        accountName: 'Primary Account',
        accountType: 'CURRENT',
        openingBalance: 0,
        currentBalance: 0,
        isDefault: true,
        isActive: true
      }
    });
    return { message: 'Created default bank account', bankId: newBank.id };
  }

  // Get all loan disbursements
  const disbursedLoans = await db.loanApplication.findMany({
    where: { 
      companyId, 
      status: { in: ['ACTIVE', 'DISBURSED'] },
      disbursedAt: { not: null }
    }
  });

  // Get all EMI payments
  const payments = await db.payment.findMany({
    where: { 
      status: 'COMPLETED',
      loanApplication: { companyId }
    },
    include: { loanApplication: true }
  });

  // Get offline loan EMIs
  const offlineEmis = await db.offlineLoanEMI.findMany({
    where: { 
      paymentStatus: 'PAID',
      offlineLoan: { companyId }
    },
    include: { offlineLoan: true }
  });

  return {
    disbursedLoans: disbursedLoans.length,
    payments: payments.length,
    offlineEmis: offlineEmis.length,
    message: 'Sync data prepared. Manual processing required for migration.'
  };
}
