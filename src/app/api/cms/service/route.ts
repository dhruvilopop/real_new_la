import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache, CacheKeys } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'all') {
      // Use cache for landing page data (30 seconds)
      const [services, banners, testimonials, loanStats, customerCount, companyCount] = await Promise.all([
        cache.getOrSet(CacheKeys.CMS_SERVICES, () => 
          db.cMSService.findMany({ 
            where: { isActive: true }, 
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              description: true,
              icon: true,
              loanType: true,
              minInterestRate: true,
              maxInterestRate: true,
              defaultInterestRate: true,
              minTenure: true,
              maxTenure: true,
              defaultTenure: true,
              minAmount: true,
              maxAmount: true,
              processingFeePercent: true,
              isActive: true
            }
          }),
        30000),
        cache.getOrSet(CacheKeys.CMS_BANNERS, () =>
          db.cMSBanner.findMany({ 
            where: { isActive: true }, 
            orderBy: { order: 'asc' },
            select: { id: true, title: true, subtitle: true, imageUrl: true, linkUrl: true, buttonText: true }
          }),
        30000),
        cache.getOrSet(CacheKeys.CMS_TESTIMONIALS, () =>
          db.cMSTestimonial.findMany({ 
            where: { isActive: true }, 
            orderBy: { order: 'asc' },
            select: { id: true, customerName: true, designation: true, content: true, rating: true, imageUrl: true }
          }),
        30000),
        cache.getOrSet(CacheKeys.LOAN_STATS, () =>
          db.loanApplication.aggregate({
            _count: { id: true },
            _sum: { requestedAmount: true }
          }),
        30000),
        cache.getOrSet(CacheKeys.USER_COUNT, () =>
          db.user.count({ where: { role: 'CUSTOMER' } }),
        30000),
        cache.getOrSet(CacheKeys.COMPANY_COUNT, () =>
          db.company.count(),
        30000)
      ]);

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

    // Clear cache
    cache.delete(CacheKeys.CMS_SERVICES);

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

    // Clear cache
    cache.delete(CacheKeys.CMS_SERVICES);

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

    // Clear cache
    cache.delete(CacheKeys.CMS_SERVICES);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
