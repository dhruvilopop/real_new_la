import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch comprehensive loan details
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
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            panNumber: true,
            aadhaarNumber: true,
            dateOfBirth: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            employmentType: true,
            monthlyIncome: true,
            bankAccountNumber: true,
            bankIfsc: true,
            bankName: true,
            createdAt: true
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true,
            state: true,
            contactEmail: true,
            contactPhone: true
          }
        },
        loanForm: true,
        sessionForm: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                agentCode: true
              }
            }
          }
        },
        workflowLogs: {
          orderBy: { createdAt: 'asc' },
          include: {
            actionBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        },
        emiSchedules: {
          orderBy: { installmentNumber: 'asc' }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            cashier: {
              select: { id: true, name: true, cashierCode: true }
            }
          }
        },
        disbursedBy: {
          select: { id: true, name: true, email: true }
        },
        rejectedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Calculate EMI summary
    const emiSummary = {
      totalEMIs: loan.emiSchedules.length,
      paidEMIs: loan.emiSchedules.filter((s: any) => s.paymentStatus === 'PAID').length,
      pendingEMIs: loan.emiSchedules.filter((s: any) => s.paymentStatus === 'PENDING').length,
      overdueEMIs: loan.emiSchedules.filter((s: any) => s.paymentStatus === 'OVERDUE').length,
      partiallyPaid: loan.emiSchedules.filter((s: any) => s.paymentStatus === 'PARTIALLY_PAID').length,
      totalAmount: loan.emiSchedules.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
      totalPaid: loan.emiSchedules.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0),
      totalPenalty: loan.emiSchedules.reduce((sum: number, s: any) => sum + (s.penaltyAmount || 0), 0),
      nextDueDate: null as Date | null,
      nextDueAmount: 0
    };

    emiSummary.totalPaid = loan.payments
      .filter((p: any) => p.status === 'COMPLETED')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const nextPending = loan.emiSchedules.find((s: any) => s.paymentStatus !== 'PAID');
    if (nextPending) {
      emiSummary.nextDueDate = nextPending.dueDate;
      emiSummary.nextDueAmount = nextPending.totalAmount - (nextPending.paidAmount || 0);
    }

    // Build workflow pipeline
    const workflowPipeline = buildWorkflowPipeline(loan.workflowLogs, loan);

    return NextResponse.json({
      success: true,
      loan,
      emiSummary,
      workflowPipeline
    });
  } catch (error) {
    console.error('Loan details fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch loan details' }, { status: 500 });
  }
}

function buildWorkflowPipeline(workflowLogs: any[], loan: any) {
  const stages = [
    { status: 'SUBMITTED', label: 'Application Submitted', role: 'Customer', timestamp: loan.submittedAt || loan.createdAt },
    { status: 'SA_APPROVED', label: 'Super Admin Approved', role: 'SUPER_ADMIN', timestamp: loan.saApprovedAt },
    { status: 'COMPANY_APPROVED', label: 'Company Approved', role: 'COMPANY', timestamp: loan.companyApprovedAt },
    { status: 'AGENT_APPROVED_STAGE1', label: 'Agent Approved', role: 'AGENT', timestamp: loan.agentApprovedAt },
    { status: 'LOAN_FORM_COMPLETED', label: 'Form Completed', role: 'STAFF', timestamp: loan.loanFormCompletedAt },
    { status: 'SESSION_CREATED', label: 'Sanction Created', role: 'AGENT', timestamp: loan.sessionCreatedAt },
    { status: 'CUSTOMER_SESSION_APPROVED', label: 'Customer Approved', role: 'CUSTOMER', timestamp: loan.customerApprovedAt },
    { status: 'FINAL_APPROVED', label: 'Final Approved', role: 'SUPER_ADMIN', timestamp: loan.finalApprovedAt },
    { status: 'ACTIVE', label: 'Disbursed', role: 'CASHIER', timestamp: loan.disbursedAt }
  ];

  const currentStatusIndex = stages.findIndex(s => s.status === loan.status);

  return stages.map((stage, index) => {
    const log = workflowLogs.find(l => l.newStatus === stage.status);
    const isCompleted = index <= currentStatusIndex || (loan.status.startsWith('REJECTED') && stage.status === loan.status);
    const isCurrent = stage.status === loan.status;

    return {
      ...stage,
      isCompleted,
      isCurrent,
      actionBy: log?.actionBy || null,
      remarks: log?.remarks || null,
      timestamp: log?.createdAt || stage.timestamp
    };
  });
}
