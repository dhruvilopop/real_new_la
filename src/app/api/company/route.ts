import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch companies
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const isActive = searchParams.get('isActive');

    if (id) {
      // Fetch single company
      const company = await db.company.findUnique({
        where: { id },
        include: {
          users: {
            where: { role: { in: ['AGENT', 'STAFF', 'CASHIER'] } },
            select: { id: true, name: true, role: true, isActive: true }
          },
          _count: {
            select: {
              loanApplications: true,
              users: true
            }
          }
        }
      });

      if (!company) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }

      return NextResponse.json({ company });
    }

    // Fetch all companies
    const where: Record<string, unknown> = {};
    if (isActive === 'true') {
      where.isActive = true;
    }

    const companies = await db.company.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            loanApplications: true,
            users: true
          }
        }
      }
    });

    // Get additional stats for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        // Get loan stats
        const activeLoans = await db.loanApplication.count({
          where: {
            companyId: company.id,
            status: { in: ['ACTIVE', 'DISBURSED'] }
          }
        });

        const totalDisbursed = await db.loanApplication.aggregate({
          where: {
            companyId: company.id,
            status: { in: ['ACTIVE', 'DISBURSED'] }
          },
          _sum: {
            disbursedAmount: true
          }
        });

        return {
          ...company,
          stats: {
            activeLoans,
            totalDisbursed: totalDisbursed._sum.disbursedAmount || 0
          }
        };
      })
    );

    return NextResponse.json({ companies: companiesWithStats });
  } catch (error) {
    console.error('Company fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new company
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      code,
      registrationNo,
      gstNumber,
      address,
      city,
      state,
      pincode,
      contactEmail,
      contactPhone,
      maxLoanAmount,
      minLoanAmount,
      defaultInterestRate,
      maxTenureMonths
    } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    // Check if code already exists
    const existing = await db.company.findUnique({
      where: { code }
    });

    if (existing) {
      return NextResponse.json({ error: 'Company code already exists' }, { status: 400 });
    }

    const company = await db.company.create({
      data: {
        name,
        code,
        registrationNo,
        gstNumber,
        address,
        city,
        state,
        pincode,
        contactEmail,
        contactPhone,
        maxLoanAmount: maxLoanAmount || 10000000,
        minLoanAmount: minLoanAmount || 10000,
        defaultInterestRate: defaultInterestRate || 12,
        maxTenureMonths: maxTenureMonths || 60,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      company,
      message: 'Company created successfully'
    });
  } catch (error) {
    console.error('Company creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update company
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const company = await db.company.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      company,
      message: 'Company updated successfully'
    });
  } catch (error) {
    console.error('Company update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Deactivate company
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Check for active loans
    const activeLoans = await db.loanApplication.count({
      where: {
        companyId: id,
        status: { in: ['ACTIVE', 'DISBURSED'] }
      }
    });

    if (activeLoans > 0) {
      return NextResponse.json({
        error: 'Cannot deactivate company with active loans',
        activeLoans
      }, { status: 400 });
    }

    // Deactivate instead of delete
    const company = await db.company.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Company deactivated successfully'
    });
  } catch (error) {
    console.error('Company deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
