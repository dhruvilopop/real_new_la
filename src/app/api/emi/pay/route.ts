import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const emiId = formData.get('emiId') as string;
    const loanId = formData.get('loanId') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const paymentMode = formData.get('paymentMode') as string;
    const remarks = formData.get('remarks') as string;
    const paidBy = formData.get('paidBy') as string;
    const creditType = formData.get('creditType') as 'PERSONAL' | 'COMPANY';
    const companyId = formData.get('companyId') as string;
    const proofFile = formData.get('proof') as File | null;
    
    // Payment type - FULL_EMI, PARTIAL_PAYMENT, INTEREST_ONLY
    const paymentType = (formData.get('paymentType') as string) || 'FULL_EMI';
    
    // For partial payment
    const partialAmount = formData.get('partialAmount') ? parseFloat(formData.get('partialAmount') as string) : null;
    const nextPaymentDate = formData.get('nextPaymentDate') as string | null;

    if (!emiId || !loanId || !paidBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get EMI details
    const emi = await db.eMISchedule.findUnique({
      where: { id: emiId },
      include: {
        loanApplication: {
          include: {
            company: true,
            sessionForm: {
              include: {
                agent: {
                  select: { id: true, name: true, email: true }
                }
              }
            },
            emiSchedules: {
              where: { paymentStatus: 'PENDING' },
              orderBy: { installmentNumber: 'asc' }
            }
          }
        }
      }
    });

    if (!emi) {
      return NextResponse.json({ error: 'EMI not found' }, { status: 404 });
    }

    // Sequential Payment Validation - Check if previous EMIs are paid
    const previousEmis = await db.eMISchedule.findMany({
      where: {
        loanApplicationId: loanId,
        installmentNumber: { lt: emi.installmentNumber },
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

    // Check if partial payment is allowed for this EMI
    if (paymentType === 'PARTIAL_PAYMENT' && emi.allowPartialPayment === false) {
      return NextResponse.json({ 
        error: 'Partial payment not allowed',
        message: 'Partial payment is disabled for this EMI. Please pay full amount.'
      }, { status: 400 });
    }

    // Check if interest only payment is allowed for this EMI
    if (paymentType === 'INTEREST_ONLY' && emi.allowInterestOnly === false) {
      return NextResponse.json({ 
        error: 'Interest only payment not allowed',
        message: 'Interest only payment is disabled for this EMI. Please pay full amount.'
      }, { status: 400 });
    }

    // Check if EMI already has partial payment - disable interest only option
    if (paymentType === 'INTEREST_ONLY' && emi.isPartialPayment) {
      return NextResponse.json({ 
        error: 'Interest only not available after partial payment',
        message: 'This EMI has a partial payment. Interest only option is not available.'
      }, { status: 400 });
    }

    // Handle proof upload
    let proofUrl = '';
    if (proofFile && proofFile.size > 0) {
      const bytes = await proofFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'proofs');
      await mkdir(uploadsDir, { recursive: true });
      
      const fileName = `proof-${emiId}-${Date.now()}.${proofFile.name.split('.').pop()}`;
      const filePath = path.join(uploadsDir, fileName);
      
      await writeFile(filePath, buffer);
      proofUrl = `/uploads/proofs/${fileName}`;
    }

    // Calculate payment amounts based on payment type
    let paidAmount = amount;
    let paidPrincipal = 0;
    let paidInterest = 0;
    let newEmiStatus = 'PAID' as 'PAID' | 'PARTIALLY_PAID' | 'INTEREST_ONLY_PAID';
    let isPartialPayment = false;
    let isInterestOnly = false;
    let principalDeferred = false;
    let nextPaymentDateValue: Date | null = null;

    const remainingAmount = emi.totalAmount - (emi.paidAmount || 0);
    const remainingPrincipal = emi.principalAmount - (emi.paidPrincipal || 0);
    const remainingInterest = emi.interestAmount - (emi.paidInterest || 0);

    if (paymentType === 'FULL_EMI') {
      // Full EMI payment
      paidPrincipal = remainingPrincipal;
      paidInterest = remainingInterest;
      paidAmount = remainingAmount;
      newEmiStatus = 'PAID';
    } else if (paymentType === 'PARTIAL_PAYMENT') {
      // Partial payment
      if (!partialAmount || partialAmount <= 0) {
        return NextResponse.json({ error: 'Invalid partial amount' }, { status: 400 });
      }
      if (!nextPaymentDate) {
        return NextResponse.json({ error: 'Next payment date is required for partial payments' }, { status: 400 });
      }
      if (partialAmount > remainingAmount) {
        return NextResponse.json({ error: 'Partial amount cannot exceed remaining amount' }, { status: 400 });
      }

      isPartialPayment = true;
      paidAmount = partialAmount;
      nextPaymentDateValue = new Date(nextPaymentDate);
      
      // Calculate principal and interest proportionally
      const ratio = partialAmount / remainingAmount;
      paidPrincipal = remainingPrincipal * ratio;
      paidInterest = remainingInterest * ratio;
      
      // If partial payment covers the full amount, mark as paid
      if (partialAmount >= remainingAmount - 1) { // Allow for rounding
        newEmiStatus = 'PAID';
        isPartialPayment = false;
      } else {
        newEmiStatus = 'PARTIALLY_PAID';
      }
    } else if (paymentType === 'INTEREST_ONLY') {
      // Interest only payment
      isInterestOnly = true;
      principalDeferred = true;
      paidInterest = remainingInterest;
      paidPrincipal = 0;
      paidAmount = remainingInterest;
      newEmiStatus = 'INTEREST_ONLY_PAID';
    }

    // Update EMI status
    const updatedEMI = await db.eMISchedule.update({
      where: { id: emiId },
      data: {
        paymentStatus: newEmiStatus,
        paidAmount: (emi.paidAmount || 0) + paidAmount,
        paidPrincipal: (emi.paidPrincipal || 0) + paidPrincipal,
        paidInterest: (emi.paidInterest || 0) + paidInterest,
        paidDate: new Date(),
        paymentMode: paymentMode,
        proofUrl: proofUrl,
        notes: remarks,
        isPartialPayment,
        nextPaymentDate: nextPaymentDateValue,
        isInterestOnly,
        principalDeferred
      }
    });

    // Create payment record
    const payment = await db.payment.create({
      data: {
        loanApplicationId: loanId,
        emiScheduleId: emiId,
        customerId: emi.loanApplication?.customerId || '',
        amount: paidAmount,
        principalComponent: paidPrincipal,
        interestComponent: paidInterest,
        paymentMode: paymentMode,
        status: 'COMPLETED',
        receiptNumber: `RCP-${Date.now()}`,
        paidById: paidBy,
        remarks: remarks,
        proofUrl: proofUrl,
        paymentType: paymentType as 'FULL_EMI' | 'PARTIAL_PAYMENT' | 'INTEREST_ONLY'
      }
    });

    // Create Bank Transaction - MONEY IN (EMI Collection)
    // This increases the bank balance when EMI is collected
    if (paymentMode === 'BANK_TRANSFER' || paymentMode === 'ONLINE' || paymentMode === 'UPI') {
      // Get or create a default bank account for EMI collections
      let bankAccount = await db.bankAccount.findFirst({
        where: { isDefault: true, isActive: true }
      });

      if (!bankAccount) {
        // Create a default bank account if none exists
        bankAccount = await db.bankAccount.create({
          data: {
            bankName: 'SMFC Finance Bank',
            accountNumber: 'SMFC-DEFAULT-001',
            accountName: 'SMFC Finance - EMI Collections',
            accountType: 'CURRENT',
            openingBalance: 0,
            currentBalance: 0,
            isDefault: true,
            isActive: true
          }
        });
      }

      // Update bank balance - EMI collection increases balance
      await db.bankAccount.update({
        where: { id: bankAccount.id },
        data: {
          currentBalance: { increment: paidAmount }
        }
      });

      // Create bank transaction log
      await db.bankTransaction.create({
        data: {
          bankAccountId: bankAccount.id,
          transactionType: 'CREDIT',
          amount: paidAmount,
          balanceAfter: bankAccount.currentBalance + paidAmount,
          description: `EMI Collection - ${emi.loanApplication?.applicationNo || loanId} - EMI #${emi.installmentNumber}`,
          referenceType: 'EMI_PAYMENT',
          referenceId: payment.id,
          createdById: paidBy
        }
      });
    }

    // Handle rescheduling for partial payment
    if (paymentType === 'PARTIAL_PAYMENT' && isPartialPayment && nextPaymentDateValue && partialAmount) {
      // Calculate remaining amount after partial payment
      const remainingAfterPartial = remainingAmount - partialAmount;
      
      // Create or update a deferred payment record for the remaining amount
      // Shift subsequent EMI due dates
      const subsequentEmis = await db.eMISchedule.findMany({
        where: {
          loanApplicationId: loanId,
          installmentNumber: { gt: emi.installmentNumber },
          paymentStatus: 'PENDING'
        },
        orderBy: { installmentNumber: 'asc' }
      });

      if (subsequentEmis.length > 0) {
        // Calculate date difference to shift
        const currentDueDate = new Date(emi.dueDate);
        const nextDueDate = nextPaymentDateValue;
        const daysDiff = Math.ceil((nextDueDate.getTime() - currentDueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Shift all subsequent EMI due dates
        for (const subsequentEmi of subsequentEmis) {
          const newDueDate = new Date(subsequentEmi.dueDate);
          newDueDate.setDate(newDueDate.getDate() + daysDiff);
          
          await db.eMISchedule.update({
            where: { id: subsequentEmi.id },
            data: {
              dueDate: newDueDate,
              originalDueDate: subsequentEmi.originalDueDate || subsequentEmi.dueDate
            }
          });
        }
      }

      // Create a note about the remaining balance
      await db.payment.update({
        where: { id: payment.id },
        data: {
          remarks: `${remarks || ''} | Remaining: ₹${remainingAfterPartial.toFixed(2)} due by ${nextPaymentDateValue.toLocaleDateString()}`
        }
      });
    }

    // Handle interest only payment - shift principal to next EMI
    if (paymentType === 'INTEREST_ONLY' && principalDeferred) {
      const subsequentEmis = await db.eMISchedule.findMany({
        where: {
          loanApplicationId: loanId,
          paymentStatus: 'PENDING'
        },
        orderBy: { installmentNumber: 'asc' }
      });

      if (subsequentEmis.length > 0) {
        // Add the deferred principal to the next EMI
        const nextEmi = subsequentEmis[0];
        const loanInterestRate = emi.loanApplication?.interestRate || 12;
        const monthlyRate = loanInterestRate / 100 / 12;
        
        // Calculate new principal for next EMI (current principal + deferred principal)
        const newPrincipal = nextEmi.principalAmount + remainingPrincipal;
        
        // Recalculate interest based on new principal
        const newInterest = (emi.outstandingPrincipal - paidPrincipal) * monthlyRate;
        
        // Update next EMI with combined principal
        await db.eMISchedule.update({
          where: { id: nextEmi.id },
          data: {
            principalAmount: newPrincipal,
            interestAmount: newInterest,
            totalAmount: newPrincipal + newInterest,
            notes: `Includes deferred principal ₹${remainingPrincipal.toFixed(2)} from EMI #${emi.installmentNumber}`
          }
        });

        // Recalculate subsequent EMIs if there are more
        if (subsequentEmis.length > 1) {
          let outstandingPrincipal = emi.outstandingPrincipal - paidPrincipal;
          
          for (let i = 1; i < subsequentEmis.length; i++) {
            const currentEmi = subsequentEmis[i];
            
            // Recalculate based on remaining tenure
            const remainingTenure = subsequentEmis.length - i;
            const emiAmount = outstandingPrincipal * monthlyRate * Math.pow(1 + monthlyRate, remainingTenure) 
                            / (Math.pow(1 + monthlyRate, remainingTenure) - 1);
            
            const interest = outstandingPrincipal * monthlyRate;
            const principal = emiAmount - interest;
            
            await db.eMISchedule.update({
              where: { id: currentEmi.id },
              data: {
                principalAmount: principal,
                interestAmount: interest,
                totalAmount: emiAmount,
                outstandingPrincipal: outstandingPrincipal
              }
            });
            
            outstandingPrincipal -= principal;
          }
        }
      }
    }

    // Update credit instantly based on credit type
    if (creditType === 'PERSONAL') {
      // Get user's current credit balance
      const user = await db.user.findUnique({
        where: { id: paidBy },
        select: { personalCredit: true, companyCredit: true, credit: true }
      });
      
      const newPersonalCredit = (user?.personalCredit || 0) + paidAmount;
      const newTotalCredit = (user?.credit || 0) + paidAmount;
      
      await db.creditTransaction.create({
        data: {
          userId: paidBy,
          transactionType: 'PERSONAL_COLLECTION',
          amount: paidAmount,
          paymentMode: (paymentMode || 'CASH') as 'CASH' | 'CHEQUE' | 'ONLINE' | 'UPI' | 'BANK_TRANSFER' | 'SYSTEM',
          creditType: 'PERSONAL',
          sourceType: 'EMI_PAYMENT',
          balanceAfter: newTotalCredit,
          personalBalanceAfter: newPersonalCredit,
          companyBalanceAfter: user?.companyCredit || 0,
          loanApplicationId: loanId,
          emiScheduleId: emiId,
          installmentNumber: emi.installmentNumber,
          customerName: emi.loanApplication?.firstName + ' ' + emi.loanApplication?.lastName,
          loanApplicationNo: emi.loanApplication?.applicationNo,
          emiDueDate: emi.dueDate,
          emiAmount: emi.totalAmount,
          description: `EMI Payment - ${emi.loanApplication?.applicationNo || loanId}`,
          transactionDate: new Date()
        }
      });
      
      // Update user's credit
      await db.user.update({
        where: { id: paidBy },
        data: {
          personalCredit: newPersonalCredit,
          credit: newTotalCredit
        }
      });
    } else if (creditType === 'COMPANY' && companyId) {
      // Get company's current credit balance
      const company = await db.company.findUnique({
        where: { id: companyId },
        select: { companyCredit: true }
      });
      
      const newCompanyCredit = (company?.companyCredit || 0) + paidAmount;
      
      await db.creditTransaction.create({
        data: {
          userId: paidBy,
          transactionType: 'CREDIT_INCREASE',
          amount: paidAmount,
          paymentMode: (paymentMode || 'CASH') as 'CASH' | 'CHEQUE' | 'ONLINE' | 'UPI' | 'BANK_TRANSFER' | 'SYSTEM',
          creditType: 'COMPANY',
          sourceType: 'EMI_PAYMENT',
          balanceAfter: newCompanyCredit,
          personalBalanceAfter: 0,
          companyBalanceAfter: newCompanyCredit,
          loanApplicationId: loanId,
          emiScheduleId: emiId,
          installmentNumber: emi.installmentNumber,
          customerName: emi.loanApplication?.firstName + ' ' + emi.loanApplication?.lastName,
          loanApplicationNo: emi.loanApplication?.applicationNo,
          emiDueDate: emi.dueDate,
          emiAmount: emi.totalAmount,
          description: `EMI Payment - ${emi.loanApplication?.applicationNo || loanId}`,
          transactionDate: new Date()
        }
      });
      
      // Update company's credit
      await db.company.update({
        where: { id: companyId },
        data: {
          companyCredit: newCompanyCredit
        }
      });
    }

    // Check if all EMIs are paid
    const allEMIs = await db.eMISchedule.findMany({ where: { loanApplicationId: loanId } });
    const allPaid = allEMIs.every(e => e.paymentStatus === 'PAID');
    
    if (allPaid) {
      await db.loanApplication.update({
        where: { id: loanId },
        data: { status: 'CLOSED' }
      });
    }

    // Log action
    await db.actionLog.create({
      data: {
        userId: paidBy,
        userRole: 'CASHIER', // Default role, can be passed from frontend if needed
        actionType: paymentType === 'FULL_EMI' ? 'PAYMENT' : 
                    paymentType === 'PARTIAL_PAYMENT' ? 'PAYMENT' : 'PAYMENT',
        module: 'EMI_PAYMENT',
        recordId: payment.id,
        recordType: 'Payment',
        previousData: JSON.stringify({
          emiStatus: emi.paymentStatus,
          paidAmount: emi.paidAmount
        }),
        newData: JSON.stringify({ 
          emiId, 
          loanId, 
          paymentId: payment.id,
          amount: paidAmount, 
          paymentMode, 
          paymentType,
          creditType, 
          companyId: creditType === 'COMPANY' ? companyId : null,
          partialAmount: paymentType === 'PARTIAL_PAYMENT' ? partialAmount : null,
          nextPaymentDate: paymentType === 'PARTIAL_PAYMENT' ? nextPaymentDate : null
        }),
        description: `${paymentType === 'FULL_EMI' ? 'Full EMI' : paymentType === 'PARTIAL_PAYMENT' ? 'Partial' : 'Interest Only'} payment of ₹${paidAmount.toFixed(2)} for EMI #${emi.installmentNumber}`
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: getPaymentSuccessMessage(paymentType, paidAmount, remainingPrincipal),
      data: {
        emiId: updatedEMI.id,
        paymentStatus: updatedEMI.paymentStatus,
        paidAmount: updatedEMI.paidAmount,
        paidPrincipal: updatedEMI.paidPrincipal,
        paidInterest: updatedEMI.paidInterest,
        isPartialPayment: updatedEMI.isPartialPayment,
        isInterestOnly: updatedEMI.isInterestOnly,
        nextPaymentDate: updatedEMI.nextPaymentDate,
        creditType,
        creditedTo: creditType === 'PERSONAL' ? paidBy : companyId,
        paymentId: payment.id,
        receiptNumber: payment.receiptNumber
      }
    });

  } catch (error) {
    console.error('EMI payment error:', error);
    return NextResponse.json({ error: 'Failed to process payment', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

function getPaymentSuccessMessage(paymentType: string, paidAmount: number, deferredPrincipal: number): string {
  switch (paymentType) {
    case 'PARTIAL_PAYMENT':
      return `Partial payment of ₹${paidAmount.toFixed(2)} received. Remaining balance rescheduled.`;
    case 'INTEREST_ONLY':
      return `Interest payment of ₹${paidAmount.toFixed(2)} received. Principal of ₹${deferredPrincipal.toFixed(2)} deferred to next EMI.`;
    default:
      return 'EMI paid successfully';
  }
}
