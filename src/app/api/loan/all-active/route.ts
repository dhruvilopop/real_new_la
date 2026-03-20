import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, CacheTTL, CacheKeys } from '@/lib/cache';

// Cache TTL for active loans - 60 seconds
const CACHE_TTL = CacheTTL.MEDIUM;

// GET all active loans - OPTIMIZED for speed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    // Check cache first
    const cacheKey = `${CacheKeys.allActiveLoans()}-${filter}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // OPTIMIZED: Only fetch the NEXT pending EMI, not all EMIs
    // This dramatically reduces query time and data transfer
    const [onlineLoans, offlineLoans] = await Promise.all([
      // Fetch online loans - MINIMAL DATA
      filter === 'all' || filter === 'online' 
        ? db.loanApplication.findMany({
            where: { status: { in: ['ACTIVE', 'DISBURSED'] } },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              applicationNo: true,
              status: true,
              requestedAmount: true,
              createdAt: true,
              disbursedAt: true,
              customer: { select: { id: true, name: true, email: true, phone: true } },
              company: { select: { id: true, name: true, code: true } },
              sessionForm: {
                select: {
                  approvedAmount: true,
                  interestRate: true,
                  tenure: true,
                  emiAmount: true
                }
              }
            }
          })
        : Promise.resolve([]),
      
      // Fetch offline loans - MINIMAL DATA
      filter === 'all' || filter === 'offline'
        ? db.offlineLoan.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              loanNumber: true,
              status: true,
              loanAmount: true,
              interestRate: true,
              tenure: true,
              emiAmount: true,
              disbursementDate: true,
              createdAt: true,
              customerName: true,
              customerPhone: true,
              customer: { select: { id: true, name: true, email: true, phone: true } },
              company: { select: { id: true, name: true, code: true } }
            }
          })
        : Promise.resolve([])
    ]);

    // Get loan IDs for fetching next EMIs
    const onlineLoanIds = onlineLoans.map(l => l.id);
    const offlineLoanIds = offlineLoans.map(l => l.id);

    // Fetch ONLY the next pending EMI for each loan in parallel
    const [onlineEmis, offlineEmis] = await Promise.all([
      onlineLoanIds.length > 0 
        ? db.eMISchedule.findMany({
            where: {
              loanApplicationId: { in: onlineLoanIds },
              paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] }
            },
            orderBy: { dueDate: 'asc' },
            select: {
              id: true,
              loanApplicationId: true,
              installmentNumber: true,
              dueDate: true,
              totalAmount: true,
              paymentStatus: true
            }
          })
        : Promise.resolve([]),
      
      offlineLoanIds.length > 0
        ? db.offlineLoanEMI.findMany({
            where: {
              offlineLoanId: { in: offlineLoanIds },
              paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] }
            },
            orderBy: { dueDate: 'asc' },
            select: {
              id: true,
              offlineLoanId: true,
              installmentNumber: true,
              dueDate: true,
              totalAmount: true,
              paymentStatus: true
            }
          })
        : Promise.resolve([])
    ]);

    // Create maps for quick EMI lookup (only first pending EMI per loan)
    const onlineEmiMap = new Map<string, any>();
    for (const emi of onlineEmis) {
      if (!onlineEmiMap.has(emi.loanApplicationId)) {
        onlineEmiMap.set(emi.loanApplicationId, emi);
      }
    }

    const offlineEmiMap = new Map<string, any>();
    for (const emi of offlineEmis) {
      if (!offlineEmiMap.has(emi.offlineLoanId)) {
        offlineEmiMap.set(emi.offlineLoanId, emi);
      }
    }

    // Format online loans
    const formattedOnlineLoans = onlineLoans.map(loan => {
      const nextEmi = onlineEmiMap.get(loan.id);
      return {
        id: loan.id,
        identifier: loan.applicationNo,
        applicationNo: loan.applicationNo,
        loanType: 'ONLINE',
        status: loan.status,
        requestedAmount: loan.requestedAmount,
        approvedAmount: (loan.sessionForm as any)?.approvedAmount || loan.requestedAmount,
        interestRate: (loan.sessionForm as any)?.interestRate || 0,
        tenure: (loan.sessionForm as any)?.tenure || 0,
        emiAmount: (loan.sessionForm as any)?.emiAmount || 0,
        disbursementDate: loan.disbursedAt,
        createdAt: loan.createdAt,
        customer: loan.customer,
        company: loan.company,
        nextEmi: nextEmi ? {
          id: nextEmi.id,
          dueDate: nextEmi.dueDate,
          amount: nextEmi.totalAmount,
          status: nextEmi.paymentStatus,
          installmentNumber: nextEmi.installmentNumber
        } : null
      };
    });

    // Format offline loans
    const formattedOfflineLoans = offlineLoans.map(loan => {
      const nextEmi = offlineEmiMap.get(loan.id);
      return {
        id: loan.id,
        identifier: loan.loanNumber,
        applicationNo: loan.loanNumber,
        loanType: 'OFFLINE',
        status: loan.status,
        requestedAmount: loan.loanAmount,
        approvedAmount: loan.loanAmount,
        interestRate: loan.interestRate,
        tenure: loan.tenure,
        emiAmount: loan.emiAmount,
        disbursementDate: loan.disbursementDate,
        createdAt: loan.createdAt,
        customer: loan.customer || {
          id: null,
          name: loan.customerName,
          email: null,
          phone: loan.customerPhone
        },
        company: loan.company,
        nextEmi: nextEmi ? {
          id: nextEmi.id,
          dueDate: nextEmi.dueDate,
          amount: nextEmi.totalAmount,
          status: nextEmi.paymentStatus,
          installmentNumber: nextEmi.installmentNumber
        } : null
      };
    });

    // Combine and sort
    const allLoans = [...formattedOnlineLoans, ...formattedOfflineLoans]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate stats
    const stats = {
      totalOnline: formattedOnlineLoans.length,
      totalOffline: formattedOfflineLoans.length,
      totalLoans: allLoans.length,
      totalOnlineAmount: formattedOnlineLoans.reduce((sum, l) => sum + l.approvedAmount, 0),
      totalOfflineAmount: formattedOfflineLoans.reduce((sum, l) => sum + l.approvedAmount, 0),
      totalAmount: allLoans.reduce((sum, l) => sum + l.approvedAmount, 0)
    };

    const result = {
      loans: allLoans,
      onlineLoans: formattedOnlineLoans,
      offlineLoans: formattedOfflineLoans,
      stats
    };

    // Cache the result
    cache.set(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching all active loans:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch active loans', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
