import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all active loans (both online and offline) with complete passbook data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'all', 'online', 'offline'
    const includePassbook = searchParams.get('passbook') === 'true';

    let onlineLoans: any[] = [];
    let offlineLoans: any[] = [];

    console.log('[all-active] Fetching active loans with filter:', filter);

    // Fetch online loans (from LoanApplication)
    if (filter === 'all' || filter === 'online') {
      const includeOptions: any = {
        customer: {
          select: { id: true, name: true, email: true, phone: true }
        },
        company: {
          select: { id: true, name: true, code: true }
        },
        sessionForm: {
          select: {
            approvedAmount: true,
            interestRate: true,
            tenure: true,
            emiAmount: true,
            totalAmount: true,
            totalInterest: true
          }
        }
      };

      // Include EMI schedules for passbook
      if (includePassbook) {
        includeOptions.emiSchedules = {
          orderBy: { installmentNumber: 'asc' },
          select: {
            id: true,
            installmentNumber: true,
            dueDate: true,
            originalDueDate: true,
            principalAmount: true,
            interestAmount: true,
            totalAmount: true,
            paidAmount: true,
            paidPrincipal: true,
            paidInterest: true,
            paymentStatus: true,
            paidDate: true,
            paymentMode: true,
            penaltyAmount: true,
            daysOverdue: true
          }
        };
        includeOptions.payments = {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            paymentMode: true,
            createdAt: true,
            status: true,
            receiptNumber: true
          }
        };
      } else {
        // Always include all EMI schedules for the expandable view
        includeOptions.emiSchedules = {
          orderBy: { installmentNumber: 'asc' },
          select: {
            id: true,
            installmentNumber: true,
            dueDate: true,
            originalDueDate: true,
            principalAmount: true,
            interestAmount: true,
            totalAmount: true,
            paidAmount: true,
            paidPrincipal: true,
            paidInterest: true,
            paymentStatus: true,
            paidDate: true,
            paymentMode: true,
            penaltyAmount: true,
            daysOverdue: true,
            isPartialPayment: true,
            isInterestOnly: true,
            nextPaymentDate: true
          }
        };
      }

      onlineLoans = await db.loanApplication.findMany({
        where: {
          status: { in: ['ACTIVE', 'DISBURSED'] }
        },
        orderBy: { createdAt: 'desc' },
        include: includeOptions
      });
    }

    // Fetch offline loans
    if (filter === 'all' || filter === 'offline') {
      const includeOptions: any = {
        customer: {
          select: { id: true, name: true, email: true, phone: true }
        },
        company: {
          select: { id: true, name: true, code: true }
        },
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      };

      // Include EMI schedules for passbook
      if (includePassbook) {
        includeOptions.emis = {
          orderBy: { installmentNumber: 'asc' },
          select: {
            id: true,
            installmentNumber: true,
            dueDate: true,
            principalAmount: true,
            interestAmount: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
            paidDate: true,
            paymentMode: true,
            penaltyAmount: true
          }
        };
      } else {
        // Always include all EMI schedules for the expandable view
        // Note: OfflineLoanEMI doesn't have originalDueDate, isPartialPayment, isInterestOnly, nextPaymentDate
        includeOptions.emis = {
          orderBy: { installmentNumber: 'asc' },
          select: {
            id: true,
            installmentNumber: true,
            dueDate: true,
            principalAmount: true,
            interestAmount: true,
            totalAmount: true,
            paidAmount: true,
            paidPrincipal: true,
            paidInterest: true,
            paymentStatus: true,
            paidDate: true,
            paymentMode: true,
            penaltyAmount: true,
            daysOverdue: true
          }
        };
      }

      offlineLoans = await db.offlineLoan.findMany({
        where: {
          status: 'ACTIVE'
        },
        orderBy: { createdAt: 'desc' },
        include: includeOptions
      });
    }

    // Format online loans
    const formattedOnlineLoans = onlineLoans.map(loan => {
      // Find the next pending/overdue EMI
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
        approvedAmount: loan.sessionForm?.approvedAmount || loan.requestedAmount,
        interestRate: loan.sessionForm?.interestRate || 0,
        tenure: loan.sessionForm?.tenure || 0,
        emiAmount: loan.sessionForm?.emiAmount || 0,
        totalAmount: loan.sessionForm?.totalAmount || 0,
        totalInterest: loan.sessionForm?.totalInterest || 0,
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
      // Find the next pending/overdue EMI
      const pendingEmis = (loan.emis || []).filter(
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
        createdBy: loan.createdBy,
        emiSchedules: loan.emis?.map((emi: any) => ({
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
          // Note: OfflineLoanEMI doesn't have isPartialPayment, isInterestOnly fields
        })) || [],
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

    return NextResponse.json({
      loans: allLoans,
      onlineLoans: formattedOnlineLoans,
      offlineLoans: formattedOfflineLoans,
      stats
    });

  } catch (error) {
    console.error('Error fetching all active loans:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      error: 'Failed to fetch active loans', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
