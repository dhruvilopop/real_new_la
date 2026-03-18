import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LoanStatus } from '@prisma/client';
import { createLoanDisbursementEntry, createProcessingFeeEntry } from '@/lib/accounting-service';

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
    // Company approves SA_APPROVED loans and assigns to Agent
    approve: { nextStatus: LoanStatus.COMPANY_APPROVED, roles: ['COMPANY'], requiresAssignment: 'agentId' },
    // Agent can approve directly if SuperAdmin assigned them (skipping Company step)
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
          const result = await processSingleApproval({
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
      const failCount = results.filter(r => !r.success).length;
      
      return NextResponse.json({
        success: successCount > 0,
        message: `Processed ${successCount} of ${loanIds.length} applications`,
        results,
        successCount,
        failCount
      });
    }

    // Handle single approval
    if (!loanId || !action || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: loanId, action, role' },
        { status: 400 }
      );
    }

    const result = await processSingleApproval({
      loanId,
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

    return NextResponse.json({
      success: true,
      loan: { id: loanId, status: result.nextStatus, previousStatus: result.previousStatus }
    });
  } catch (error) {
    console.error('Workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to process workflow action', details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function processSingleApproval({
  loanId,
  action,
  remarks,
  role,
  userId,
  companyId,
  agentId,
  staffId,
  disbursementData,
  request
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
}): Promise<{ nextStatus: LoanStatus; previousStatus: string }> {

  const loan = await db.loanApplication.findUnique({
    where: { id: loanId },
    include: { company: true, sessionForm: true, loanForm: true, customer: true }
  });

  if (!loan) {
    throw new Error('Loan not found');
  }

  const currentStatus = loan.status as string;
  const statusActions = ALLOWED_ACTIONS[currentStatus];
  
  if (!statusActions) {
    throw new Error(`No actions allowed for status: ${currentStatus}`);
  }

  const normalizedRole = role.toUpperCase().replace(/\s+/g, '_');
  let normalizedAction = action.toLowerCase().replace(/\s+/g, '_');
  
  // Auto-detect agent_direct_approve for SA_APPROVED loans when Agent is the currentHandler
  // This happens when SuperAdmin directly assigns loan to Agent (skipping Company step)
  if (currentStatus === 'SA_APPROVED' && normalizedAction === 'approve' && normalizedRole === 'AGENT') {
    // Check if this agent is assigned as currentHandler (SuperAdmin assigned directly)
    if (loan.currentHandlerId && userId && loan.currentHandlerId === userId) {
      normalizedAction = 'agent_direct_approve';
    }
  }
  
  const actionConfig = statusActions[normalizedAction];
  
  if (!actionConfig) {
    throw new Error(`Action '${action}' not allowed for status ${currentStatus}. Allowed: ${Object.keys(statusActions).join(', ')}`);
  }

  if (!actionConfig.roles.includes(normalizedRole)) {
    throw new Error(`Role '${role}' is not authorized for this action. Required: ${actionConfig.roles.join(' or ')}`);
  }

  const nextStatus = actionConfig.nextStatus;

  if (actionConfig.requiresAssignment === 'companyId' && !companyId) {
    throw new Error('Company selection is required for approval');
  }

  if (actionConfig.requiresAssignment === 'agentId' && !agentId) {
    throw new Error('Agent selection is required for approval');
  }

  if (actionConfig.requiresAssignment === 'staffId' && !staffId) {
    throw new Error('Staff selection is required for approval');
  }

  const updateData: Record<string, unknown> = {
    status: nextStatus,
    updatedAt: new Date()
  };

  if (companyId) updateData.companyId = companyId;
  if (staffId) {
    updateData.currentHandlerId = staffId;
    updateData.currentStage = 'STAFF_VERIFICATION';
  }
  if (agentId) {
    updateData.currentHandlerId = agentId;
    updateData.currentStage = 'AGENT_SESSION';
  }

  switch (nextStatus) {
    case LoanStatus.SA_APPROVED:
      updateData.saApprovedAt = new Date();
      break;
    case LoanStatus.COMPANY_APPROVED:
      updateData.companyApprovedAt = new Date();
      break;
    case LoanStatus.AGENT_APPROVED_STAGE1:
      updateData.agentApprovedAt = new Date();
      break;
    case LoanStatus.LOAN_FORM_COMPLETED:
      updateData.loanFormCompletedAt = new Date();
      updateData.currentStage = 'SESSION_CREATION';
      // Reassign back to the agent who assigned this staff
      const staff = await db.user.findUnique({
        where: { id: userId }
      });
      if (staff?.agentId) {
        updateData.currentHandlerId = staff.agentId;
      }
      break;
    case LoanStatus.SESSION_CREATED:
      updateData.sessionCreatedAt = new Date();
      break;
    case LoanStatus.CUSTOMER_SESSION_APPROVED:
      updateData.customerApprovedAt = new Date();
      break;
    case LoanStatus.FINAL_APPROVED:
      updateData.finalApprovedAt = new Date();
      break;
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

  await db.loanApplication.update({
    where: { id: loanId },
    data: updateData
  });

  // Create accounting entries for loan disbursement
  if (nextStatus === LoanStatus.ACTIVE && disbursementData) {
    try {
      // Deduct from bank account if bankAccountId is provided
      if (disbursementData.bankAccountId) {
        const bankAccount = await db.bankAccount.findUnique({
          where: { id: disbursementData.bankAccountId }
        });

        if (bankAccount) {
          if (bankAccount.currentBalance < disbursementData.amount) {
            throw new Error(`Insufficient bank balance. Available: ${bankAccount.currentBalance}, Required: ${disbursementData.amount}`);
          }

          // Deduct from bank balance
          await db.bankAccount.update({
            where: { id: disbursementData.bankAccountId },
            data: {
              currentBalance: { decrement: disbursementData.amount }
            }
          });

          // Create bank transaction log
          await db.bankTransaction.create({
            data: {
              bankAccountId: disbursementData.bankAccountId,
              transactionType: 'DEBIT',
              amount: disbursementData.amount,
              balanceAfter: bankAccount.currentBalance - disbursementData.amount,
              description: `Loan Disbursement - ${loan.applicationNo} - ${loan.customer?.name || 'Customer'}`,
              referenceType: 'LOAN_DISBURSEMENT',
              referenceId: loanId,
              createdById: userId || 'SYSTEM'
            }
          });
        }
      }

      // Create loan disbursement journal entry
      await createLoanDisbursementEntry({
        loanId,
        customerId: loan.customerId,
        amount: disbursementData.amount,
        disbursementDate: new Date(),
        createdById: userId || 'SYSTEM',
      });

      // Create processing fee entry if applicable
      if (loan.sessionForm?.processingFee && loan.sessionForm.processingFee > 0) {
        await createProcessingFeeEntry({
          loanId,
          customerId: loan.customerId,
          amount: loan.sessionForm.processingFee,
          collectionDate: new Date(),
          createdById: userId || 'SYSTEM',
        });
      }
    } catch (accountingError) {
      console.error('Loan disbursement accounting entry failed:', accountingError);
      // Don't fail the disbursement if accounting fails
    }
  }

  // Create workflow log
  await db.workflowLog.create({
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

  // Create notification for customer if needed
  if (nextStatus === LoanStatus.SESSION_CREATED && loan.customerId) {
    await db.notification.create({
      data: {
        userId: loan.customerId,
        type: 'SESSION_CREATED',
        title: 'Loan Session Created',
        message: `Your loan session for ${loan.applicationNo} has been created. Please review and approve.`
      }
    });
  }

  if (nextStatus === LoanStatus.FINAL_APPROVED && loan.customerId) {
    await db.notification.create({
      data: {
        userId: loan.customerId,
        type: 'LOAN_APPROVED',
        title: 'Loan Approved',
        message: `Congratulations! Your loan ${loan.applicationNo} has been fully approved and is ready for disbursement.`
      }
    });
  }

  if (nextStatus === LoanStatus.ACTIVE && loan.customerId) {
    await db.notification.create({
      data: {
        userId: loan.customerId,
        type: 'LOAN_DISBURSED',
        title: 'Loan Disbursed',
        message: `Your loan ${loan.applicationNo} has been disbursed. Amount: ₹${disbursementData?.amount?.toLocaleString() || 'N/A'}`
      }
    });
  }

  // Create timeline entry
  await db.loanProgressTimeline.create({
    data: {
      loanApplicationId: loanId,
      stage: nextStatus,
      status: 'COMPLETED',
      handlerId: userId || 'system',
      notes: remarks || `Status changed from ${currentStatus} to ${nextStatus}`
    }
  });

  return { nextStatus, previousStatus: currentStatus };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    const loan = await db.loanApplication.findUnique({
      where: { id: loanId },
      include: {
        workflowLogs: { orderBy: { createdAt: 'asc' }, take: 20, include: { actionBy: { select: { name: true, email: true } } } },
        customer: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } }
      }
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const currentStatus = loan.status as string;
    const statusActions = ALLOWED_ACTIONS[currentStatus] || {};

    return NextResponse.json({
      currentStatus,
      possibleActions: Object.entries(statusActions).map(([action, config]) => ({
        action,
        nextStatus: config.nextStatus,
        allowedRoles: config.roles,
        requiresAssignment: config.requiresAssignment
      })),
      workflowHistory: loan.workflowLogs,
      loan: {
        id: loan.id,
        applicationNo: loan.applicationNo,
        status: loan.status,
        customer: loan.customer,
        company: loan.company
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch workflow status' }, { status: 500 });
  }
}
