import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all money-related logs (EMI, Credits, Transactions)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // 'emi', 'credit', 'disbursement', 'all'
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const moneyLogs: any[] = [];

    // 1. Fetch EMI Payments from CreditTransaction
    if (!type || type === 'all' || type === 'emi') {
      const emiTransactions = await db.creditTransaction.findMany({
        where: {
          ...dateFilter,
          sourceType: 'EMI_PAYMENT'
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });

      emiTransactions.forEach((t) => {
        moneyLogs.push({
          id: t.id,
          type: 'EMI_PAYMENT',
          category: 'EMI Collection',
          amount: t.amount,
          paymentMode: t.paymentMode,
          creditType: t.creditType,
          description: t.description || `EMI Payment - Installment #${t.installmentNumber}`,
          customerName: t.customerName,
          customerPhone: t.customerPhone,
          loanApplicationNo: t.loanApplicationNo,
          emiDueDate: t.emiDueDate,
          emiAmount: t.emiAmount,
          principalComponent: t.principalComponent,
          interestComponent: t.interestComponent,
          companyBalanceAfter: t.companyBalanceAfter,
          personalBalanceAfter: t.personalBalanceAfter,
          chequeNumber: t.chequeNumber,
          utrNumber: t.utrNumber,
          bankRefNumber: t.bankRefNumber,
          collectedFrom: t.collectedFrom,
          collectionLocation: t.collectionLocation,
          transactionDate: t.transactionDate,
          createdAt: t.createdAt,
          createdBy: t.user
        });
      });
    }

    // 2. Fetch Credit Transactions (Add, Deduct, Transfer)
    if (!type || type === 'all' || type === 'credit') {
      const creditTransactions = await db.creditTransaction.findMany({
        where: {
          ...dateFilter,
          sourceType: { not: 'EMI_PAYMENT' }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });

      creditTransactions.forEach((t) => {
        const category = t.transactionType === 'CREDIT_INCREASE' ? 'Credit Added' :
                        t.transactionType === 'CREDIT_DECREASE' ? 'Credit Deducted' :
                        t.transactionType === 'PERSONAL_COLLECTION' ? 'Personal Collection' :
                        t.transactionType === 'SETTLEMENT' ? 'Settlement' :
                        'Credit Transfer';
        
        moneyLogs.push({
          id: t.id,
          type: t.transactionType,
          category: category,
          amount: t.amount,
          paymentMode: t.paymentMode,
          creditType: t.creditType,
          sourceType: t.sourceType,
          description: t.description || `${category} - ${t.creditType || 'General'}`,
          customerName: t.customerName,
          customerPhone: t.customerPhone,
          loanApplicationNo: t.loanApplicationNo,
          companyBalanceAfter: t.companyBalanceAfter,
          personalBalanceAfter: t.personalBalanceAfter,
          chequeNumber: t.chequeNumber,
          utrNumber: t.utrNumber,
          bankRefNumber: t.bankRefNumber,
          transactionDate: t.transactionDate,
          createdAt: t.createdAt,
          createdBy: t.user
        });
      });
    }

    // 3. Fetch Loan Disbursements
    if (!type || type === 'all' || type === 'disbursement') {
      const disbursedLoans = await db.loanApplication.findMany({
        where: {
          ...dateFilter,
          status: { in: ['DISBURSED', 'ACTIVE'] },
          disbursedAmount: { not: null }
        },
        orderBy: { disbursedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          company: { select: { id: true, name: true } },
          disbursedBy: { select: { id: true, name: true, email: true, role: true } }
        }
      });

      disbursedLoans.forEach((loan) => {
        moneyLogs.push({
          id: loan.id,
          type: 'LOAN_DISBURSEMENT',
          category: 'Loan Disbursement',
          amount: loan.disbursedAmount || 0,
          description: `Loan Disbursement - ${loan.applicationNo}`,
          customerName: loan.customer?.name,
          customerPhone: loan.customer?.phone,
          loanApplicationNo: loan.applicationNo,
          companyName: loan.company?.name,
          disbursementMode: loan.disbursementMode,
          disbursementRef: loan.disbursementRef,
          transactionDate: loan.disbursedAt,
          createdAt: loan.disbursedAt,
          createdBy: loan.disbursedBy
        });
      });

      // Also fetch offline loan disbursements
      const offlineLoans = await db.offlineLoan.findMany({
        where: {
          ...dateFilter,
          status: 'ACTIVE'
        },
        orderBy: { disbursementDate: 'desc' },
        take: limit,
        skip: offset,
        include: {
          company: { select: { id: true, name: true } }
        }
      });

      offlineLoans.forEach((loan) => {
        moneyLogs.push({
          id: loan.id,
          type: 'OFFLINE_LOAN_DISBURSEMENT',
          category: 'Offline Loan Disbursement',
          amount: loan.loanAmount,
          description: `Offline Loan Disbursement - ${loan.loanNumber}`,
          customerName: loan.customerName,
          customerPhone: loan.customerPhone,
          loanApplicationNo: loan.loanNumber,
          companyName: loan.company?.name,
          disbursementMode: loan.disbursementMode,
          disbursementRef: loan.disbursementRef,
          transactionDate: loan.disbursementDate,
          createdAt: loan.createdAt
        });
      });
    }

    // 4. Fetch Bank Transactions
    if (!type || type === 'all' || type === 'bank') {
      const bankTransactions = await db.bankTransaction.findMany({
        where: dateFilter,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          bankAccount: { select: { id: true, bankName: true, accountNumber: true } }
        }
      });

      bankTransactions.forEach((t) => {
        moneyLogs.push({
          id: t.id,
          type: 'BANK_TRANSACTION',
          category: t.transactionType === 'CREDIT' ? 'Bank Credit' : 'Bank Debit',
          amount: t.amount,
          description: t.description,
          balanceAfter: t.balanceAfter,
          referenceType: t.referenceType,
          bankName: t.bankAccount?.bankName,
          accountNumber: t.bankAccount?.accountNumber,
          transactionDate: t.transactionDate,
          createdAt: t.createdAt
        });
      });
    }

    // 5. Fetch Expenses
    if (!type || type === 'all' || type === 'expense') {
      const expenses = await db.expense.findMany({
        where: dateFilter,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      // Get creator info for expenses
      const creatorIds = [...new Set(expenses.map(e => e.createdById))];
      const creators = await db.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true, role: true }
      });
      const creatorMap = new Map(creators.map(c => [c.id, c]));

      expenses.forEach((e) => {
        const creator = creatorMap.get(e.createdById);
        moneyLogs.push({
          id: e.id,
          type: 'EXPENSE',
          category: e.expenseType,
          amount: e.amount,
          description: e.description,
          expenseNumber: e.expenseNumber,
          paymentMode: e.paymentMode,
          paymentDate: e.paymentDate,
          isApproved: e.isApproved,
          createdAt: e.createdAt,
          createdBy: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role } : null
        });
      });
    }

    // Sort all logs by date
    moneyLogs.sort((a, b) => 
      new Date(b.createdAt || b.transactionDate).getTime() - 
      new Date(a.createdAt || a.transactionDate).getTime()
    );

    // Calculate summary stats
    const stats = {
      totalEMICollection: moneyLogs
        .filter(l => l.type === 'EMI_PAYMENT')
        .reduce((sum, l) => sum + (l.amount || 0), 0),
      totalDisbursements: moneyLogs
        .filter(l => l.type === 'LOAN_DISBURSEMENT' || l.type === 'OFFLINE_LOAN_DISBURSEMENT')
        .reduce((sum, l) => sum + (l.amount || 0), 0),
      totalCredits: moneyLogs
        .filter(l => l.type === 'CREDIT' || l.type === 'BANK_TRANSACTION' && l.category === 'Bank Credit')
        .reduce((sum, l) => sum + (l.amount || 0), 0),
      totalDebits: moneyLogs
        .filter(l => l.type === 'DEBIT' || l.type === 'EXPENSE' || (l.type === 'BANK_TRANSACTION' && l.category === 'Bank Debit'))
        .reduce((sum, l) => sum + (l.amount || 0), 0),
      totalExpenses: moneyLogs
        .filter(l => l.type === 'EXPENSE')
        .reduce((sum, l) => sum + (l.amount || 0), 0),
      emiCount: moneyLogs.filter(l => l.type === 'EMI_PAYMENT').length,
      disbursementCount: moneyLogs.filter(l => l.type === 'LOAN_DISBURSEMENT' || l.type === 'OFFLINE_LOAN_DISBURSEMENT').length,
      expenseCount: moneyLogs.filter(l => l.type === 'EXPENSE').length
    };

    return NextResponse.json({
      success: true,
      logs: moneyLogs.slice(0, limit),
      stats,
      pagination: {
        total: moneyLogs.length,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching money logs:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch money logs',
      logs: [],
      stats: {
        totalEMICollection: 0,
        totalDisbursements: 0,
        totalCredits: 0,
        totalDebits: 0,
        totalExpenses: 0,
        emiCount: 0,
        disbursementCount: 0,
        expenseCount: 0
      }
    }, { status: 500 });
  }
}
