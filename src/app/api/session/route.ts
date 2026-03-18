import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateEMI } from '@/utils/helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanApplicationId, agentId, approvedAmount, interestRate, tenure, processingFee, processingFeeType, specialConditions } = body;

    if (!loanApplicationId || !agentId || !approvedAmount || !interestRate || !tenure) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if loan exists and is in correct status
    const loan = await db.loanApplication.findUnique({
      where: { id: loanApplicationId }
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan application not found' }, { status: 404 });
    }

    if (loan.status !== 'LOAN_FORM_COMPLETED') {
      return NextResponse.json(
        { error: 'Loan must be in LOAN_FORM_COMPLETED status to create session' },
        { status: 400 }
      );
    }

    // Check if session already exists
    const existingSession = await db.sessionForm.findUnique({
      where: { loanApplicationId }
    });

    if (existingSession) {
      return NextResponse.json(
        { error: 'Session already exists for this loan' },
        { status: 400 }
      );
    }

    // Calculate EMI
    const emiCalculation = calculateEMI(approvedAmount, interestRate, tenure);

    // Create session form
    const session = await db.sessionForm.create({
      data: {
        loanApplicationId,
        agentId,
        approvedAmount,
        interestRate,
        tenure,
        emiFrequency: 'MONTHLY',
        processingFee: processingFee || 0,
        processingFeeType: processingFeeType || 'PERCENTAGE',
        emiAmount: emiCalculation.emi,
        totalInterest: emiCalculation.totalInterest,
        totalAmount: emiCalculation.totalAmount,
        moratoriumPeriod: 0,
        latePaymentPenalty: 0,
        bounceCharges: 0,
        specialConditions,
        requestedAmount: loan.requestedAmount,
        requestedTenure: loan.requestedTenure,
        requestedInterestRate: loan.requestedInterestRate
      }
    });

    // Update loan status
    await db.loanApplication.update({
      where: { id: loanApplicationId },
      data: {
        status: 'SESSION_CREATED',
        sessionCreatedAt: new Date(),
        currentStage: 'CUSTOMER_APPROVAL'
      }
    });

    // Create workflow log
    await db.workflowLog.create({
      data: {
        loanApplicationId,
        actionById: agentId,
        previousStatus: 'LOAN_FORM_COMPLETED',
        newStatus: 'SESSION_CREATED',
        action: 'create_session',
        remarks: 'Loan session created by agent'
      }
    });

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        emiSchedule: emiCalculation.schedule
      }
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    const session = await db.sessionForm.findUnique({
      where: { loanApplicationId: loanId },
      include: {
        agent: { select: { id: true, name: true, agentCode: true } }
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get EMI schedule
    const emiCalculation = calculateEMI(
      session.approvedAmount,
      session.interestRate,
      session.tenure
    );

    return NextResponse.json({
      session,
      emiSchedule: emiCalculation.schedule
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanApplicationId, customerApproved, customerSignature, rejected, rejectionReason } = body;

    if (!loanApplicationId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    const session = await db.sessionForm.findUnique({
      where: { loanApplicationId }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (customerApproved) {
      const updated = await db.sessionForm.update({
        where: { loanApplicationId },
        data: {
          customerApproved: true,
          customerApprovedAt: new Date(),
          customerSignature,
          customerSignatureHash: customerSignature ? Buffer.from(customerSignature).toString('base64') : null
        }
      });

      await db.loanApplication.update({
        where: { id: loanApplicationId },
        data: {
          status: 'CUSTOMER_SESSION_APPROVED',
          customerApprovedAt: new Date()
        }
      });

      return NextResponse.json({ success: true, session: updated });
    }

    if (rejected) {
      const updated = await db.sessionForm.update({
        where: { loanApplicationId },
        data: {
          rejected: true,
          rejectedAt: new Date(),
          rejectionReason
        }
      });

      await db.loanApplication.update({
        where: { id: loanApplicationId },
        data: { status: 'SESSION_REJECTED' }
      });

      return NextResponse.json({ success: true, session: updated });
    }

    return NextResponse.json({ error: 'No action specified' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
