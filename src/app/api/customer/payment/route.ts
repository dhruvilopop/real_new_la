import { NextRequest, NextResponse } from 'next/server';
import { PaymentModeType, EMIPaymentStatus } from '@prisma/client';
import { db } from '@/lib/db';

// POST - Process EMI payment (Full, Partial, or Interest Only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      loanId,
      customerId,
      emiScheduleId,
      paymentType, // 'FULL_EMI', 'PARTIAL', 'INTEREST_ONLY'
      amount,
      nextPaymentDate,
      remarks
    } = body;

    console.log('Customer payment request:', { loanId, customerId, emiScheduleId, paymentType, amount });

    if (!loanId || !customerId || !emiScheduleId || !paymentType || !amount) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: { loanId: !!loanId, customerId: !!customerId, emiScheduleId: !!emiScheduleId, paymentType: !!paymentType, amount: !!amount }
      }, { status: 400 });
    }

    // Get EMI Schedule
    const emiSchedule = await db.eMISchedule.findUnique({
      where: { id: emiScheduleId },
      include: {
        loanApplication: {
          include: {
            customer: true,
            company: true,
            sessionForm: {
              include: {
                agent: {
                  select: { id: true, name: true, email: true }
                }
              }
            }
          }
        }
      }
    });

    if (!emiSchedule) {
      return NextResponse.json({ error: 'EMI schedule not found' }, { status: 404 });
    }

    if (emiSchedule.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'EMI already paid' }, { status: 400 });
    }

    // Sequential Payment Validation - Check if previous EMIs are paid
    const previousEmis = await db.eMISchedule.findMany({
      where: {
        loanApplicationId: loanId,
        installmentNumber: { lt: emiSchedule.installmentNumber },
        paymentStatus: { not: 'PAID' }
      }
    });

    if (previousEmis.length > 0) {
      const unpaidEmiNumbers = previousEmis.map(e => e.installmentNumber).sort((a, b) => a - b);
      return NextResponse.json({ 
        error: 'Sequential payment required',
        message: `Please pay EMI #${unpaidEmiNumbers[0]} first before paying this EMI`,
        unpaidEmis: unpaidEmiNumbers
      }, { status: 400 });
    }

    // Check if EMI already has partial payment - disable interest only option
    if (paymentType === 'INTEREST_ONLY' && emiSchedule.isPartialPayment) {
      return NextResponse.json({ 
        error: 'Interest only not available after partial payment',
        message: 'This EMI has a partial payment. Interest only option is not available.'
      }, { status: 400 });
    }

    const loan = emiSchedule.loanApplication;
    const paymentAmount = parseFloat(amount.toString());
    const totalAmount = emiSchedule.totalAmount;
    const principalAmount = emiSchedule.principalAmount;
    const interestAmount = emiSchedule.interestAmount;

    let updatedEmiSchedule: Awaited<ReturnType<typeof db.eMISchedule.update>> | null = null;
    let remainingAmount = 0;
    let newNextPaymentDate: Date | null = null;

    // Start transaction
    const result = await db.$transaction(async (tx) => {
      if (paymentType === 'FULL_EMI') {
        // Full EMI Payment
        const paidPrincipal = principalAmount;
        const paidInterest = interestAmount;

        updatedEmiSchedule = await tx.eMISchedule.update({
          where: { id: emiScheduleId },
          data: {
            paymentStatus: 'PAID',
            paidAmount: totalAmount,
            paidPrincipal: paidPrincipal,
            paidInterest: paidInterest,
            paidDate: new Date(),
            paymentMode: 'ONLINE',
            outstandingPrincipal: 0,
            outstandingInterest: 0
          }
        });

        // Create payment record
        await tx.payment.create({
          data: {
            loanApplicationId: loanId,
            emiScheduleId: emiScheduleId,
            customerId: customerId,
            amount: totalAmount,
            principalComponent: paidPrincipal,
            interestComponent: paidInterest,
            paymentMode: 'ONLINE',
            status: 'COMPLETED',
            paymentType: 'FULL_EMI',
            paidById: customerId,
            remarks: remarks || 'Full EMI payment by customer'
          }
        });

        // Create credit transaction for agent (if agent exists)
        const agentId = loan.sessionForm?.agentId || loan.sessionForm?.agent?.id;
        if (agentId) {
          // Get agent's current credit balance
          const agent = await tx.user.findUnique({
            where: { id: agentId },
            select: { personalCredit: true, companyCredit: true, credit: true }
          });
          
          const newPersonalCredit = (agent?.personalCredit || 0) + totalAmount;
          const newTotalCredit = (agent?.credit || 0) + totalAmount;
          
          await tx.creditTransaction.create({
            data: {
              userId: agentId,
              transactionType: 'CREDIT_INCREASE',
              amount: totalAmount,
              paymentMode: 'ONLINE' as PaymentModeType,
              creditType: 'PERSONAL',
              sourceType: 'EMI_PAYMENT',
              loanApplicationId: loanId,
              emiScheduleId: emiScheduleId,
              customerId: customerId,
              installmentNumber: emiSchedule.installmentNumber,
              customerName: loan.customer?.name,
              customerPhone: loan.customer?.phone,
              loanApplicationNo: loan.applicationNo,
              emiDueDate: emiSchedule.dueDate,
              emiAmount: totalAmount,
              principalComponent: paidPrincipal,
              interestComponent: paidInterest,
              personalBalanceAfter: newPersonalCredit,
              companyBalanceAfter: agent?.companyCredit || 0,
              balanceAfter: newTotalCredit,
              description: `EMI #${emiSchedule.installmentNumber} payment by customer`,
              remarks: remarks || 'Full EMI payment',
              transactionDate: new Date()
            }
          });
          
          // Update agent's credit
          await tx.user.update({
            where: { id: agentId },
            data: {
              personalCredit: newPersonalCredit,
              credit: newTotalCredit
            }
          });
        }

      } else if (paymentType === 'PARTIAL') {
        // Partial Payment
        if (!nextPaymentDate) {
          throw new Error('Next payment date is required for partial payment');
        }

        newNextPaymentDate = new Date(nextPaymentDate);
        remainingAmount = totalAmount - paymentAmount;
        const paidPrincipal = Math.min(paymentAmount, principalAmount);
        const paidInterest = Math.max(0, paymentAmount - paidPrincipal);

        updatedEmiSchedule = await tx.eMISchedule.update({
          where: { id: emiScheduleId },
          data: {
            paymentStatus: 'PARTIALLY_PAID',
            paidAmount: { increment: paymentAmount },
            paidPrincipal: { increment: paidPrincipal },
            paidInterest: { increment: paidInterest },
            isPartialPayment: true,
            nextPaymentDate: newNextPaymentDate,
            outstandingPrincipal: principalAmount - paidPrincipal,
            outstandingInterest: interestAmount - paidInterest,
            paymentMode: 'ONLINE',
            notes: `Partial payment of ${paymentAmount}. Remaining: ${remainingAmount} due on ${newNextPaymentDate.toISOString().split('T')[0]}`
          }
        });

        // Create payment record for partial payment
        await tx.payment.create({
          data: {
            loanApplicationId: loanId,
            emiScheduleId: emiScheduleId,
            customerId: customerId,
            amount: paymentAmount,
            principalComponent: paidPrincipal,
            interestComponent: paidInterest,
            paymentMode: 'ONLINE',
            status: 'COMPLETED',
            paymentType: 'PARTIAL_PAYMENT',
            paidById: customerId,
            remarks: `Partial payment. Remaining ${remainingAmount} due on ${newNextPaymentDate.toISOString().split('T')[0]}`
          }
        });

        // Create credit transaction for partial payment
        const partialAgentId = loan.sessionForm?.agentId || loan.sessionForm?.agent?.id;
        if (partialAgentId) {
          // Get agent's current credit balance
          const partialAgent = await tx.user.findUnique({
            where: { id: partialAgentId },
            select: { personalCredit: true, companyCredit: true, credit: true }
          });
          
          const partialNewPersonalCredit = (partialAgent?.personalCredit || 0) + paymentAmount;
          const partialNewTotalCredit = (partialAgent?.credit || 0) + paymentAmount;
          
          await tx.creditTransaction.create({
            data: {
              userId: partialAgentId,
              transactionType: 'CREDIT_INCREASE',
              amount: paymentAmount,
              paymentMode: 'ONLINE' as PaymentModeType,
              creditType: 'PERSONAL',
              sourceType: 'EMI_PAYMENT',
              loanApplicationId: loanId,
              emiScheduleId: emiScheduleId,
              customerId: customerId,
              installmentNumber: emiSchedule.installmentNumber,
              customerName: loan.customer?.name,
              customerPhone: loan.customer?.phone,
              loanApplicationNo: loan.applicationNo,
              emiDueDate: emiSchedule.dueDate,
              emiAmount: totalAmount,
              principalComponent: paidPrincipal,
              interestComponent: paidInterest,
              personalBalanceAfter: partialNewPersonalCredit,
              companyBalanceAfter: partialAgent?.companyCredit || 0,
              balanceAfter: partialNewTotalCredit,
              description: `Partial EMI #${emiSchedule.installmentNumber} payment`,
              remarks: `Partial payment. Remaining ${remainingAmount} due on ${newNextPaymentDate.toISOString().split('T')[0]}`,
              transactionDate: new Date()
            }
          });
          
          // Update agent's credit
          await tx.user.update({
            where: { id: partialAgentId },
            data: {
              personalCredit: partialNewPersonalCredit,
              credit: partialNewTotalCredit
            }
          });
        }

      } else if (paymentType === 'INTEREST_ONLY') {
        // Interest Only Payment - defer principal to next month
        const paidInterest = interestAmount;
        const deferredPrincipal = principalAmount;

        updatedEmiSchedule = await tx.eMISchedule.update({
          where: { id: emiScheduleId },
          data: {
            paymentStatus: 'PAID',
            paidAmount: interestAmount,
            paidPrincipal: 0,
            paidInterest: paidInterest,
            isInterestOnly: true,
            principalDeferred: true,
            outstandingPrincipal: deferredPrincipal,
            outstandingInterest: 0,
            paidDate: new Date(),
            notes: 'Interest only payment - principal deferred to next EMI'
          }
        });

        // Create payment record
        await tx.payment.create({
          data: {
            loanApplicationId: loanId,
            emiScheduleId: emiScheduleId,
            customerId: customerId,
            amount: interestAmount,
            principalComponent: 0,
            interestComponent: paidInterest,
            paymentMode: 'ONLINE',
            status: 'COMPLETED',
            paymentType: 'INTEREST_ONLY',
            paidById: customerId,
            remarks: 'Interest only payment - principal deferred'
          }
        });

        // Create credit transaction for interest payment
        const interestAgentId = loan.sessionForm?.agentId || loan.sessionForm?.agent?.id;
        if (interestAgentId) {
          // Get agent's current credit balance
          const interestAgent = await tx.user.findUnique({
            where: { id: interestAgentId },
            select: { personalCredit: true, companyCredit: true, credit: true }
          });
          
          const interestNewPersonalCredit = (interestAgent?.personalCredit || 0) + interestAmount;
          const interestNewTotalCredit = (interestAgent?.credit || 0) + interestAmount;
          
          await tx.creditTransaction.create({
            data: {
              userId: interestAgentId,
              transactionType: 'CREDIT_INCREASE',
              amount: interestAmount,
              paymentMode: 'ONLINE' as PaymentModeType,
              creditType: 'PERSONAL',
              sourceType: 'EMI_PAYMENT',
              loanApplicationId: loanId,
              emiScheduleId: emiScheduleId,
              customerId: customerId,
              installmentNumber: emiSchedule.installmentNumber,
              customerName: loan.customer?.name,
              customerPhone: loan.customer?.phone,
              loanApplicationNo: loan.applicationNo,
              emiDueDate: emiSchedule.dueDate,
              emiAmount: interestAmount,
              principalComponent: 0,
              interestComponent: paidInterest,
              personalBalanceAfter: interestNewPersonalCredit,
              companyBalanceAfter: interestAgent?.companyCredit || 0,
              balanceAfter: interestNewTotalCredit,
              description: `Interest only payment for EMI #${emiSchedule.installmentNumber}`,
              remarks: 'Interest only - principal deferred',
              transactionDate: new Date()
            }
          });
          
          // Update agent's credit
          await tx.user.update({
            where: { id: interestAgentId },
            data: {
              personalCredit: interestNewPersonalCredit,
              credit: interestNewTotalCredit
            }
          });
        }

        // Shift the EMI to next month - add principal to next EMI
        const nextEmis = await tx.eMISchedule.findMany({
          where: {
            loanApplicationId: loanId,
            paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] }
          },
          orderBy: { installmentNumber: 'asc' }
        });

        if (nextEmis.length > 0) {
          const nextEmi = nextEmis[0];
          const nextDueDate = new Date(nextEmi.dueDate);
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);

          await tx.eMISchedule.update({
            where: { id: nextEmi.id },
            data: {
              dueDate: nextDueDate,
              originalDueDate: nextEmi.originalDueDate || nextEmi.dueDate,
              principalAmount: { increment: deferredPrincipal },
              totalAmount: { increment: deferredPrincipal },
              notes: `Includes deferred principal from EMI #${emiSchedule.installmentNumber}`
            }
          });
        } else {
          // No more EMIs - create a new one for the deferred principal
          const lastEmi = await tx.eMISchedule.findFirst({
            where: { loanApplicationId: loanId },
            orderBy: { installmentNumber: 'desc' }
          });

          const newDueDate = new Date();
          newDueDate.setMonth(newDueDate.getMonth() + 1);

          await tx.eMISchedule.create({
            data: {
              loanApplicationId: loanId,
              installmentNumber: (lastEmi?.installmentNumber || 0) + 1,
              dueDate: newDueDate,
              originalDueDate: newDueDate,
              principalAmount: deferredPrincipal,
              interestAmount: 0,
              totalAmount: deferredPrincipal,
              outstandingPrincipal: deferredPrincipal,
              outstandingInterest: 0,
              paymentStatus: EMIPaymentStatus.PENDING,
              paidAmount: 0,
              notes: 'Deferred principal from interest-only payment'
            }
          });
        }
      }

      // Update loan's last activity
      await tx.loanApplication.update({
        where: { id: loanId },
        data: { updatedAt: new Date() }
      });

      return updatedEmiSchedule;
    });

    return NextResponse.json({
      success: true,
      payment: {
        amount: paymentAmount,
        type: paymentType,
        remainingAmount: remainingAmount > 0 ? remainingAmount : undefined,
        nextPaymentDate: (newNextPaymentDate as Date | null)?.toISOString()
      },
      emiSchedule: result
    });

  } catch (error) {
    console.error('Payment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payment processing failed' },
      { status: 500 }
    );
  }
}
