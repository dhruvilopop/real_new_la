import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, CacheTTL } from '@/lib/cache';

// GET - Fetch all money-related logs (EMI, Credits, Transactions) - OPTIMIZED
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Check cache first
    const cacheKey = `money-logs:${type || 'all'}:${limit}:${offset}:${startDate || ''}:${endDate || ''}`;
    const cachedResult = cache.get<any>(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    // Build date filter
    const dateFilter: any = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } : {};

    // Execute ALL queries in parallel
    const queries = [];
    
    // 1. EMI Transactions
    if (!type || type === 'all' || type === 'emi') {
      queries.push(
        db.creditTransaction.findMany({
          where: { ...dateFilter, sourceType: 'EMI_PAYMENT' },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            amount: true,
            paymentMode: true,
            creditType: true,
            description: true,
            customerName: true,
            customerPhone: true,
            loanApplicationNo: true,
            emiDueDate: true,
            emiAmount: true,
            principalComponent: true,
            interestComponent: true,
            companyBalanceAfter: true,
            personalBalanceAfter: true,
            chequeNumber: true,
            utrNumber: true,
            bankRefNumber: true,
            collectedFrom: true,
            collectionLocation: true,
            transactionDate: true,
            createdAt: true,
            installmentNumber: true,
            transactionType: true,
            sourceType: true,
            user: { select: { id: true, name: true, email: true, role: true } }
          }
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    // 2. Credit Transactions (non-EMI)
    if (!type || type === 'all' || type === 'credit') {
      queries.push(
        db.creditTransaction.findMany({
          where: { ...dateFilter, sourceType: { not: 'EMI_PAYMENT' } },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            amount: true,
            paymentMode: true,
            creditType: true,
            description: true,
            customerName: true,
            customerPhone: true,
            loanApplicationNo: true,
            companyBalanceAfter: true,
            personalBalanceAfter: true,
            chequeNumber: true,
            utrNumber: true,
            bankRefNumber: true,
            transactionDate: true,
            createdAt: true,
            transactionType: true,
            sourceType: true,
            user: { select: { id: true, name: true, email: true, role: true } }
          }
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    // 3. Loan Disbursements
    if (!type || type === 'all' || type === 'disbursement') {
      queries.push(
        db.loanApplication.findMany({
          where: {
            ...dateFilter,
            status: { in: ['DISBURSED', 'ACTIVE'] },
            disbursedAmount: { not: null }
          },
          orderBy: { disbursedAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            applicationNo: true,
            disbursedAmount: true,
            disbursedAt: true,
            disbursedMode: true,
            disbursedRef: true,
            createdAt: true,
            customer: { select: { id: true, name: true, email: true, phone: true } },
            company: { select: { id: true, name: true } },
            disbursedBy: { select: { id: true, name: true, email: true, role: true } }
          }
        })
      );
      
      // 3b. Offline Loans
      queries.push(
        db.offlineLoan.findMany({
          where: { ...dateFilter, status: 'ACTIVE' },
          orderBy: { disbursementDate: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            loanNumber: true,
            loanAmount: true,
            disbursementDate: true,
            disbursementMode: true,
            disbursementRef: true,
            createdAt: true,
            customerName: true,
            customerPhone: true,
            company: { select: { id: true, name: true } }
          }
        })
      );
    } else {
      queries.push(Promise.resolve([]));
      queries.push(Promise.resolve([]));
    }

    // 4. Bank Transactions
    if (!type || type === 'all' || type === 'bank') {
      queries.push(
        db.bankTransaction.findMany({
          where: dateFilter,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            transactionType: true,
            amount: true,
            description: true,
            balanceAfter: true,
            referenceType: true,
            transactionDate: true,
            createdAt: true,
            bankAccount: { select: { id: true, bankName: true, accountNumber: true } }
          }
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    // 5. Expenses
    if (!type || type === 'all' || type === 'expense') {
      queries.push(
        db.expense.findMany({
          where: dateFilter,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            expenseNumber: true,
            expenseType: true,
            amount: true,
            description: true,
            paymentMode: true,
            paymentDate: true,
            isApproved: true,
            createdAt: true,
            createdById: true
          }
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    // Execute all queries in parallel
    const [
      emiTransactions,
      creditTransactions,
      disbursedLoans,
      offlineLoans,
      bankTransactions,
      expenses
    ] = await Promise.all(queries);

    // Get expense creators in a single query
    let expenseCreators: Map<string, any> = new Map();
    if (expenses.length > 0) {
      const creatorIds = [...new Set(expenses.map((e: any) => e.createdById))];
      const creators = await db.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true, role: true }
      });
      expenseCreators = new Map(creators.map(c => [c.id, c]));
    }

    // Build money logs array
    const moneyLogs: any[] = [];

    // Process EMI Transactions
    emiTransactions.forEach((t: any) => {
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

    // Process Credit Transactions
    creditTransactions.forEach((t: any) => {
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

    // Process Disbursed Loans
    disbursedLoans.forEach((loan: any) => {
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
        disbursementMode: loan.disbursedMode,
        disbursementRef: loan.disbursedRef,
        transactionDate: loan.disbursedAt,
        createdAt: loan.disbursedAt,
        createdBy: loan.disbursedBy
      });
    });

    // Process Offline Loans
    offlineLoans.forEach((loan: any) => {
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

    // Process Bank Transactions
    bankTransactions.forEach((t: any) => {
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

    // Process Expenses
    expenses.forEach((e: any) => {
      const creator = expenseCreators.get(e.createdById);
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
        .filter(l => l.type === 'CREDIT' || (l.type === 'BANK_TRANSACTION' && l.category === 'Bank Credit'))
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

    const result = {
      success: true,
      logs: moneyLogs.slice(0, limit),
      stats,
      pagination: {
        total: moneyLogs.length,
        limit,
        offset
      }
    };

    // Cache for 30 seconds
    cache.set(cacheKey, result, CacheTTL.SHORT);

    return NextResponse.json(result);
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
