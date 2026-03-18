import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EMIPaymentStatus, CreditType, CreditTransactionType, PaymentModeType } from '@prisma/client';
import { calculateEMI } from '@/utils/helpers';

// GET - Fetch EMI schedules with NPA tracking
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const status = searchParams.get('status');
    const action = searchParams.get('action');

    // NPA status check
    if (action === 'check-npa') {
      return await checkNPAStatus(loanId);
    }

    // Get all NPA accounts
    if (action === 'all-npa') {
      const npaAccounts = await db.nPATracking.findMany({
        where: { npaStatus: { in: ['SMA1', 'SMA2', 'NPA'] } },
        include: {
          loanApplication: {
            include: {
              customer: { select: { id: true, name: true, email: true, phone: true } },
              company: { select: { name: true } },
              sessionForm: { select: { approvedAmount: true, emiAmount: true } }
            }
          }
        },
        orderBy: { daysOverdue: 'desc' }
      });
      return NextResponse.json({ success: true, npaAccounts });
    }

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { loanApplicationId: loanId };
    if (status) where.paymentStatus = status;

    const schedules = await db.eMISchedule.findMany({
      where,
      orderBy: { installmentNumber: 'asc' }
    });

    // Calculate summary
    const summary = {
      totalEMIs: schedules.length,
      paidEMIs: schedules.filter(s => s.paymentStatus === 'PAID').length,
      pendingEMIs: schedules.filter(s => s.paymentStatus === 'PENDING').length,
      overdueEMIs: schedules.filter(s => s.paymentStatus === 'OVERDUE').length,
      partiallyPaid: schedules.filter(s => s.paymentStatus === 'PARTIALLY_PAID').length,
      totalAmount: schedules.reduce((sum, s) => sum + s.totalAmount, 0),
      totalPaid: schedules.reduce((sum, s) => sum + (s.paidAmount || 0), 0),
      totalPenalty: schedules.reduce((sum, s) => sum + (s.penaltyAmount || 0), 0),
      totalOutstanding: 0,
      nextDueDate: null as Date | null,
      nextDueAmount: 0
    };

    summary.totalOutstanding = summary.totalAmount - summary.totalPaid;

    const nextPending = schedules.find(s => s.paymentStatus !== 'PAID');
    if (nextPending) {
      summary.nextDueDate = nextPending.dueDate;
      summary.nextDueAmount = nextPending.totalAmount - (nextPending.paidAmount || 0);
    }

    return NextResponse.json({ schedules, summary });
  } catch (error) {
    console.error('EMI fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch EMI schedules' }, { status: 500 });
  }
}

// POST - Create EMI schedule or update overdue status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanId, action, graceDays = 5 } = body;

    // Update overdue status
    if (action === 'update-overdue') {
      return await updateOverdueStatus();
    }

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    const loan = await db.loanApplication.findUnique({
      where: { id: loanId },
      include: { sessionForm: true, company: { include: { gracePeriodConfigs: true } } }
    });

    if (!loan || !loan.sessionForm) {
      return NextResponse.json({ error: 'Loan or session form not found' }, { status: 400 });
    }

    const existingSchedules = await db.eMISchedule.findMany({
      where: { loanApplicationId: loanId }
    });

    if (existingSchedules.length > 0) {
      return NextResponse.json({ error: 'EMI schedules already exist', count: existingSchedules.length }, { status: 400 });
    }

    const { approvedAmount, interestRate, tenure, emiAmount } = loan.sessionForm;
    const startDate = loan.disbursedAt || new Date();

    const emiCalculation = calculateEMI(approvedAmount, interestRate, tenure, startDate);

    const schedules = await Promise.all(
      emiCalculation.schedule.map((item) =>
        db.eMISchedule.create({
          data: {
            loanApplicationId: loanId,
            installmentNumber: item.installmentNumber,
            dueDate: item.dueDate,
            originalDueDate: item.dueDate,
            principalAmount: item.principal,
            interestAmount: item.interest,
            totalAmount: item.totalAmount,
            outstandingPrincipal: item.outstandingPrincipal,
            outstandingInterest: 0,
            paymentStatus: EMIPaymentStatus.PENDING
          }
        })
      )
    );

    return NextResponse.json({ success: true, count: schedules.length, schedules });
  } catch (error) {
    console.error('EMI creation error:', error);
    return NextResponse.json({ error: 'Failed to generate EMI schedule' }, { status: 500 });
  }
}

// Update overdue status for all loans
async function updateOverdueStatus() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all pending EMIs that are past due date
  const overdueEmis = await db.eMISchedule.findMany({
    where: {
      paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] },
      dueDate: { lt: today }
    },
    include: {
      loanApplication: {
        include: {
          company: { include: { gracePeriodConfigs: true } }
        }
      }
    }
  });

  let updatedCount = 0;
  const npaUpdates: Array<{ loanId: string; daysOverdue: number; status: string }> = [];

  for (const emi of overdueEmis) {
    const dueDate = new Date(emi.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get grace period config
    const graceConfig = emi.loanApplication?.company?.gracePeriodConfigs?.[0];
    const graceDays = graceConfig?.graceDays || 5;
    const dailyPenalty = graceConfig?.dailyPenalty || 0.1;

    // Calculate penalty
    let penaltyAmount = emi.penaltyAmount || 0;
    if (daysOverdue > graceDays) {
      const penaltyDays = daysOverdue - graceDays;
      penaltyAmount = (emi.totalAmount * dailyPenalty / 100) * penaltyDays;
    }

    // Update EMI status
    await db.eMISchedule.update({
      where: { id: emi.id },
      data: {
        paymentStatus: EMIPaymentStatus.OVERDUE,
        daysOverdue,
        penaltyAmount
      }
    });

    updatedCount++;

    // Check for NPA status
    if (daysOverdue >= 30) {
      npaUpdates.push({
        loanId: emi.loanApplicationId,
        daysOverdue,
        status: daysOverdue >= 90 ? 'NPA' : daysOverdue >= 60 ? 'SMA2' : 'SMA1'
      });
    }
  }

  // Update NPA tracking
  for (const npa of npaUpdates) {
    const existingNpa = await db.nPATracking.findFirst({
      where: { loanApplicationId: npa.loanId }
    });

    // Calculate total overdue amount
    const loanEmis = await db.eMISchedule.findMany({
      where: { loanApplicationId: npa.loanId, paymentStatus: 'OVERDUE' }
    });
    const totalOverdue = loanEmis.reduce((sum, e) => sum + e.totalAmount - (e.paidAmount || 0) + (e.penaltyAmount || 0), 0);

    if (existingNpa) {
      await db.nPATracking.update({
        where: { id: existingNpa.id },
        data: {
          daysOverdue: npa.daysOverdue,
          npaStatus: npa.status,
          npaDate: npa.status === 'NPA' ? new Date() : existingNpa.npaDate,
          totalOverdue
        }
      });
    } else {
      await db.nPATracking.create({
        data: {
          loanApplicationId: npa.loanId,
          daysOverdue: npa.daysOverdue,
          npaStatus: npa.status,
          npaDate: npa.status === 'NPA' ? new Date() : null,
          totalOverdue
        }
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: `Updated ${updatedCount} overdue EMIs`,
    npaUpdates: npaUpdates.length
  });
}

// Check NPA status for specific loan
async function checkNPAStatus(loanId: string | null) {
  if (!loanId) {
    return NextResponse.json({ error: 'Loan ID is required for NPA check' }, { status: 400 });
  }

  const npaTracking = await db.nPATracking.findFirst({
    where: { loanApplicationId: loanId },
    include: {
      loanApplication: {
        include: {
          customer: { select: { name: true, email: true, phone: true } },
          sessionForm: { select: { approvedAmount: true, emiAmount: true } }
        }
      }
    }
  });

  // If no NPA tracking, calculate current status
  if (!npaTracking) {
    const overdueEmis = await db.eMISchedule.findMany({
      where: { loanApplicationId: loanId, paymentStatus: 'OVERDUE' },
      orderBy: { daysOverdue: 'desc' }
    });

    if (overdueEmis.length === 0) {
      return NextResponse.json({ 
        success: true, 
        npaStatus: null,
        message: 'No overdue EMIs for this loan' 
      });
    }

    const maxDaysOverdue = Math.max(...overdueEmis.map(e => e.daysOverdue || 0));
    const totalOverdue = overdueEmis.reduce((sum, e) => sum + e.totalAmount - (e.paidAmount || 0), 0);

    let status = 'SMA0';
    if (maxDaysOverdue >= 90) status = 'NPA';
    else if (maxDaysOverdue >= 60) status = 'SMA2';
    else if (maxDaysOverdue >= 30) status = 'SMA1';

    return NextResponse.json({
      success: true,
      npaStatus: {
        status,
        daysOverdue: maxDaysOverdue,
        totalOverdue,
        overdueEmiCount: overdueEmis.length
      }
    });
  }

  return NextResponse.json({ success: true, npaTracking });
}

// PUT - Pay EMI (INCREASE credit when collecting money from customer)
// CREDIT SYSTEM LOGIC:
// - When role pays EMI for customer, they COLLECT money from customer
// - Their credit INCREASES by the EMI amount
// - CASH payment → Company Credit (no proof required)
// - Non-CASH payment → Personal Credit (proof required)
// PAYMENT TYPES:
// - FULL: Pay full EMI amount
// - PARTIAL: Pay partial amount, remaining due on specified date
// - INTEREST_ONLY: Pay only interest, principal shifted to next EMI
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      emiId, action, data, loanId, paidAmount, paymentMode, paymentRef, 
      creditType, remarks, proofUrl, userId, paymentType, remainingAmount, 
      remainingPaymentDate, interestAmount 
    } = body;

    // Pay EMI - This INCREASES the user's credit
    if (action === 'pay' || paidAmount !== undefined) {
      if (!emiId || !loanId || !paidAmount || !userId) {
        return NextResponse.json({ error: 'Missing required fields for payment' }, { status: 400 });
      }

      // Validate partial payment
      if (paymentType === 'PARTIAL') {
        if (!remainingPaymentDate) {
          return NextResponse.json({ error: 'Remaining payment date is required for partial payment' }, { status: 400 });
        }
        if (!remainingAmount || remainingAmount <= 0) {
          return NextResponse.json({ error: 'Remaining amount must be greater than 0 for partial payment' }, { status: 400 });
        }
      }

      // Get EMI details
      const emi = await db.eMISchedule.findUnique({
        where: { id: emiId },
        include: { 
          loanApplication: { 
            include: { 
              company: true,
              customer: { select: { id: true, name: true, phone: true } },
              sessionForm: { select: { emiAmount: true, interestRate: true } }
            } 
          } 
        }
      });

      if (!emi) {
        return NextResponse.json({ error: 'EMI not found' }, { status: 404 });
      }

      if (emi.paymentStatus === 'PAID') {
        return NextResponse.json({ error: 'EMI already paid' }, { status: 400 });
      }

      // Get user (the one paying EMI - collecting money from customer)
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { 
          id: true,
          name: true,
          role: true,
          companyCredit: true, 
          personalCredit: true,
          credit: true,
          companyId: true
        }
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Determine credit type based on payment mode
      // CASH → Company Credit (no proof required)
      // Non-CASH → Personal Credit (proof required)
      const actualPaymentMode = paymentMode || 'CASH';
      const actualCreditType: CreditType = creditType === 'PERSONAL' || actualPaymentMode !== 'CASH'
        ? CreditType.PERSONAL 
        : CreditType.COMPANY;

      // Validate proof requirements
      // Personal Credit ALWAYS requires proof
      // Company Credit only for CASH (no proof required for CASH)
      const requiresProof = actualCreditType === CreditType.PERSONAL;
      
      if (requiresProof && !proofUrl) {
        return NextResponse.json({ 
          error: 'Proof document is required for Personal Credit transactions',
          requiresProof: true 
        }, { status: 400 });
      }

      // Calculate new credit balances (CREDIT INCREASES)
      const newCompanyCredit = actualCreditType === CreditType.COMPANY 
        ? user.companyCredit + paidAmount 
        : user.companyCredit;
      const newPersonalCredit = actualCreditType === CreditType.PERSONAL 
        ? user.personalCredit + paidAmount 
        : user.personalCredit;
      const newTotalCredit = newCompanyCredit + newPersonalCredit;

      // Determine payment status based on payment type
      let newPaymentStatus: EMIPaymentStatus = emi.paymentStatus;
      let updatedPaidAmount = (emi.paidAmount || 0) + paidAmount;
      let emiNotes = remarks || '';

      if (paymentType === 'INTEREST_ONLY') {
        // Interest only - mark as partially paid, principal goes to next EMI
        newPaymentStatus = EMIPaymentStatus.PARTIALLY_PAID;
        emiNotes = `${emiNotes}\n[INTEREST ONLY] Paid interest ₹${paidAmount}. Principal ₹${emi.principalAmount} deferred.`;
      } else if (paymentType === 'PARTIAL') {
        // Partial payment
        newPaymentStatus = EMIPaymentStatus.PARTIALLY_PAID;
        emiNotes = `${emiNotes}\n[PARTIAL] Paid ₹${paidAmount}. Remaining ₹${remainingAmount} due on ${remainingPaymentDate}.`;
      } else {
        // Full payment
        newPaymentStatus = updatedPaidAmount >= emi.totalAmount ? EMIPaymentStatus.PAID : EMIPaymentStatus.PARTIALLY_PAID;
      }

      // Start transaction
      const result = await db.$transaction(async (tx) => {
        // Update EMI status
        const updatedEmi = await tx.eMISchedule.update({
          where: { id: emiId },
          data: {
            paymentStatus: newPaymentStatus,
            paidAmount: updatedPaidAmount,
            paidDate: new Date(),
            paymentMode: actualPaymentMode,
            paymentReference: paymentRef,
            proofUrl: proofUrl,
            notes: emiNotes
          }
        });

        // Handle INTEREST_ONLY payment - add principal to next EMI
        if (paymentType === 'INTEREST_ONLY') {
          const nextEmi = await tx.eMISchedule.findFirst({
            where: {
              loanApplicationId: loanId,
              installmentNumber: emi.installmentNumber + 1
            }
          });

          if (nextEmi) {
            // Add principal to next EMI
            await tx.eMISchedule.update({
              where: { id: nextEmi.id },
              data: {
                principalAmount: nextEmi.principalAmount + emi.principalAmount,
                totalAmount: nextEmi.totalAmount + emi.principalAmount,
                notes: `${nextEmi.notes || ''}\n[PRINCIPAL DEFERRED] ₹${emi.principalAmount} added from EMI #${emi.installmentNumber} (Interest Only Payment)`
              }
            });
          } else {
            // No next EMI exists, create a new one for the deferred principal
            await tx.eMISchedule.create({
              data: {
                loanApplicationId: loanId,
                installmentNumber: emi.installmentNumber + 1,
                dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                originalDueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                principalAmount: emi.principalAmount,
                interestAmount: 0,
                totalAmount: emi.principalAmount,
                outstandingPrincipal: emi.principalAmount,
                outstandingInterest: 0,
                paymentStatus: EMIPaymentStatus.PENDING,
                notes: `[DEFERRED PRINCIPAL] From EMI #${emi.installmentNumber} (Interest Only Payment)`
              }
            });
          }
        }

        // Handle PARTIAL payment - update due date for remaining amount
        if (paymentType === 'PARTIAL' && remainingPaymentDate) {
          // Shift next EMI due date based on remaining payment date
          const nextEmi = await tx.eMISchedule.findFirst({
            where: {
              loanApplicationId: loanId,
              installmentNumber: emi.installmentNumber + 1
            }
          });

          if (nextEmi && nextEmi.paymentStatus !== 'PAID') {
            const remainingDate = new Date(remainingPaymentDate);
            // Shift next EMI to after the remaining payment date
            const newNextDueDate = new Date(remainingDate);
            newNextDueDate.setMonth(newNextDueDate.getMonth() + 1);

            await tx.eMISchedule.update({
              where: { id: nextEmi.id },
              data: {
                dueDate: newNextDueDate,
                notes: `${nextEmi.notes || ''}\n[AUTO-SHIFT] Due date shifted due to partial payment on EMI #${emi.installmentNumber}`
              }
            });
          }
        }

        // Create payment record
        await tx.payment.create({
          data: {
            loanApplicationId: loanId,
            emiScheduleId: emiId,
            customerId: emi.loanApplication?.customerId || '',
            amount: paidAmount,
            paymentMode: actualPaymentMode,
            status: 'COMPLETED',
            paidById: userId,
            proofUrl: proofUrl,
            remarks: `${remarks || ''}\nPayment Type: ${paymentType || 'FULL'}`
          }
        });

        // INCREASE user's credit (they collected money from customer)
        await tx.user.update({
          where: { id: userId },
          data: { 
            credit: newTotalCredit,
            companyCredit: newCompanyCredit,
            personalCredit: newPersonalCredit
          }
        });

        // Create credit transaction record (CREDIT INCREASE)
        await tx.creditTransaction.create({
          data: {
            userId: userId,
            transactionType: actualCreditType === CreditType.PERSONAL 
              ? CreditTransactionType.PERSONAL_COLLECTION 
              : CreditTransactionType.CREDIT_INCREASE,
            amount: paidAmount,
            paymentMode: actualPaymentMode as PaymentModeType,
            creditType: actualCreditType,
            companyBalanceAfter: newCompanyCredit,
            personalBalanceAfter: newPersonalCredit,
            balanceAfter: newTotalCredit,
            sourceType: 'EMI_PAYMENT',
            sourceId: emiId,
            loanApplicationId: loanId,
            emiScheduleId: emiId,
            customerId: emi.loanApplication?.customerId,
            installmentNumber: emi.installmentNumber,
            customerName: emi.loanApplication?.customer?.name,
            customerPhone: emi.loanApplication?.customer?.phone,
            loanApplicationNo: emi.loanApplication?.applicationNo,
            emiDueDate: emi.dueDate,
            emiAmount: emi.totalAmount,
            principalComponent: emi.principalAmount,
            interestComponent: emi.interestAmount,
            description: `EMI Payment Collected - ${emi.loanApplication?.applicationNo || loanId} - EMI #${emi.installmentNumber}`,
            proofDocument: proofUrl,
            proofType: proofUrl ? 'document' : null,
            proofUploadedAt: proofUrl ? new Date() : null,
            proofVerified: actualCreditType === CreditType.COMPANY, // Auto-verify company credit
            transactionDate: new Date()
          }
        });

        // Update daily collection
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existingCollection = await tx.dailyCollection.findFirst({
          where: { date: today }
        });

        const modeField = actualPaymentMode === 'CASH' ? 'totalCash' :
                          actualPaymentMode === 'CHEQUE' ? 'totalCheque' : 'totalOnline';

        const roleField = user.role === 'SUPER_ADMIN' ? 'superAdminCollection' :
                          user.role === 'COMPANY' ? 'companyCollection' :
                          user.role === 'AGENT' ? 'agentCollection' :
                          user.role === 'STAFF' ? 'staffCollection' :
                          user.role === 'CASHIER' ? 'cashierCollection' : 'customerDirect';

        if (existingCollection) {
          await tx.dailyCollection.update({
            where: { id: existingCollection.id },
            data: {
              [modeField]: { increment: paidAmount },
              totalAmount: { increment: paidAmount },
              totalTransactions: { increment: 1 },
              emiPaymentsCount: { increment: 1 },
              [roleField]: { increment: paidAmount }
            }
          });
        } else {
          await tx.dailyCollection.create({
            data: {
              date: today,
              [modeField]: paidAmount,
              totalAmount: paidAmount,
              totalTransactions: 1,
              emiPaymentsCount: 1,
              [roleField]: paidAmount
            }
          });
        }

        return updatedEmi;
      });

      // Get updated credit balance
      const updatedUser = await db.user.findUnique({
        where: { id: userId },
        select: { personalCredit: true, companyCredit: true, credit: true }
      });

      return NextResponse.json({ 
        success: true, 
        emi: result,
        message: `EMI paid successfully. Your ${actualCreditType.toLowerCase()} credit increased by ₹${paidAmount}`,
        creditBreakdown: {
          companyCredit: updatedUser?.companyCredit || 0,
          personalCredit: updatedUser?.personalCredit || 0,
          totalCredit: updatedUser?.credit || 0
        }
      });
    }

    if (!emiId) {
      return NextResponse.json({ error: 'EMI ID is required' }, { status: 400 });
    }

    // Waive penalty
    if (action === 'waive-penalty') {
      const emi = await db.eMISchedule.update({
        where: { id: emiId },
        data: {
          penaltyAmount: 0,
          waiverReason: data.reason,
          waivedById: data.waivedBy,
          waivedAt: new Date()
        }
      });
      return NextResponse.json({ success: true, emi });
    }

    // Change due date
    if (action === 'change-due-date') {
      const emi = await db.eMISchedule.update({
        where: { id: emiId },
        data: {
          dueDate: new Date(data.newDueDate)
        }
      });
      return NextResponse.json({ success: true, emi });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('EMI update error:', error);
    return NextResponse.json({ error: 'Failed to update EMI' }, { status: 500 });
  }
}
