import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Maximum total location records to maintain
const MAX_TOTAL_LOCATION_LOGS = 500;

// Valid action types
const VALID_ACTIONS = ['APP_OPEN', 'LOAN_APPLY', 'EMI_PAY', 'SESSION_CONFIRM', 'LOGIN'] as const;
type LocationAction = typeof VALID_ACTIONS[number];

interface DeviceInfo {
  deviceType?: string;
  browser?: string;
  os?: string;
}

interface LocationTrackRequest {
  userId: string;
  latitude: number | string;
  longitude: number | string;
  accuracy?: number | string;
  action: LocationAction;
  loanApplicationId?: string;
  paymentId?: string;
  deviceInfo?: DeviceInfo;
}

export async function POST(request: NextRequest) {
  try {
    const body: LocationTrackRequest = await request.json();
    
    const {
      userId,
      latitude,
      longitude,
      accuracy,
      action,
      loanApplicationId,
      paymentId,
      deviceInfo
    } = body;

    // Validate required fields
    if (!userId || latitude === undefined || longitude === undefined || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, latitude, longitude, and action are required' 
      }, { status: 400 });
    }

    // Validate action type
    if (!VALID_ACTIONS.includes(action as LocationAction)) {
      return NextResponse.json({ 
        error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` 
      }, { status: 400 });
    }

    // Parse numeric values
    const parsedLatitude = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
    const parsedLongitude = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
    const parsedAccuracy = accuracy ? (typeof accuracy === 'string' ? parseFloat(accuracy) : accuracy) : null;

    // Validate parsed values
    if (isNaN(parsedLatitude) || isNaN(parsedLongitude)) {
      return NextResponse.json({ 
        error: 'Invalid latitude or longitude value' 
      }, { status: 400 });
    }

    // Create the location log
    const locationLog = await db.locationLog.create({
      data: {
        userId,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        accuracy: parsedAccuracy,
        action,
        loanApplicationId: loanApplicationId || null,
        paymentId: paymentId || null,
        deviceType: deviceInfo?.deviceType || null,
        browser: deviceInfo?.browser || null,
        os: deviceInfo?.os || null,
      }
    });

    // Check total count and delete oldest if exceeds 500
    const totalCount = await db.locationLog.count();
    
    if (totalCount > MAX_TOTAL_LOCATION_LOGS) {
      // Get the oldest records to delete
      const recordsToDelete = totalCount - MAX_TOTAL_LOCATION_LOGS;
      
      const oldestLogs = await db.locationLog.findMany({
        orderBy: { createdAt: 'asc' },
        take: recordsToDelete,
        select: { id: true }
      });

      if (oldestLogs.length > 0) {
        await db.locationLog.deleteMany({
          where: { 
            id: { in: oldestLogs.map(log => log.id) } 
          }
        });
      }
    }

    // Update user's lastLocation with formatted string "lat, lng"
    const formattedLocation = `${parsedLatitude}, ${parsedLongitude}`;
    
    await db.user.update({
      where: { id: userId },
      data: {
        lastLocation: formattedLocation,
        lastActivityAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      locationId: locationLog.id,
      location: {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        action,
        createdAt: locationLog.createdAt
      }
    });
  } catch (error) {
    console.error('Location tracking error:', error);
    return NextResponse.json({ 
      error: 'Failed to log location',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to retrieve location history for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '500');
    const action = searchParams.get('action');
    const fetchAll = searchParams.get('all') === 'true';

    // If fetchAll is true, return all locations (for admin use)
    if (fetchAll) {
      const whereClause: any = {};
      if (action) {
        whereClause.action = action;
      }

      const locationLogs = await db.locationLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true
            }
          }
        }
      });

      // Get total count
      const total = await db.locationLog.count();

      return NextResponse.json({ 
        success: true, 
        locations: locationLogs,
        count: locationLogs.length,
        total
      });
    }

    if (!userId) {
      return NextResponse.json({ 
        error: 'userId is required' 
      }, { status: 400 });
    }

    const whereClause: any = { userId };
    if (action) {
      whereClause.action = action;
    }

    const locationLogs = await db.locationLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ 
      success: true, 
      locations: locationLogs,
      count: locationLogs.length
    });
  } catch (error) {
    console.error('Location fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch location history' 
    }, { status: 500 });
  }
}
