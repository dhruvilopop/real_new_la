import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get EMI settings for a loan
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    const emiSchedules = await db.eMISchedule.findMany({
      where: { loanApplicationId: loanId },
      select: {
        id: true,
        installmentNumber: true,
        isPartialPayment: true,
        isInterestOnly: true,
        principalDeferred: true,
        paymentStatus: true,
        totalAmount: true,
        paidAmount: true,
        dueDate: true
      },
      orderBy: { installmentNumber: 'asc' }
    });

    return NextResponse.json({
      success: true,
      settings: emiSchedules
    });
  } catch (error) {
    console.error('Error fetching EMI settings:', error);
    return NextResponse.json({ error: 'Failed to fetch EMI settings' }, { status: 500 });
  }
}
