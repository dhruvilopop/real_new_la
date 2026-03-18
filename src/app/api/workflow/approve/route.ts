import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LoanStatus } from '@prisma/client';

const ALLOWED_ACTIONS: Record<string, Record<string, { 
  nextStatus: LoanStatus; 
  roles: string[];
  requiresAssignment?: 'companyId' | 'agentId' | 'staffId';
}>> = {
  SUBMITTED: {
    approve: { nextStatus: LoanStatus.SA_APPROVED, roles: ['SUPER_ADMIN'], requiresAssignment: 'companyId' },
    reject: { nextStatus: LoanStatus.REJECTED_BY_SA, roles: ['SUPER_ADMIN'] }
  },
  SA_APPROVED: {
    approve: { nextStatus: LoanStatus.COMPANY_APPROVED, roles: ['COMPANY'], requiresAssignment: 'agentId' },
    agent_direct_approve: { nextStatus: LoanStatus.AGENT_APPROVED_STAGE1, roles: ['AGENT'], requiresAssignment: 'staffId' },
    reject: { nextStatus: LoanStatus.REJECTED_BY_COMPANY, roles: ['COMPANY', 'AGENT'] }
  },
  COMPANY_APPROVED: {
    approve: { nextStatus: LoanStatus.AGENT_APPROVED_STAGE1, roles: ['AGENT'], requiresAssignment: 'staffId' },
    reject: { nextStatus: LoanStatus.REJECTED_FINAL, roles: ['AGENT'] }
  },
  AGENT_APPROVED_STAGE1: {
    complete_form: { nextStatus: LoanStatus.LOAN_FORM_COMPLETED, roles: ['STAFF'] },
    reject: { nextStatus: LoanStatus.REJECTED_FINAL, roles: ['STAFF'] }
  },
  LOAN_FORM_COMPLETED: {
    create_session: { nextStatus: LoanStatus.SESSION_CREATED, roles: ['AGENT'] }
  },
  SESSION_CREATED: {
    approve_session: { nextStatus: LoanStatus.CUSTOMER_SESSION_APPROVED, roles: ['CUSTOMER'] },
    reject_session: { nextStatus: LoanStatus.SESSION_REJECTED, roles: ['CUSTOMER'] }
  },
  CUSTOMER_SESSION_APPROVED: {
    approve: { nextStatus: LoanStatus.FINAL_APPROVED, roles: ['SUPER_ADMIN'] },
    reject: { nextStatus: LoanStatus.REJECTED_FINAL, roles: ['SUPER_ADMIN'] }
  },
  FINAL_APPROVED: {
    disburse: { nextStatus: LoanStatus.ACTIVE, roles: ['CASHIER'] }
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanId, loanIds, action, remarks, role, userId, companyId, agentId, staffId, disbursementData, isBulk } = body;

    // Handle bulk approval
    if (isBulk && loanIds && Array.isArray(loanIds) && loanIds.length > 0) {
      const results: { id: string; success: boolean; error?: string }[] = [];
      
      for (const id of loanIds) {
        try {
          await processSingleApproval({
            loanId: id,
            action,
            remarks,
            role,
            userId,
            companyId,
            agentId,
            staffId,
            disbursementData,
            request
          });
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: (error as Error).message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      return NextResponse.json({
        success: successCount > 0,
        message: `Processed ${successCount}/${loanIds.length} applications`,
        results
      });
    }

    // Single approval
    if (!loanId || !action || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await processSingleApproval({
      loanId, action, remarks, role, userId, companyId, agentId, staffId, disbursementData, request
    });

    return NextResponse.json({ success: true, loan: { id: loanId, status: result.nextStatus } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function processSingleApproval({
  loanId, action, remarks, role, userId, companyId, agentId, staffId, disbursementData, request
}: {
  loanId: string;
  action: string;
  remarks?: string;
  role: string;
  userId?: string;
  companyId?: string;
  agentId?: string;
  staffId?: string;
  disbursementData?: any;
  request: NextRequest;
}): Promise<{ nextStatus: LoanStatus }> {

  // Fast loan lookup - only get what we need
  const loan = await db.loanApplication.findUnique({
    where: { id: loanId },
    select: {
      id: true,
      status: true,
      applicationNo: true,
      customerId: true,
      companyId: true,
      currentHandlerId: true,
      sessionForm: { select: { processingFee: true } }
    }
  });

  if (!loan) throw new Error('Loan not found');

  const currentStatus = loan.status as string;
  const statusActions = ALLOWED_ACTIONS[currentStatus];
  if (!statusActions) throw new Error(`No actions for status: ${currentStatus}`);

  const normalizedRole = role.toUpperCase().replace(/\s+/g, '_');
  let normalizedAction = action.toLowerCase().replace(/\s+/g, '_');
  
  // Auto-detect agent_direct_approve
  if (currentStatus === 'SA_APPROVED' && normalizedAction === 'approve' && normalizedRole === 'AGENT') {
    if (loan.currentHandlerId && userId && loan.currentHandlerId === userId) {
      normalizedAction = 'agent_direct_approve';
    }
  }
  
  const actionConfig = statusActions[normalizedAction];
  if (!actionConfig) throw new Error(`Action '${action}' not allowed`);
  if (!actionConfig.roles.includes(normalizedRole)) throw new Error(`Role '${role}' not authorized`);

  const nextStatus = actionConfig.nextStatus;

  // Validation
  if (actionConfig.requiresAssignment === 'companyId' && !companyId) throw new Error('Company required');
  if (actionConfig.requiresAssignment === 'agentId' && !agentId) throw new Error('Agent required');
  if (actionConfig.requiresAssignment === 'staffId' && !staffId) throw new Error('Staff required');

  // Build update data
  const updateData: Record<string, unknown> = { status: nextStatus };
  if (companyId) updateData.companyId = companyId;
  if (staffId) { updateData.currentHandlerId = staffId; updateData.currentStage = 'STAFF_VERIFICATION'; }
  if (agentId) { updateData.currentHandlerId = agentId; updateData.currentStage = 'AGENT_SESSION'; }

  // Status-specific updates
  switch (nextStatus) {
    case LoanStatus.SA_APPROVED: updateData.saApprovedAt = new Date(); break;
    case LoanStatus.COMPANY_APPROVED: updateData.companyApprovedAt = new Date(); break;
    case LoanStatus.AGENT_APPROVED_STAGE1: updateData.agentApprovedAt = new Date(); break;
    case LoanStatus.LOAN_FORM_COMPLETED:
      updateData.loanFormCompletedAt = new Date();
      updateData.currentStage = 'SESSION_CREATION';
      if (userId) {
        const staff = await db.user.findUnique({ where: { id: userId }, select: { agentId: true } });
        if (staff?.agentId) updateData.currentHandlerId = staff.agentId;
      }
      break;
    case LoanStatus.SESSION_CREATED: updateData.sessionCreatedAt = new Date(); break;
    case LoanStatus.CUSTOMER_SESSION_APPROVED: updateData.customerApprovedAt = new Date(); break;
    case LoanStatus.FINAL_APPROVED: updateData.finalApprovedAt = new Date(); break;
    case LoanStatus.ACTIVE:
      updateData.disbursedAt = new Date();
      updateData.disbursedById = userId;
      updateData.currentStage = 'ACTIVE_LOAN';
      if (disbursementData) {
        updateData.disbursedAmount = disbursementData.amount;
        updateData.disbursementMode = disbursementData.mode;
        updateData.disbursementRef = disbursementData.reference;
      }
      break;
    case LoanStatus.REJECTED_BY_SA:
    case LoanStatus.REJECTED_BY_COMPANY:
    case LoanStatus.REJECTED_FINAL:
    case LoanStatus.SESSION_REJECTED:
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = remarks;
      updateData.rejectedById = userId;
      break;
  }

  // Single transaction for all critical operations
  await db.$transaction(async (tx) => {
    // Update loan
    await tx.loanApplication.update({ where: { id: loanId }, data: updateData });

    // Handle disbursement accounting
    if (nextStatus === LoanStatus.ACTIVE && disbursementData?.bankAccountId) {
      const bank = await tx.bankAccount.findUnique({ 
        where: { id: disbursementData.bankAccountId },
        select: { currentBalance: true }
      });
      
      if (bank && bank.currentBalance >= disbursementData.amount) {
        await tx.bankAccount.update({
          where: { id: disbursementData.bankAccountId },
          data: { currentBalance: { decrement: disbursementData.amount } }
        });
        
        await tx.bankTransaction.create({
          data: {
            bankAccountId: disbursementData.bankAccountId,
            transactionType: 'DEBIT',
            amount: disbursementData.amount,
            balanceAfter: bank.currentBalance - disbursementData.amount,
            description: `Loan Disbursement - ${loan.applicationNo}`,
            referenceType: 'LOAN_DISBURSEMENT',
            referenceId: loanId,
            createdById: userId || 'SYSTEM'
          }
        });
      }
    }

    // Create workflow log
    await tx.workflowLog.create({
      data: {
        loanApplicationId: loanId,
        actionById: userId || 'system',
        previousStatus: currentStatus,
        newStatus: nextStatus,
        action: normalizedAction,
        remarks,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });
  });

  // Non-critical operations - run in parallel (don't await)
  setImmediate(async () => {
    try {
      const parallelOps: Promise<unknown>[] = [];
      
      // Notification
      if (loan.customerId && ['SESSION_CREATED', 'FINAL_APPROVED', 'ACTIVE'].includes(nextStatus)) {
        const messages: Record<string, { title: string; message: string }> = {
          SESSION_CREATED: { title: 'Session Created', message: `Your loan session for ${loan.applicationNo} has been created.` },
          FINAL_APPROVED: { title: 'Loan Approved', message: `Your loan ${loan.applicationNo} has been approved.` },
          ACTIVE: { title: 'Loan Disbursed', message: `Your loan ${loan.applicationNo} has been disbursed.` }
        };
        if (messages[nextStatus]) {
          parallelOps.push(db.notification.create({
            data: { userId: loan.customerId, type: nextStatus, ...messages[nextStatus] }
          }));
        }
      }

      // Timeline
      parallelOps.push(db.loanProgressTimeline.create({
        data: {
          loanApplicationId: loanId,
          stage: nextStatus,
          status: 'COMPLETED',
          handlerId: userId || 'system',
          notes: remarks || `${currentStatus} → ${nextStatus}`
        }
      }));

      await Promise.all(parallelOps);
    } catch {}
  });

  return { nextStatus };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const loanId = searchParams.get('loanId');
  if (!loanId) return NextResponse.json({ error: 'Loan ID required' }, { status: 400 });

  const loan = await db.loanApplication.findUnique({
    where: { id: loanId },
    select: {
      status: true,
      workflowLogs: { 
        orderBy: { createdAt: 'desc' }, 
        take: 10, 
        select: { action: true, newStatus: true, createdAt: true, actionBy: { select: { name: true } } }
      }
    }
  });

  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const statusActions = ALLOWED_ACTIONS[loan.status as string] || {};
  return NextResponse.json({
    currentStatus: loan.status,
    possibleActions: Object.entries(statusActions).map(([action, config]) => ({
      action, nextStatus: config.nextStatus, allowedRoles: config.roles
    })),
    history: loan.workflowLogs
  });
}
