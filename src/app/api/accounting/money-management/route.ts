import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAllBankAccountsSummary } from '@/lib/bank-transaction-service';
import { AccountingService, ACCOUNT_CODES } from '@/lib/accounting-service';

/**
 * GET - Get comprehensive money management data for accountant
 * 
 * This endpoint provides all financial data needed for the accountant dashboard:
 * - Bank account balances with transaction history
 * - Loan disbursements summary
 * - EMI collections summary
 * - Interest vs Principal breakdown
 * - Journal entries
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    // Determine if we should fetch ecosystem-wide data (for accountant/cashier without company assignment)
    const isEcosystemWide = !companyId || companyId === 'default' || companyId === 'null';
    
    // Build company filter for queries
    const companyFilter = isEcosystemWide ? {} : { companyId };

    // 1. Get Bank Accounts Summary (ecosystem-wide if no specific company)
    const bankSummary = await getAllBankAccountsSummary(isEcosystemWide ? null : companyId);

    // 2. Get Online Loans (LoanApplication) that are active
    const onlineLoans = await db.loanApplication.findMany({
      where: {
        ...companyFilter,
        status: { in: ['ACTIVE', 'DISBURSED'] }
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        sessionForm: true,
        emiSchedules: {
          where: { paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    // 3. Get Offline Loans that are active
    const offlineLoans = await db.offlineLoan.findMany({
      where: {
        ...companyFilter,
        status: 'ACTIVE'
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        emis: {
          where: { paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    // 4. Get all bank transactions for the period
    const bankTransactions = await db.bankTransaction.findMany({
      where: {
        ...(isEcosystemWide ? {} : { bankAccount: { companyId } }),
        transactionDate: { gte: start, lte: end }
      },
      include: {
        bankAccount: { select: { bankName: true, accountNumber: true } }
      },
      orderBy: { transactionDate: 'desc' }
    });

    // 5. Get journal entries for the period
    const journalEntries = await db.journalEntry.findMany({
      where: {
        ...companyFilter,
        entryDate: { gte: start, lte: end },
        isReversed: false
      },
      include: {
        lines: {
          include: {
            account: { select: { accountCode: true, accountName: true, accountType: true } }
          }
        }
      },
      orderBy: { entryDate: 'desc' },
      take: 100
    });

    // 6. Calculate summary statistics
    const onlineLoanTotal = onlineLoans.reduce((sum, loan) => 
      sum + (loan.sessionForm?.approvedAmount || loan.requestedAmount), 0);
    
    const offlineLoanTotal = offlineLoans.reduce((sum, loan) => 
      sum + loan.loanAmount, 0);

    const totalDisbursed = onlineLoanTotal + offlineLoanTotal;

    // Calculate EMI stats
    const onlineEmis = onlineLoans.flatMap(loan => loan.emiSchedules);
    const offlineEmis = offlineLoans.flatMap(loan => loan.emis);

    const pendingEmiAmount = [...onlineEmis, ...offlineEmis]
      .filter(emi => emi.paymentStatus === 'PENDING' || emi.paymentStatus === 'OVERDUE')
      .reduce((sum, emi) => sum + (emi.totalAmount - (emi.paidAmount || 0)), 0);

    const overdueEmiAmount = [...onlineEmis, ...offlineEmis]
      .filter(emi => emi.paymentStatus === 'OVERDUE')
      .reduce((sum, emi) => sum + (emi.totalAmount - (emi.paidAmount || 0)), 0);

    // 7. Get Chart of Accounts summary
    // For ecosystem-wide view, use the first company's accounting data
    let accountingCompanyId = companyId;
    if (isEcosystemWide) {
      // Get the first company for accounting purposes
      const firstCompany = await db.company.findFirst({ 
        where: { isActive: true },
        select: { id: true }
      });
      accountingCompanyId = firstCompany?.id || 'default';
    }
    
    let trialBalance: any[] = [];
    let profitAndLoss: any = { income: [], expenses: [], totalIncome: 0, totalExpenses: 0, netProfit: 0 };
    let balanceSheet: any = { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 };
    
    try {
      const accountingService = new AccountingService(accountingCompanyId);
      await accountingService.initializeChartOfAccounts();
      
      trialBalance = await accountingService.getTrialBalance();
      profitAndLoss = await accountingService.getProfitAndLoss(start, end);
      balanceSheet = await accountingService.getBalanceSheet(end);
    } catch (accError) {
      console.error('Accounting service error:', accError);
      // Continue without accounting data - bank accounts still work
    }

    // 8. Calculate loan disbursements vs collections for the period
    const disbursementsInPeriod = journalEntries
      .filter(e => e.referenceType === 'LOAN_DISBURSEMENT')
      .reduce((sum, e) => sum + e.totalCredit, 0);

    const emiCollectionsInPeriod = journalEntries
      .filter(e => e.referenceType === 'EMI_PAYMENT')
      .reduce((sum, e) => sum + e.totalDebit, 0);

    // 9. Get principal vs interest breakdown from journal entries
    let interestCollectedInPeriod = 0;
    let principalCollectedInPeriod = 0;

    for (const entry of journalEntries.filter(e => e.referenceType === 'EMI_PAYMENT')) {
      for (const line of entry.lines) {
        if (line.account.accountCode === ACCOUNT_CODES.INTEREST_INCOME) {
          interestCollectedInPeriod += line.creditAmount;
        }
        if (line.account.accountCode === ACCOUNT_CODES.LOAN_PRINCIPAL) {
          principalCollectedInPeriod += line.creditAmount;
        }
      }
    }

    // 10. Format loan data for display
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

    return NextResponse.json({
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
        overdueEmiAmount
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
        interestCollected: interestCollectedInPeriod,
        principalCollected: principalCollectedInPeriod,
        netCashFlow: emiCollectionsInPeriod - disbursementsInPeriod
      },
      
      // Financial reports
      trialBalance,
      profitAndLoss,
      balanceSheet
    });

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
 * This is useful for migrating existing loan data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, action } = body;

    if (action === 'sync-existing-loans') {
      // Get all active online loans without bank transactions
      const onlineLoans = await db.loanApplication.findMany({
        where: {
          companyId,
          status: { in: ['ACTIVE', 'DISBURSED'] },
          disbursedAt: { not: null }
        },
        include: { sessionForm: true }
      });

      // Get all offline loans
      const offlineLoans = await db.offlineLoan.findMany({
        where: { companyId, status: 'ACTIVE' }
      });

      // Get default bank account
      const defaultBank = await db.bankAccount.findFirst({
        where: { companyId, isDefault: true }
      });

      if (!defaultBank) {
        return NextResponse.json({ 
          error: 'No default bank account found. Please create one first.' 
        }, { status: 400 });
      }

      // Count transactions to create
      const stats = {
        onlineLoansFound: onlineLoans.length,
        offlineLoansFound: offlineLoans.length,
        message: 'Data analyzed. Use individual sync endpoints for actual migration.'
      };

      return NextResponse.json(stats);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error syncing money management data:', error);
    return NextResponse.json({ error: 'Failed to sync data' }, { status: 500 });
  }
}
