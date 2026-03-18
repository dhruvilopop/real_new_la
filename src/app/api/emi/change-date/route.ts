import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST - Change EMI due date
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emiId, newDueDate, reason, userId } = body;

    if (!emiId || !newDueDate || !reason || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get EMI details
    const emi = await db.eMISchedule.findUnique({
      where: { id: emiId },
      include: {
        loanApplication: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            sessionForm: { select: { emiAmount: true, tenure: true } }
          }
        }
      }
    });

    if (!emi) {
      return NextResponse.json({ error: 'EMI not found' }, { status: 404 });
    }

    if (emi.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'Cannot change date of paid EMI' }, { status: 400 });
    }

    const oldDueDate = emi.dueDate;
    const newDate = new Date(newDueDate);

    // Update the EMI schedule
    const result = await db.$transaction(async (tx) => {
      // Update this EMI's due date
      const updatedEmi = await tx.eMISchedule.update({
        where: { id: emiId },
        data: {
          dueDate: newDate,
          originalDueDate: emi.originalDueDate || oldDueDate,
          notes: `${emi.notes || ''}\n[DATE CHANGE] ${new Date().toISOString()}: Changed from ${oldDueDate.toISOString().split('T')[0]} to ${newDate.toISOString().split('T')[0]}. Reason: ${reason}`
        }
      });

      // Create workflow log entry
      await tx.workflowLog.create({
        data: {
          loanApplicationId: emi.loanApplicationId,
          action: 'EMI_DATE_CHANGE',
          previousStatus: emi.paymentStatus,
          newStatus: emi.paymentStatus,
          remarks: `EMI #${emi.installmentNumber} due date changed from ${oldDueDate.toISOString().split('T')[0]} to ${newDate.toISOString().split('T')[0]}. Reason: ${reason}`,
          actionById: userId
        }
      });

      // Get subsequent EMIs and shift them if needed
      const subsequentEmis = await tx.eMISchedule.findMany({
        where: {
          loanApplicationId: emi.loanApplicationId,
          installmentNumber: { gt: emi.installmentNumber },
          paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] }
        },
        orderBy: { installmentNumber: 'asc' }
      });

      // Calculate the date difference and shift subsequent EMIs
      const oldDateObj = new Date(oldDueDate);
      const daysDiff = Math.ceil((newDate.getTime() - oldDateObj.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 0 && subsequentEmis.length > 0) {
        // Shift subsequent EMIs by the same number of days
        for (const subsequentEmi of subsequentEmis) {
          const currentDueDate = new Date(subsequentEmi.dueDate);
          const newSubsequentDate = new Date(currentDueDate.getTime() + (daysDiff * 24 * 60 * 60 * 1000));

          await tx.eMISchedule.update({
            where: { id: subsequentEmi.id },
            data: {
              dueDate: newSubsequentDate,
              originalDueDate: subsequentEmi.originalDueDate || subsequentEmi.dueDate,
              notes: `${subsequentEmi.notes || ''}\n[AUTO-SHIFT] Shifted by ${daysDiff} days due to previous EMI date change.`
            }
          });
        }
      }

      return updatedEmi;
    });

    return NextResponse.json({
      success: true,
      emi: result,
      message: `EMI due date updated from ${oldDueDate.toISOString().split('T')[0]} to ${newDate.toISOString().split('T')[0]}`
    });

  } catch (error) {
    console.error('EMI date change error:', error);
    return NextResponse.json({ error: 'Failed to change EMI date' }, { status: 500 });
  }
}
