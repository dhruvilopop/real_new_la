import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentType, PaymentRequestStatus } from '@prisma/client';

// GET - List payment requests (for cashier/admin)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const loanId = searchParams.get('loanId');

    // Get payment request settings
    if (action === 'settings') {
      const loanApplicationId = searchParams.get('loanApplicationId');
      const companyId = searchParams.get('companyId');
      
      // First check loan-specific settings
      if (loanApplicationId) {
        const loanSettings = await db.paymentOptionSettings.findFirst({
          where: { loanApplicationId, scope: 'LOAN' }
        });
        if (loanSettings) {
          return NextResponse.json({ success: true, settings: loanSettings });
        }
      }
      
      // Then check company-specific settings
      if (companyId) {
        const companySettings = await db.companyPaymentSettings.findUnique({
          where: { companyId }
        });
        if (companySettings) {
          return NextResponse.json({ success: true, settings: companySettings });
        }
      }
      
      // Return global default settings
      const globalSettings = await db.paymentOptionSettings.findFirst({
        where: { scope: 'GLOBAL' }
      });
      
      if (!globalSettings) {
        // Create default settings
        const defaultSettings = await db.paymentOptionSettings.create({
          data: {
            scope: 'GLOBAL',
            enableFullPayment: true,
            enablePartialPayment: true,
            enableInterestOnly: true,
            maxPartialPayments: 2,
            maxInterestOnlyPerLoan: 3,
            acceptedPaymentMethods: 'UPI,BANK_TRANSFER,CASH',
            createdById: userId || 'system'
          }
        });
        return NextResponse.json({ success: true, settings: defaultSettings });
      }
      
      return NextResponse.json({ success: true, settings: globalSettings });
    }

    // Get EMI details for payment
    if (action === 'emi-details') {
      const emiScheduleId = searchParams.get('emiScheduleId');
      
      if (!emiScheduleId) {
        return NextResponse.json({ error: 'EMI Schedule ID required' }, { status: 400 });
      }
      
      const emi = await db.eMISchedule.findUnique({
        where: { id: emiScheduleId },
        include: {
          loanApplication: {
            include: {
              sessionForm: true,
              company: true
            }
          }
        }
      });
      
      if (!emi) {
        return NextResponse.json({ error: 'EMI not found' }, { status: 404 });
      }
      
      // Get payment settings for this loan
      const settings = await db.paymentOptionSettings.findFirst({
        where: {
          OR: [
            { loanApplicationId: emi.loanApplicationId, scope: 'LOAN' },
            { companyId: emi.loanApplication.companyId || undefined, scope: 'COMPANY' },
            { scope: 'GLOBAL' }
          ]
        },
        orderBy: { scope: 'desc' }  // LOAN > COMPANY > GLOBAL
      });
      
      return NextResponse.json({ 
        success: true, 
        emi,
        settings: settings || {
          enableFullPayment: true,
          enablePartialPayment: true,
          enableInterestOnly: true,
          maxPartialPayments: 2,
          maxInterestOnlyPerLoan: 3
        }
      });
    }

    // List payment requests
    let whereClause: any = {};
    
    if (role === 'CUSTOMER' && userId) {
      whereClause.customerId = userId;
    }
    
    if (status) {
      whereClause.status = status as PaymentRequestStatus;
    }
    
    if (loanId) {
      whereClause.loanApplicationId = loanId;
    }

    const paymentRequests = await db.paymentRequest.findMany({
      where: whereClause,
      include: {
        loanApplication: {
          include: {
            customer: { select: { id: true, name: true, email: true, phone: true } },
            sessionForm: true
          }
        },
        emiSchedule: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        reviewer: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, paymentRequests });
  } catch (error) {
    console.error('Error in payment request GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new payment request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      loanApplicationId,
      emiScheduleId,
      customerId,
      paymentType,
      requestedAmount,
      partialAmount,
      remainingAmount,
      newDueDate,
      paymentMethod,
      utrNumber,
      proofUrl,
      proofFileName
    } = body;

    // Validate required fields
    if (!loanApplicationId || !customerId || !paymentType || !requestedAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get EMI details
    const emi = await db.eMISchedule.findUnique({
      where: { id: emiScheduleId },
      include: {
        loanApplication: {
          include: { company: true, sessionForm: true }
        }
      }
    });

    if (!emi) {
      return NextResponse.json({ error: 'EMI not found' }, { status: 404 });
    }

    // Get payment settings
    const settings = await db.paymentOptionSettings.findFirst({
      where: {
        OR: [
          { loanApplicationId, scope: 'LOAN' },
          { companyId: emi.loanApplication.companyId || undefined, scope: 'COMPANY' },
          { scope: 'GLOBAL' }
        ]
      },
      orderBy: { scope: 'desc' }
    });

    // Validate payment options
    if (paymentType === 'PARTIAL_PAYMENT' && settings && !settings.enablePartialPayment) {
      return NextResponse.json({ error: 'Partial payment is not enabled for this loan' }, { status: 400 });
    }
    
    if (paymentType === 'INTEREST_ONLY' && settings && !settings.enableInterestOnly) {
      return NextResponse.json({ error: 'Interest-only payment is not enabled for this loan' }, { status: 400 });
    }

    // Validate partial payment
    if (paymentType === 'PARTIAL_PAYMENT') {
      const maxPartial = settings?.maxPartialPayments || 2;
      
      if (emi.partialPaymentCount >= maxPartial) {
        return NextResponse.json({ 
          error: `Maximum ${maxPartial} partial payments allowed for this EMI` 
        }, { status: 400 });
      }

      // Validate date - must be after original due date and before next EMI due date
      if (newDueDate) {
        const newDate = new Date(newDueDate);
        const dueDate = new Date(emi.dueDate);
        
        if (newDate <= dueDate) {
          return NextResponse.json({ 
            error: 'New due date must be after the original due date' 
          }, { status: 400 });
        }

        // Check if new date is before the next EMI's due date
        const nextEMI = await db.eMISchedule.findFirst({
          where: { 
            loanApplicationId,
            installmentNumber: emi.installmentNumber + 1
          }
        });

        if (nextEMI) {
          const nextDueDate = new Date(nextEMI.dueDate);
          if (newDate >= nextDueDate) {
            return NextResponse.json({ 
              error: 'New due date must be before the next EMI due date (' + nextDueDate.toLocaleDateString() + ')' 
            }, { status: 400 });
          }
        }
      }

      // Validate partial amount
      if (partialAmount && partialAmount >= requestedAmount) {
        return NextResponse.json({ 
          error: 'Partial amount must be less than total EMI amount' 
        }, { status: 400 });
      }
    }

    // Validate interest only payment
    if (paymentType === 'INTEREST_ONLY') {
      const maxInterestOnly = settings?.maxInterestOnlyPerLoan || 3;
      
      // Count how many interest-only payments already made for this loan
      const existingInterestOnly = await db.paymentRequest.count({
        where: {
          loanApplicationId,
          paymentType: 'INTEREST_ONLY',
          status: 'APPROVED'
        }
      });

      if (existingInterestOnly >= maxInterestOnly) {
        return NextResponse.json({ 
          error: `Maximum ${maxInterestOnly} interest-only payments allowed for this loan` 
        }, { status: 400 });
      }
    }

    // Generate request number
    const requestNumber = `PR${Date.now().toString(36).toUpperCase()}`;

    // Get company payment settings for UPI/Bank details
    const companySettings = emi.loanApplication.companyId 
      ? await db.companyPaymentSettings.findUnique({
          where: { companyId: emi.loanApplication.companyId }
        })
      : null;

    // Create payment request
    const paymentRequest = await db.paymentRequest.create({
      data: {
        requestNumber,
        loanApplicationId,
        emiScheduleId,
        customerId,
        paymentType: paymentType as PaymentType,
        requestedAmount,
        partialAmount: partialAmount || null,
        remainingAmount: remainingAmount || null,
        newDueDate: newDueDate ? new Date(newDueDate) : null,
        partialPaymentNumber: paymentType === 'PARTIAL_PAYMENT' ? emi.partialPaymentCount + 1 : null,
        interestAmount: paymentType === 'INTEREST_ONLY' ? emi.interestAmount : null,
        principalDeferred: paymentType === 'INTEREST_ONLY',
        paymentMethod,
        utrNumber,
        proofUrl,
        proofFileName,
        upiId: companySettings?.companyUpiId,
        qrCodeUrl: companySettings?.companyQrCodeUrl,
        bankAccountDetails: companySettings?.collectionBankAccountId ? 
          JSON.stringify({ bankAccountId: companySettings.collectionBankAccountId }) : null,
        status: 'PENDING'
      },
      include: {
        loanApplication: {
          include: {
            customer: { select: { id: true, name: true, email: true, phone: true } }
          }
        },
        emiSchedule: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Payment request submitted successfully. Awaiting approval.',
      paymentRequest 
    });
  } catch (error) {
    console.error('Error creating payment request:', error);
    return NextResponse.json({ error: 'Failed to create payment request' }, { status: 500 });
  }
}

// PUT - Approve or reject payment request
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, paymentRequestId, reviewedById, reviewRemarks, rejectionReason } = body;

    if (!paymentRequestId || !action || !reviewedById) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const paymentRequest = await db.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      include: {
        emiSchedule: true,
        loanApplication: {
          include: { sessionForm: true }
        }
      }
    });

    if (!paymentRequest) {
      return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
    }

    if (paymentRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Payment request already processed' }, { status: 400 });
    }

    if (action === 'approve') {
      const emi = paymentRequest.emiSchedule;
      const loan = paymentRequest.loanApplication;

      // Ensure EMI exists
      if (!emi) {
        return NextResponse.json({ error: 'EMI schedule not found for this payment request' }, { status: 400 });
      }

      // Pre-fetch data needed for INTEREST_ONLY payment BEFORE transaction
      let lastEMI: any = null;
      let nextEMI: any = null;
      
      if (paymentRequest.paymentType === 'INTEREST_ONLY') {
        // Fetch last EMI for installment number
        lastEMI = await db.eMISchedule.findFirst({
          where: { loanApplicationId: paymentRequest.loanApplicationId },
          orderBy: { installmentNumber: 'desc' }
        });
        
        // Fetch next EMI for due date calculation
        nextEMI = await db.eMISchedule.findFirst({
          where: { 
            loanApplicationId: paymentRequest.loanApplicationId,
            installmentNumber: emi.installmentNumber + 1
          }
        });
      }

      // Start transaction for approval process with extended timeout
      const result = await db.$transaction(async (tx) => {
        // Update payment request status
        const updated = await tx.paymentRequest.update({
          where: { id: paymentRequestId },
          data: {
            status: 'APPROVED',
            reviewedById,
            reviewedAt: new Date(),
            reviewRemarks,
            paymentConfirmedAt: new Date()
          }
        });

        // Handle different payment types
        if (paymentRequest.paymentType === 'FULL_EMI') {
          // Mark EMI as fully paid
          await tx.eMISchedule.update({
            where: { id: emi.id },
            data: {
              paidAmount: paymentRequest.requestedAmount,
              paidPrincipal: emi.principalAmount,
              paidInterest: emi.interestAmount,
              paymentStatus: 'PAID',
              paidDate: new Date(),
              paymentMode: paymentRequest.paymentMethod,
              utrNumber: paymentRequest.utrNumber,
              proofUrl: paymentRequest.proofUrl
            }
          });

          // Create payment record
          await tx.payment.create({
            data: {
              loanApplicationId: paymentRequest.loanApplicationId,
              emiScheduleId: emi.id,
              customerId: paymentRequest.customerId,
              paymentType: 'FULL_EMI',
              amount: paymentRequest.requestedAmount,
              principalComponent: emi.principalAmount,
              interestComponent: emi.interestAmount,
              utrNumber: paymentRequest.utrNumber,
              paymentMode: paymentRequest.paymentMethod,
              status: 'COMPLETED',
              verified: true,
              verifiedById: reviewedById,
              verifiedAt: new Date(),
              proofUrl: paymentRequest.proofUrl
            }
          });
        } 
        else if (paymentRequest.paymentType === 'PARTIAL_PAYMENT') {
          const partialAmount = paymentRequest.partialAmount || 0;
          const remainingAmount = paymentRequest.remainingAmount || (emi.totalAmount - partialAmount);
          const partialCount = emi.partialPaymentCount + 1;
          const maxPartialPayments = 2;

          // Calculate principal and interest for partial payment
          const totalPrincipal = emi.principalAmount;
          const totalInterest = emi.interestAmount;
          const principalRatio = totalPrincipal / emi.totalAmount;
          const interestRatio = totalInterest / emi.totalAmount;
          
          const paidPrincipal = partialAmount * principalRatio;
          const paidInterest = partialAmount * interestRatio;

          // Update EMI with partial payment info
          await tx.eMISchedule.update({
            where: { id: emi.id },
            data: {
              paidAmount: emi.paidAmount + partialAmount,
              paidPrincipal: emi.paidPrincipal + paidPrincipal,
              paidInterest: emi.paidInterest + paidInterest,
              remainingAmount,
              partialPaymentCount: partialCount,
              newDueDate: paymentRequest.newDueDate,
              paymentStatus: 'PARTIALLY_PAID',
              isPartialPayment: true,
              nextPaymentDate: paymentRequest.newDueDate
            }
          });

          // Create payment record
          await tx.payment.create({
            data: {
              loanApplicationId: paymentRequest.loanApplicationId,
              emiScheduleId: emi.id,
              customerId: paymentRequest.customerId,
              paymentType: 'PARTIAL_PAYMENT',
              amount: partialAmount,
              principalComponent: paidPrincipal,
              interestComponent: paidInterest,
              utrNumber: paymentRequest.utrNumber,
              paymentMode: paymentRequest.paymentMethod,
              status: 'COMPLETED',
              verified: true,
              verifiedById: reviewedById,
              verifiedAt: new Date(),
              proofUrl: paymentRequest.proofUrl,
              remarks: `Partial payment ${partialCount}/2`
            }
          });

          // If this is the last partial payment, notify customer
          if (partialCount === maxPartialPayments && remainingAmount > 0) {
            await tx.notification.create({
              data: {
                userId: paymentRequest.customerId,
                type: 'PAYMENT_WARNING',
                title: 'Last Partial Payment Done',
                message: `You have used both partial payments. Remaining amount: ₹${remainingAmount.toFixed(2)} must be paid in full.`
              }
            });
          }
        }
        else if (paymentRequest.paymentType === 'INTEREST_ONLY') {
          const interestAmount = emi.interestAmount;
          
          // Update EMI - mark interest paid but keep principal pending
          await tx.eMISchedule.update({
            where: { id: emi.id },
            data: {
              paidAmount: emi.paidAmount + interestAmount,
              paidInterest: emi.paidInterest + interestAmount,
              interestOnlyPaidAt: new Date(),
              interestOnlyAmount: interestAmount,
              paymentStatus: 'INTEREST_ONLY_PAID',
              isInterestOnly: true,
              principalDeferred: true
            }
          });

          // Create payment record for interest only
          await tx.payment.create({
            data: {
              loanApplicationId: paymentRequest.loanApplicationId,
              emiScheduleId: emi.id,
              customerId: paymentRequest.customerId,
              paymentType: 'INTEREST_ONLY',
              amount: interestAmount,
              principalComponent: 0,
              interestComponent: interestAmount,
              utrNumber: paymentRequest.utrNumber,
              paymentMode: paymentRequest.paymentMethod,
              status: 'COMPLETED',
              verified: true,
              verifiedById: reviewedById,
              verifiedAt: new Date(),
              proofUrl: paymentRequest.proofUrl,
              remarks: 'Interest only payment - Principal deferred to new EMI'
            }
          });

          // Use pre-fetched last EMI for installment number
          const newInstallmentNumber = (lastEMI?.installmentNumber || 0) + 1;
          
          // Create a new EMI for the deferred principal with NEW interest
          const newPrincipal = emi.principalAmount;
          const interestRate = loan.sessionForm?.interestRate || 12;
          const monthlyRate = Number(interestRate) / 100 / 12;
          const newInterest = newPrincipal * monthlyRate;
          const newTotalAmount = newPrincipal + newInterest;

          // New EMI due date: 15 days after current EMI or before next EMI (using pre-fetched nextEMI)
          let newDueDate: Date;
          if (nextEMI) {
            const nextDueDate = new Date(nextEMI.dueDate);
            const currentDueDate = new Date(emi.dueDate);
            const midDate = new Date(currentDueDate.getTime() + (nextDueDate.getTime() - currentDueDate.getTime()) / 2);
            newDueDate = midDate;
          } else {
            newDueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
          }

          // Create duplicate EMI with principal + NEW interest
          await tx.eMISchedule.create({
            data: {
              loanApplicationId: paymentRequest.loanApplicationId,
              installmentNumber: newInstallmentNumber,
              dueDate: newDueDate,
              originalDueDate: newDueDate,
              principalAmount: newPrincipal,
              interestAmount: newInterest,
              totalAmount: newTotalAmount,
              outstandingPrincipal: newPrincipal,
              outstandingInterest: newInterest,
              duplicatedEMINumber: emi.installmentNumber,
              originalEMIId: emi.id,
              notes: `Created due to interest-only payment on EMI #${emi.installmentNumber}. Principal + new interest.`
            }
          });

          // Update the loan tenure
          if (loan.sessionForm) {
            await tx.sessionForm.update({
              where: { loanApplicationId: paymentRequest.loanApplicationId },
              data: {
                tenure: (loan.sessionForm.tenure || 0) + 1,
                totalInterest: (loan.sessionForm.totalInterest || 0) + newInterest,
                totalAmount: (loan.sessionForm.totalAmount || 0) + newInterest
              }
            });
          }

          // Notify customer
          await tx.notification.create({
            data: {
              userId: paymentRequest.customerId,
              type: 'PAYMENT_CONFIRMATION',
              title: 'Interest-Only Payment Confirmed',
              message: `Your interest-only payment of ₹${interestAmount.toFixed(2)} is confirmed. A new EMI for ₹${newTotalAmount.toFixed(2)} (principal + new interest) has been added.`
            }
          });
        }

        return updated;
      }, { timeout: 30000 }); // 30 second timeout for complex payment processing

      return NextResponse.json({ 
        success: true, 
        message: 'Payment request approved successfully',
        paymentRequest: result 
      });
    } 
    else if (action === 'reject') {
      const updated = await db.paymentRequest.update({
        where: { id: paymentRequestId },
        data: {
          status: 'REJECTED',
          reviewedById,
          reviewedAt: new Date(),
          reviewRemarks,
          rejectionReason
        }
      });

      // Notify customer about rejection
      await db.notification.create({
        data: {
          userId: paymentRequest.customerId,
          type: 'PAYMENT_REJECTED',
          title: 'Payment Request Rejected',
          message: `Your payment request ${paymentRequest.requestNumber} has been rejected. Reason: ${rejectionReason || 'Not specified'}`
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Payment request rejected',
        paymentRequest: updated 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing payment request:', error);
    return NextResponse.json({ error: 'Failed to process payment request' }, { status: 500 });
  }
}
