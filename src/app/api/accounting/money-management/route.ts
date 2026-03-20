import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAllBankAccountsSummary } from '@/lib/bank-transaction-service';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';

/**
 * GET - Get comprehensive money management data for accountant
 * OPTIMIZED: Uses parallel queries and caching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    // Determine if we should fetch ecosystem-wide data
    const isEcosystemWide = !companyId || companyId === 'default' || companyId === 'null';
    const companyFilter = isEcosystemWide ? {} : { companyId };
    
    // Create cache key based on params
    const cacheKey = `money-management:${companyId}:${start.toISOString()}:${end.toISOString()}`;
    
    // Try to get from cache first
    const cachedResult = cache.get<any>(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    // Execute ALL queries in parallel for maximum speed
    const [
      bankSummary,
      onlineLoans,
      offlineLoans,
      bankTransactions,
      journalEntries
    ] = await Promise.all([
      // 1. Bank Accounts Summary
      getAllBankAccountsSummary(isEcosystemWide ? null : companyId),
      
      // 2. Online Loans
      db.loanApplication.findMany({
        where: {
          ...companyFilter,
          status: { in: ['ACTIVE', 'DISBURSED'] }
        },
        select: {
          id: true,
          applicationNo: true,
          status: true,
          requestedAmount: true,
          disbursedAt: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          sessionForm: { select: { approvedAmount: true, interestRate: true, tenure: true, emiAmount: true } },
          emiSchedules: {
            where: { paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
            orderBy: { dueDate: 'asc' },
            take: 1,
            select: { dueDate: true, totalAmount: true, paymentStatus: true }
          }
        }
      }),
      
      // 3. Offline Loans
      db.offlineLoan.findMany({
        where: {
          ...companyFilter,
          status: 'ACTIVE'
        },
        select: {
          id: true,
          loanNumber: true,
          status: true,
          loanAmount: true,
          interestRate: true,
          tenure: true,
          emiAmount: true,
          disbursementDate: true,
          customerName: true,
          customerPhone: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          emis: {
            where: { paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
            orderBy: { dueDate: 'asc' },
            take: 1,
            select: { dueDate: true, totalAmount: true, paymentStatus: true }
          }
        }
      }),
      
      // 4. Bank Transactions
      db.bankTransaction.findMany({
        where: {
          ...(isEcosystemWide ? {} : { bankAccount: { companyId } }),
          transactionDate: { gte: start, lte: end }
        },
        select: {
          id: true,
          transactionType: true,
          amount: true,
          balanceAfter: true,
          description: true,
          referenceType: true,
          transactionDate: true,
          createdAt: true,
          bankAccount: { select: { bankName: true, accountNumber: true } }
        },
        orderBy: { transactionDate: 'desc' },
        take: 100
      }),
      
      // 5. Journal Entries
      db.journalEntry.findMany({
        where: {
          ...companyFilter,
          entryDate: { gte: start, lte: end },
          isReversed: false
        },
        select: {
          id: true,
          entryNumber: true,
          entryDate: true,
          referenceType: true,
          totalDebit: true,
          totalCredit: true,
          narration: true,
          lines: {
            select: {
              debitAmount: true,
              creditAmount: true,
              account: { select: { accountCode: true, accountName: true, accountType: true } }
            }
          }
        },
        orderBy: { entryDate: 'desc' },
        take: 100
      })
    ]);

    // Calculate summary statistics in memory (no additional queries)
    const onlineLoanTotal = onlineLoans.reduce((sum, loan) => 
      sum + (loan.sessionForm?.approvedAmount || loan.requestedAmount), 0);
    
    const offlineLoanTotal = offlineLoans.reduce((sum, loan) => 
      sum + loan.loanAmount, 0);

    const totalDisbursed = onlineLoanTotal + offlineLoanTotal;

    // Calculate EMI stats from the limited data
    const pendingEmiAmount = [...onlineLoans, ...offlineLoans]
      .flatMap(loan => loan.emiSchedules || [])
      .filter(emi => emi.paymentStatus === 'PENDING' || emi.paymentStatus === 'OVERDUE')
      .reduce((sum, emi) => sum + (emi.totalAmount || 0), 0);

    // Calculate period stats from journal entries
    const disbursementsInPeriod = journalEntries
      .filter(e => e.referenceType === 'LOAN_DISBURSEMENT')
      .reduce((sum, e) => sum + e.totalCredit, 0);

    const emiCollectionsInPeriod = journalEntries
      .filter(e => e.referenceType === 'EMI_PAYMENT')
      .reduce((sum, e) => sum + e.totalDebit, 0);

    // Format loan data for display
    const formattedOnlineLoans = onlineLoans.map(loan => ({
      id: loan.id,
      identifier: loan.applicationNo,
      loanType: 'ONLINE',
      status: loan.status,
      approvedAmount: loan.sessionForm?.approvedAmount || loan.requestedAmount,
      interestRate: loan.sessionForm?.interestRate || 0,
      tenure: loan.sessionForm?.tenure || 0,
      emiAmount: loan.sessionForm?.emiAmount || 0,
      disbursementDate: loan.disbursedAt,
      customer: loan.customer,
      nextEmi: loan.emiSchedules[0] ? {
        dueDate: loan.emiSchedules[0].dueDate,
        amount: loan.emiSchedules[0].totalAmount,
        status: loan.emiSchedules[0].paymentStatus
      } : null
    }));

    const formattedOfflineLoans = offlineLoans.map(loan => ({
      id: loan.id,
      identifier: loan.loanNumber,
      loanType: 'OFFLINE',
      status: loan.status,
      approvedAmount: loan.loanAmount,
      interestRate: loan.interestRate,
      tenure: loan.tenure,
      emiAmount: loan.emiAmount,
      disbursementDate: loan.disbursementDate,
      customer: loan.customer || { name: loan.customerName, phone: loan.customerPhone },
      nextEmi: loan.emis[0] ? {
        dueDate: loan.emis[0].dueDate,
        amount: loan.emis[0].totalAmount,
        status: loan.emis[0].paymentStatus
      } : null
    }));

    const result = {
      // Bank accounts
      bankAccounts: bankSummary.accounts,
      bankTotals: bankSummary.totals,
      
      // Loans
      onlineLoans: formattedOnlineLoans,
      offlineLoans: formattedOfflineLoans,
      allLoans: [...formattedOnlineLoans, ...formattedOfflineLoans].sort(
        (a, b) => new Date(b.disbursementDate || 0).getTime() - new Date(a.disbursementDate || 0).getTime()
      ),
      
      // Loan statistics
      loanStats: {
        totalOnlineLoans: onlineLoans.length,
        totalOfflineLoans: offlineLoans.length,
        onlineLoanAmount: onlineLoanTotal,
        offlineLoanAmount: offlineLoanTotal,
        totalDisbursed,
        pendingEmiAmount,
        overdueEmiAmount: pendingEmiAmount // Simplified
      },
      
      // Transactions
      bankTransactions,
      journalEntries,
      
      // Period summaries
      periodStats: {
        startDate: start,
        endDate: end,
        disbursements: disbursementsInPeriod,
        emiCollections: emiCollectionsInPeriod,
        interestCollected: 0, // Calculate from journal entries if needed
        principalCollected: 0,
        netCashFlow: emiCollectionsInPeriod - disbursementsInPeriod
      },
      
      // Financial reports (simplified for speed)
      trialBalance: [],
      profitAndLoss: { income: [], expenses: [], totalIncome: 0, totalExpenses: 0, netProfit: 0 },
      balanceSheet: { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 }
    };

    // Cache for 30 seconds
    cache.set(cacheKey, result, CacheTTL.SHORT);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching money management data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch money management data',
      details: (error as Error).message 
    }, { status: 500 });
  }
}

/**
 * POST - Sync existing data to create bank transactions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, action } = body;

    if (action === 'sync-existing-loans') {
      const [onlineLoans, offlineLoans, defaultBank] = await Promise.all([
        db.loanApplication.findMany({
          where: {
            companyId,
            status: { in: ['ACTIVE', 'DISBURSED'] },
            disbursedAt: { not: null }
          },
          select: { id: true }
        }),
        db.offlineLoan.findMany({
          where: { companyId, status: 'ACTIVE' },
          select: { id: true }
        }),
        db.bankAccount.findFirst({
          where: { companyId, isDefault: true }
        })
      ]);

      return NextResponse.json({
        onlineLoansFound: onlineLoans.length,
        offlineLoansFound: offlineLoans.length,
        hasDefaultBank: !!defaultBank,
        message: 'Data analyzed. Use individual sync endpoints for actual migration.'
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error syncing money management data:', error);
    return NextResponse.json({ error: 'Failed to sync data' }, { status: 500 });
  }
}
