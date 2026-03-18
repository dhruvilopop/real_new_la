import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'all') {
      const [services, banners, testimonials] = await Promise.all([
        db.cMSService.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
        db.cMSBanner.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
        db.cMSTestimonial.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })
      ]);

      const loanStats = await db.loanApplication.aggregate({
        _count: { id: true },
        _sum: { requestedAmount: true }
      });

      const customerCount = await db.user.count({ where: { role: 'CUSTOMER' } });
      const companyCount = await db.company.count();

      return NextResponse.json({
        services,
        banners,
        testimonials,
        stats: {
          totalLoans: loanStats._count.id,
          totalDisbursed: loanStats._sum.requestedAmount || 0,
          activeCustomers: customerCount,
          companies: companyCount
        }
      });
    }

    const services = await db.cMSService.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({ services });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch CMS data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = await db.cMSService.create({
      data: {
        title: body.title,
        description: body.description,
        icon: body.icon,
        loanType: body.loanType || 'PERSONAL',
        minInterestRate: parseFloat(body.minInterestRate) || 8,
        maxInterestRate: parseFloat(body.maxInterestRate) || 24,
        defaultInterestRate: parseFloat(body.defaultInterestRate) || 12,
        minTenure: parseInt(body.minTenure) || 6,
        maxTenure: parseInt(body.maxTenure) || 60,
        defaultTenure: parseInt(body.defaultTenure) || 12,
        minAmount: parseFloat(body.minAmount) || 10000,
        maxAmount: parseFloat(body.maxAmount) || 10000000,
        isActive: body.isActive ?? true
      }
    });

    return NextResponse.json({ success: true, service });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    const service = await db.cMSService.update({
      where: { id },
      data
    });

    return NextResponse.json({ success: true, service });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    await db.cMSService.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
