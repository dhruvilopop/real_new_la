import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, CacheTTL, CacheKeys } from '@/lib/cache';

// Cache TTL for active loans - 60 seconds (active loans status changes less frequently)
const CACHE_TTL = CacheTTL.MEDIUM;

// GET all active loans (both online and offline) with complete passbook data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'all', 'online', 'offline'
    const includePassbook = searchParams.get('passbook') === 'true';

    // Try to get from cache first
    const cacheKey = `${CacheKeys.allActiveLoans()}-${filter}-${includePassbook}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Use Promise.all for parallel queries - SUPER FAST!
    const [onlineLoans, offlineLoans] = await Promise.all([
      // Fetch online loans with minimal EMI fields
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
                  emiAmount: true,
                  totalAmount: true,
                  totalInterest: true
                }
              },
              emiSchedules: {
                orderBy: { installmentNumber: 'asc' },
                select: {
                  id: true,
                  installmentNumber: true,
                  dueDate: true,
                  totalAmount: true,
                  paidAmount: true,
                  paymentStatus: true,
                  paidDate: true,
                  penaltyAmount: true,
                  daysOverdue: true
                }
              },
              payments: includePassbook ? {
                where: { status: 'COMPLETED' },
                orderBy: { createdAt: 'desc' },
                take: 10, // Limit payments for performance
                select: {
                  id: true,
                  amount: true,
                  paymentMode: true,
                  createdAt: true,
                  status: true,
                  receiptNumber: true
                }
              } : false
            }
          })
        : Promise.resolve([]),
      
      // Fetch offline loans with minimal fields
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
              customerEmail: true,
              customerPhone: true,
              customer: { select: { id: true, name: true, email: true, phone: true } },
              company: { select: { id: true, name: true, code: true } },
              createdBy: { select: { id: true, name: true, role: true } },
              emis: {
                orderBy: { installmentNumber: 'asc' },
                select: {
                  id: true,
                  installmentNumber: true,
                  dueDate: true,
                  totalAmount: true,
                  paidAmount: true,
                  paymentStatus: true,
                  paidDate: true,
                  penaltyAmount: true,
                  daysOverdue: true
                }
              }
            }
          })
        : Promise.resolve([])
    ]);

    // Format online loans
    const formattedOnlineLoans = onlineLoans.map(loan => {
      const pendingEmis = (loan.emiSchedules || []).filter(
        (e: any) => ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(e.paymentStatus)
      );
      const nextEmi = pendingEmis[0];

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
        totalAmount: (loan.sessionForm as any)?.totalAmount || 0,
        totalInterest: (loan.sessionForm as any)?.totalInterest || 0,
        disbursementDate: loan.disbursedAt,
        createdAt: loan.createdAt,
        customer: loan.customer,
        company: loan.company,
        sessionForm: loan.sessionForm,
        emiSchedules: loan.emiSchedules,
        payments: loan.payments || [],
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
      const pendingEmis = ((loan as any).emis || []).filter(
        (e: any) => ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(e.paymentStatus)
      );
      const nextEmi = pendingEmis[0];

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
        totalAmount: (loan.loanAmount || 0) + (loan.loanAmount * (loan.interestRate / 100) * (loan.tenure / 12)),
        totalInterest: (loan.loanAmount || 0) * (loan.interestRate / 100) * (loan.tenure / 12),
        disbursementDate: loan.disbursementDate,
        createdAt: loan.createdAt,
        customer: loan.customer || {
          id: null,
          name: loan.customerName,
          email: loan.customerEmail,
          phone: loan.customerPhone
        },
        company: loan.company,
        createdBy: (loan as any).createdBy,
        emiSchedules: ((loan as any).emis || []).map((emi: any) => ({
          id: emi.id,
          installmentNumber: emi.installmentNumber,
          dueDate: emi.dueDate,
          totalAmount: emi.totalAmount,
          principalAmount: emi.principalAmount,
          interestAmount: emi.interestAmount,
          paidAmount: emi.paidAmount,
          paymentStatus: emi.paymentStatus,
          paidDate: emi.paidDate,
          paymentMode: emi.paymentMode,
          penaltyAmount: emi.penaltyAmount,
          daysOverdue: emi.daysOverdue
        })),
        payments: [],
        nextEmi: nextEmi ? {
          id: nextEmi.id,
          dueDate: nextEmi.dueDate,
          amount: nextEmi.totalAmount,
          status: nextEmi.paymentStatus,
          installmentNumber: nextEmi.installmentNumber
        } : null
      };
    });

    // Combine and sort by creation date
    const allLoans = [...formattedOnlineLoans, ...formattedOfflineLoans]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate statistics
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
