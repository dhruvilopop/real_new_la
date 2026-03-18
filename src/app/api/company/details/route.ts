import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Fetch company with all related data
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        code: true,
        registrationNo: true,
        gstNumber: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        contactEmail: true,
        contactPhone: true,
        isActive: true,
        maxLoanAmount: true,
        minLoanAmount: true,
        defaultInterestRate: true,
        maxTenureMonths: true,
        companyCredit: true,
        createdAt: true,
        updatedAt: true,
        
        // Count relations
        _count: {
          select: {
            users: true,
            loanApplications: true,
          }
        }
      }
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get agents under this company
    const agents = await db.user.findMany({
      where: { companyId, role: 'AGENT' },
      select: { id: true, name: true, email: true, agentCode: true, isActive: true }
    });

    // Get staff under this company
    const staff = await db.user.findMany({
      where: { companyId, role: 'STAFF' },
      select: { id: true, name: true, email: true, staffCode: true, isActive: true }
    });

    // Get recent loan applications for this company
    const recentLoans = await db.loanApplication.findMany({
      where: { companyId },
      select: {
        id: true,
        applicationNo: true,
        status: true,
        requestedAmount: true,
        loanType: true,
        createdAt: true,
        customer: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get recent audit logs for this company
    const recentActivity = await db.auditLog.findMany({
      where: {
        OR: [
          { loanApplication: { companyId } },
          { user: { companyId } }
        ]
      },
      select: {
        id: true,
        action: true,
        module: true,
        description: true,
        createdAt: true,
        user: { select: { name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Calculate statistics
    const totalDisbursed = await db.loanApplication.aggregate({
      where: { 
        companyId, 
        status: { in: ['ACTIVE', 'DISBURSED'] } 
      },
      _sum: { disbursedAmount: true }
    });

    const pendingLoans = await db.loanApplication.count({
      where: { 
        companyId, 
        status: { in: ['SUBMITTED', 'SA_APPROVED', 'COMPANY_APPROVED', 'AGENT_APPROVED_STAGE1', 'SESSION_CREATED'] } 
      }
    });

    return NextResponse.json({
      success: true,
      company: {
        ...company,
        agents,
        staff,
        recentLoans,
        recentActivity,
        stats: {
          totalDisbursed: totalDisbursed._sum.disbursedAmount || 0,
          pendingLoans,
          activeAgents: agents.filter(a => a.isActive).length,
          activeStaff: staff.filter(s => s.isActive).length
        },
        _count: {
          users: company._count.users,
          loanApplications: company._count.loanApplications,
          agents: agents.length,
          staff: staff.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching company details:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch company details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
