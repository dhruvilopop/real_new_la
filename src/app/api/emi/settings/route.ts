import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT - Update EMI settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { emiId, allowPartialPayment, allowInterestOnly, autoAdjustDates } = body;

    if (!emiId) {
      return NextResponse.json({ error: 'EMI ID is required' }, { status: 400 });
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (typeof allowPartialPayment === 'boolean') {
      updateData.allowPartialPayment = allowPartialPayment;
    }
    if (typeof allowInterestOnly === 'boolean') {
      updateData.allowInterestOnly = allowInterestOnly;
    }
    if (typeof autoAdjustDates === 'boolean') {
      updateData.autoAdjustDates = autoAdjustDates;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No settings to update' }, { status: 400 });
    }

    // Update the EMI schedule
    const updatedEmi = await db.eMISchedule.update({
      where: { id: emiId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'EMI settings updated successfully',
      emi: updatedEmi
    });
  } catch (error) {
    console.error('Error updating EMI settings:', error);
    return NextResponse.json({ error: 'Failed to update EMI settings' }, { status: 500 });
  }
}

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
        allowPartialPayment: true,
        allowInterestOnly: true,
        autoAdjustDates: true,
        paymentStatus: true
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
