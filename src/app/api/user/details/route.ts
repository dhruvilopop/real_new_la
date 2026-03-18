import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch user with all related data
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isLocked: true,
        createdAt: true,
        lastLoginAt: true,
        lastActivityAt: true,
        
        // Codes
        agentCode: true,
        staffCode: true,
        cashierCode: true,
        accountantCode: true,
        
        // Credits
        companyCredit: true,
        personalCredit: true,
        credit: true,
        
        // Personal Info
        panNumber: true,
        aadhaarNumber: true,
        dateOfBirth: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        
        // Employment
        employmentType: true,
        monthlyIncome: true,
        bankName: true,
        bankAccountNumber: true,
        
        // Relations
        companyId: true,
        agentId: true,
        company: {
          select: { id: true, name: true, code: true }
        },
        agent: {
          select: { id: true, name: true, agentCode: true }
        },
        
        // Counts of related data
        _count: {
          select: {
            loanApplications: true,
            disbursedLoans: true,
            payments: true,
            auditLogs: true,
            notifications: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch role-specific data
    let roleSpecificData: any = {};

    if (user.role === 'COMPANY') {
      // Get agents under this company
      const companyAgents = await db.user.count({
        where: { companyId: user.companyId, role: 'AGENT' }
      });
      
      // Get loans for this company
      const companyLoans = await db.loanApplication.count({
        where: { companyId: user.companyId }
      });
      
      // Get company's active loans
      const activeCompanyLoans = await db.loanApplication.count({
        where: { companyId: user.companyId, status: { in: ['ACTIVE', 'DISBURSED'] } }
      });
      
      roleSpecificData = {
        agentsCount: companyAgents,
        totalLoans: companyLoans,
        activeLoans: activeCompanyLoans
      };
    }

    if (user.role === 'AGENT') {
      // Get staff under this agent
      const staffCount = await db.user.count({
        where: { agentId: user.id, role: 'STAFF' }
      });
      
      // Get loans processed by this agent
      const processedLoans = await db.loanApplication.count({
        where: { currentHandlerId: user.id }
      });
      
      // Get session forms created by this agent
      const sessionsCreated = await db.sessionForm.count({
        where: { agentId: user.id }
      });
      
      // Get active loans disbursed through this agent
      const activeLoans = await db.loanApplication.count({
        where: { disbursedById: user.id, status: { in: ['ACTIVE', 'DISBURSED'] } }
      });
      
      roleSpecificData = {
        staffCount,
        processedLoans,
        sessionsCreated,
        activeLoans
      };
    }

    if (user.role === 'STAFF') {
      // Get loans verified by this staff
      const verifiedLoans = await db.loanForm.count({
        where: { verifiedById: user.id }
      });
      
      // Get location logs
      const locationLogs = await db.locationLog.count({
        where: { userId: user.id }
      });
      
      roleSpecificData = {
        verifiedLoans,
        locationLogs
      };
    }

    if (user.role === 'CASHIER') {
      // Get payments processed
      const paymentsProcessed = await db.payment.count({
        where: { cashierId: user.id }
      });
      
      // Get loans disbursed
      const loansDisbursed = await db.loanApplication.count({
        where: { disbursedById: user.id }
      });
      
      roleSpecificData = {
        paymentsProcessed,
        loansDisbursed
      };
    }

    if (user.role === 'CUSTOMER') {
      // Get customer's loan applications
      const loanApplications = await db.loanApplication.findMany({
        where: { customerId: user.id },
        select: {
          id: true,
          applicationNo: true,
          status: true,
          requestedAmount: true,
          loanType: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      
      // Get EMI schedules
      const emiSchedules = await db.eMISchedule.count({
        where: { loanApplication: { customerId: user.id } }
      });
      
      // Get payments made
      const payments = await db.payment.count({
        where: { customerId: user.id }
      });
      
      roleSpecificData = {
        loanApplications,
        totalLoans: loanApplications.length,
        emiSchedules,
        payments
      };
    }

    // Get recent activity logs for this user
    const recentActivity = await db.auditLog.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        action: true,
        module: true,
        description: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        roleSpecificData,
        recentActivity
      }
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch user details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
