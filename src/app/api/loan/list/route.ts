import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const customerId = searchParams.get('customerId');
    const companyId = searchParams.get('companyId');
    const agentId = searchParams.get('agentId');
    const staffId = searchParams.get('staffId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    
    if (customerId) where.customerId = customerId;
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;

    // Role-based filtering
    if (role === 'SUPER_ADMIN') {
      // Super admin sees all loans - no additional filtering
    } else if (role === 'COMPANY') {
      // Company sees loans assigned to them
      if (companyId) where.companyId = companyId;
    } else if (role === 'AGENT' && agentId) {
      // Agent sees loans where:
      // 1. They are the current handler (assigned to them by SuperAdmin or Company)
      // 2. Loans in COMPANY_APPROVED status that need their approval
      // 3. SA_APPROVED loans directly assigned to them (SuperAdmin skipped Company)
      
      // Get the agent's company to filter correctly
      const agent = await db.user.findUnique({
        where: { id: agentId },
        select: { companyId: true }
      });
      
      // Agent sees loans from their company in these statuses
      where.OR = [
        // Loans directly assigned to this agent (currentHandlerId)
        { currentHandlerId: agentId },
        // Loans in COMPANY_APPROVED status from agent's company (awaiting agent approval)
        { status: 'COMPANY_APPROVED', companyId: agent?.companyId },
        // SA_APPROVED loans directly assigned to agent (SuperAdmin skipped Company)
        { status: 'SA_APPROVED', currentHandlerId: agentId },
        // Loans that the agent has processed (status after agent action)
        { 
          status: { in: ['AGENT_APPROVED_STAGE1', 'LOAN_FORM_COMPLETED', 'SESSION_CREATED', 'CUSTOMER_SESSION_APPROVED', 'FINAL_APPROVED', 'ACTIVE', 'DISBURSED'] },
          currentHandlerId: agentId 
        }
      ];
    } else if (role === 'STAFF' && staffId) {
      // Staff sees loans assigned to them
      where.currentHandlerId = staffId;
    } else if (role === 'CASHIER') {
      // Cashier sees loans ready for disbursement
      where.status = { in: ['FINAL_APPROVED', 'ACTIVE', 'DISBURSED'] };
    } else if (role === 'ACCOUNTANT') {
      // Accountant sees all active/dispersed loans for reporting
      where.status = { in: ['ACTIVE', 'DISBURSED'] };
    } else if (agentId) {
      // Backward compatibility: if agentId is passed without role
      where.currentHandlerId = agentId;
    }

    const loans = await db.loanApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true }
        },
        company: {
          select: { id: true, name: true, code: true }
        },
        sessionForm: true,
        loanForm: true
      }
    });

    return NextResponse.json({ loans });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
  }
}
