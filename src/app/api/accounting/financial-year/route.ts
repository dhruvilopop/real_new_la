import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch financial years
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';

    const financialYears = await db.financialYear.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ financialYears });
  } catch (error) {
    console.error('Error fetching financial years:', error);
    return NextResponse.json({ financialYears: [] });
  }
}

// POST - Create new financial year
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, name, startDate, endDate, previousYearId } = body;

    // Check if financial year already exists
    const existing = await db.financialYear.findFirst({
      where: { companyId: companyId || 'default', name },
    });

    if (existing) {
      return NextResponse.json({ error: 'Financial year already exists' }, { status: 400 });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
    }

    // Create financial year
    const financialYear = await db.financialYear.create({
      data: {
        companyId: companyId || 'default',
        name,
        startDate: start,
        endDate: end,
        previousYearId,
        isClosed: false,
        carryForwardDone: false,
      },
    });

    return NextResponse.json({ financialYear });
  } catch (error) {
    console.error('Error creating financial year:', error);
    return NextResponse.json({ error: 'Failed to create financial year' }, { status: 500 });
  }
}

// PUT - Close financial year
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, closedById } = body;

    const financialYear = await db.financialYear.findUnique({
      where: { id },
    });

    if (!financialYear) {
      return NextResponse.json({ error: 'Financial year not found' }, { status: 404 });
    }

    if (financialYear.isClosed) {
      return NextResponse.json({ error: 'Financial year already closed' }, { status: 400 });
    }

    // Mark as closed
    const updated = await db.financialYear.update({
      where: { id },
      data: {
        isClosed: true,
        closedById,
        closedAt: new Date(),
        carryForwardDone: true,
      },
    });

    return NextResponse.json({ financialYear: updated });
  } catch (error) {
    console.error('Error closing financial year:', error);
    return NextResponse.json({ error: 'Failed to close financial year' }, { status: 500 });
  }
}
