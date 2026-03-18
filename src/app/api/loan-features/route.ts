import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET handler for various loan features
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const loanId = searchParams.get('loanId');
    const customerId = searchParams.get('customerId');
    const companyId = searchParams.get('companyId');
    const agentId = searchParams.get('agentId');

    switch (action) {
      case 'pre-approved-offers':
        // Get pre-approved offers for a customer
        const offers = await db.preApprovedOffer.findMany({
          where: {
            customerId: customerId || undefined,
            companyId: companyId || undefined,
            status: 'PENDING',
            validTill: { gte: new Date() }
          },
          include: {
            company: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, offers });

      case 'top-up-requests':
        // Get loan top-up requests
        const topUps = await db.loanTopUp.findMany({
          where: { loanApplicationId: loanId || undefined },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, topUps });

      case 'foreclosure-requests':
        // Get foreclosure requests
        const foreclosures = await db.foreclosureRequest.findMany({
          where: { loanApplicationId: loanId || undefined },
          include: {
            loanApplication: {
              include: { customer: { select: { name: true, email: true } } }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, foreclosures });

      case 'emi-date-requests':
        // Get EMI date change requests
        const emiDateRequests = await db.eMIDateChangeRequest.findMany({
          where: { loanApplicationId: loanId || undefined },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, emiDateRequests });

      case 'counter-offers':
        // Get counter offers for a loan
        const counterOffers = await db.counterOffer.findMany({
          where: { loanApplicationId: loanId || undefined },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, counterOffers });

      case 'document-requests':
        // Get document re-upload requests
        const docRequests = await db.documentRequest.findMany({
          where: { loanApplicationId: loanId || undefined },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, docRequests });

      case 'commission-slabs':
        // Get commission slabs for a company
        const slabs = await db.commissionSlab.findMany({
          where: { companyId: companyId || undefined, isActive: true },
          orderBy: { commissionRate: 'asc' }
        });
        return NextResponse.json({ success: true, slabs });

      case 'agent-performance':
        // Get agent performance metrics
        const performance = await db.agentPerformance.findMany({
          where: {
            agentId: agentId || undefined,
            companyId: companyId || undefined
          },
          orderBy: { month: 'desc' },
          take: 12
        });
        return NextResponse.json({ success: true, performance });

      case 'grace-period-config':
        // Get grace period configuration
        const graceConfig = await db.gracePeriodConfig.findFirst({
          where: {
            companyId: companyId || undefined,
            isActive: true
          }
        });
        return NextResponse.json({ success: true, graceConfig });

      case 'restructure-requests':
        // Get loan restructure requests
        const restructures = await db.loanRestructure.findMany({
          where: { loanApplicationId: loanId || undefined },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, restructures });

      case 'npa-tracking':
        // Get NPA tracking data
        const npaData = await db.nPATracking.findMany({
          where: { loanApplicationId: loanId || undefined },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, npaData });

      case 'all-npa':
        // Get all NPA accounts for company/super admin
        const allNpa = await db.nPATracking.findMany({
          where: { npaStatus: { in: ['SMA1', 'SMA2', 'NPA'] } },
          include: {
            loanApplication: {
              include: {
                customer: { select: { name: true, email: true, phone: true } }
              }
            }
          },
          orderBy: { daysOverdue: 'desc' }
        });
        return NextResponse.json({ success: true, npaList: allNpa });

      case 'credit-scores':
        // Get credit risk scores for a customer
        const creditScores = await db.creditRiskScore.findMany({
          where: { customerId: customerId || undefined },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
        return NextResponse.json({ success: true, creditScores });

      case 'fraud-alerts':
        // Get fraud alerts
        const fraudAlerts = await db.fraudAlert.findMany({
          where: {
            loanApplicationId: loanId || undefined,
            isResolved: false
          },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, fraudAlerts });

      case 'all-fraud-alerts':
        // Get all unresolved fraud alerts
        const allFraudAlerts = await db.fraudAlert.findMany({
          where: { isResolved: false },
          include: {
            loanApplication: {
              include: {
                customer: { select: { name: true, email: true } }
              }
            }
          },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }]
        });
        return NextResponse.json({ success: true, fraudAlerts: allFraudAlerts });

      case 'referrals':
        // Get customer referrals
        const referrals = await db.referral.findMany({
          where: { referrerId: customerId || undefined },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, referrals });

      case 'appointments':
        // Get appointments
        const appointments = await db.appointment.findMany({
          where: {
            customerId: customerId || undefined,
            staffId: agentId || undefined,
            status: 'SCHEDULED'
          },
          orderBy: { scheduledAt: 'asc' }
        });
        return NextResponse.json({ success: true, appointments });

      case 'loan-timeline':
        // Get loan progress timeline
        const timeline = await db.loanProgressTimeline.findMany({
          where: { loanApplicationId: loanId || undefined },
          orderBy: { timestamp: 'asc' }
        });
        return NextResponse.json({ success: true, timeline });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in loan features API:', error);
    return NextResponse.json({
      error: 'Failed to fetch data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST handler for creating loan feature requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'create-pre-approved-offer':
        const offer = await db.preApprovedOffer.create({
          data: {
            customerId: data.customerId,
            companyId: data.companyId,
            offerAmount: data.offerAmount,
            interestRate: data.interestRate,
            maxTenure: data.maxTenure,
            validTill: new Date(data.validTill),
            basedOnScore: data.basedOnScore,
            basedOnHistory: data.basedOnHistory || false
          }
        });
        return NextResponse.json({ success: true, offer });

      case 'create-top-up':
        const topUp = await db.loanTopUp.create({
          data: {
            loanApplicationId: data.loanApplicationId,
            requestedAmount: data.requestedAmount,
            reason: data.reason
          }
        });
        return NextResponse.json({ success: true, topUp });

      case 'create-foreclosure':
        const foreclosure = await db.foreclosureRequest.create({
          data: {
            loanApplicationId: data.loanApplicationId,
            requestType: data.requestType || 'FULL',
            outstandingPrincipal: data.outstandingPrincipal,
            pendingInterest: data.pendingInterest,
            penaltyCharges: data.penaltyCharges || 0,
            totalSettlement: data.totalSettlement,
            requestedById: data.requestedById
          }
        });
        return NextResponse.json({ success: true, foreclosure });

      case 'create-emi-date-change':
        const emiDateChange = await db.eMIDateChangeRequest.create({
          data: {
            loanApplicationId: data.loanApplicationId,
            currentDueDate: data.currentDueDate,
            requestedDueDate: data.requestedDueDate,
            reason: data.reason
          }
        });
        return NextResponse.json({ success: true, emiDateChange });

      case 'create-counter-offer':
        const counterOffer = await db.counterOffer.create({
          data: {
            loanApplicationId: data.loanApplicationId,
            offeredById: data.offeredById,
            offeredToId: data.offeredToId,
            offeredAmount: data.offeredAmount,
            interestRate: data.interestRate,
            tenure: data.tenure,
            message: data.message,
            parentOfferId: data.parentOfferId
          }
        });
        return NextResponse.json({ success: true, counterOffer });

      case 'create-document-request':
        const docRequest = await db.documentRequest.create({
          data: {
            loanApplicationId: data.loanApplicationId,
            documentType: data.documentType,
            reason: data.reason,
            requestedById: data.requestedById
          }
        });
        return NextResponse.json({ success: true, docRequest });

      case 'create-commission-slab':
        const slab = await db.commissionSlab.create({
          data: {
            companyId: data.companyId,
            name: data.name,
            minDisbursement: data.minDisbursement || 0,
            maxDisbursement: data.maxDisbursement,
            commissionRate: data.commissionRate,
            minApprovalRatio: data.minApprovalRatio || 0
          }
        });
        return NextResponse.json({ success: true, slab });

      case 'create-grace-config':
        const graceConfig = await db.gracePeriodConfig.create({
          data: {
            companyId: data.companyId,
            loanType: data.loanType || 'ALL',
            graceDays: data.graceDays || 5,
            penaltyAfterGrace: data.penaltyAfterGrace || 2,
            dailyPenalty: data.dailyPenalty || 0.1
          }
        });
        return NextResponse.json({ success: true, graceConfig });

      case 'create-restructure':
        const restructure = await db.loanRestructure.create({
          data: {
            loanApplicationId: data.loanApplicationId,
            reason: data.reason,
            originalTenure: data.originalTenure,
            newTenure: data.newTenure,
            originalEMI: data.originalEMI,
            newEMI: data.newEMI
          }
        });
        return NextResponse.json({ success: true, restructure });

      case 'create-referral':
        const referral = await db.referral.create({
          data: {
            referrerId: data.referrerId,
            referredEmail: data.referredEmail,
            referredPhone: data.referredPhone
          }
        });
        return NextResponse.json({ success: true, referral });

      case 'create-appointment':
        const appointment = await db.appointment.create({
          data: {
            loanApplicationId: data.loanApplicationId,
            customerId: data.customerId,
            staffId: data.staffId,
            scheduledAt: new Date(data.scheduledAt),
            type: data.type,
            location: data.location,
            latitude: data.latitude,
            longitude: data.longitude,
            notes: data.notes
          }
        });
        return NextResponse.json({ success: true, appointment });

      case 'calculate-credit-score':
        // Calculate credit score based on various factors
        const scoreData = await calculateCreditScore(data);
        const creditScore = await db.creditRiskScore.create({
          data: {
            customerId: data.customerId,
            loanApplicationId: data.loanApplicationId,
            score: scoreData.score,
            factors: JSON.stringify(scoreData.factors),
            incomeRatio: scoreData.incomeRatio,
            emiToIncomeRatio: scoreData.emiToIncomeRatio,
            employmentScore: scoreData.employmentScore,
            repaymentHistory: scoreData.repaymentHistory,
            geoRiskScore: scoreData.geoRiskScore
          }
        });
        return NextResponse.json({ success: true, creditScore, breakdown: scoreData });

      case 'check-fraud':
        // Check for potential fraud patterns
        const fraudResults = await checkFraudPatterns(data);
        return NextResponse.json({ success: true, fraudResults });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in loan features API:', error);
    return NextResponse.json({
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT handler for updating loan feature requests
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, data } = body;

    switch (action) {
      case 'approve-top-up':
        const approvedTopUp = await db.loanTopUp.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedAmount: data.approvedAmount,
            mergedEMI: data.mergedEMI,
            revisedTenure: data.revisedTenure,
            approvedById: data.approvedById,
            approvedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, topUp: approvedTopUp });

      case 'approve-foreclosure':
        const approvedForeclosure = await db.foreclosureRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: data.approvedById,
            approvedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, foreclosure: approvedForeclosure });

      case 'complete-foreclosure':
        const completedForeclosure = await db.foreclosureRequest.update({
          where: { id },
          data: { status: 'COMPLETED' }
        });
        // Update loan status to CLOSED
        await db.loanApplication.update({
          where: { id: completedForeclosure.loanApplicationId },
          data: { status: 'CLOSED', closedAt: new Date() }
        });
        return NextResponse.json({ success: true, foreclosure: completedForeclosure });

      case 'approve-emi-date-change':
        const approvedEmiChange = await db.eMIDateChangeRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: data.approvedById,
            approvedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, emiDateChange: approvedEmiChange });

      case 'accept-counter-offer':
        const acceptedOffer = await db.counterOffer.update({
          where: { id },
          data: { status: 'ACCEPTED' }
        });
        return NextResponse.json({ success: true, counterOffer: acceptedOffer });

      case 'reject-counter-offer':
        const rejectedOffer = await db.counterOffer.update({
          where: { id },
          data: { status: 'REJECTED' }
        });
        return NextResponse.json({ success: true, counterOffer: rejectedOffer });

      case 'complete-document-request':
        const completedDoc = await db.documentRequest.update({
          where: { id },
          data: {
            status: 'UPLOADED',
            uploadedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, documentRequest: completedDoc });

      case 'verify-document':
        const verifiedDoc = await db.documentRequest.update({
          where: { id },
          data: {
            status: 'VERIFIED',
            verifiedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, documentRequest: verifiedDoc });

      case 'approve-restructure':
        const approvedRestructure = await db.loanRestructure.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: data.approvedById,
            approvedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, restructure: approvedRestructure });

      case 'resolve-fraud-alert':
        const resolvedAlert = await db.fraudAlert.update({
          where: { id },
          data: {
            isResolved: true,
            resolvedById: data.resolvedById,
            resolvedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, fraudAlert: resolvedAlert });

      case 'accept-pre-approved-offer':
        const acceptedPreOffer = await db.preApprovedOffer.update({
          where: { id },
          data: { status: 'ACCEPTED' }
        });
        return NextResponse.json({ success: true, offer: acceptedPreOffer });

      case 'complete-appointment':
        const completedAppt = await db.appointment.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            checkInAt: new Date(),
            checkInLatitude: data.latitude,
            checkInLongitude: data.longitude
          }
        });
        return NextResponse.json({ success: true, appointment: completedAppt });

      case 'update-npa-status':
        const updatedNpa = await db.nPATracking.update({
          where: { id },
          data: {
            npaStatus: data.npaStatus,
            npaDate: data.npaStatus === 'NPA' ? new Date() : null,
            recoveryStatus: data.recoveryStatus,
            lastContactDate: data.lastContactDate ? new Date(data.lastContactDate) : null
          }
        });
        return NextResponse.json({ success: true, npa: updatedNpa });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in loan features API:', error);
    return NextResponse.json({
      error: 'Failed to update',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to calculate credit score
async function calculateCreditScore(data: {
  monthlyIncome?: number;
  requestedEMI?: number;
  employmentType?: string;
  yearsInEmployment?: number;
  existingLoans?: number;
  repaymentHistory?: number[];
  city?: string;
  state?: string;
}): Promise<{
  score: number;
  factors: Record<string, number>;
  incomeRatio: number;
  emiToIncomeRatio: number;
  employmentScore: number;
  repaymentHistory: number;
  geoRiskScore: number;
}> {
  let score = 500; // Base score
  const factors: Record<string, number> = {};

  // Income ratio (max 150 points)
  let incomeScore = 0;
  if (data.monthlyIncome && data.monthlyIncome > 50000) incomeScore = 150;
  else if (data.monthlyIncome && data.monthlyIncome > 30000) incomeScore = 100;
  else if (data.monthlyIncome && data.monthlyIncome > 15000) incomeScore = 50;
  factors.income = incomeScore;
  score += incomeScore;

  // EMI to Income ratio (max 100 points)
  let emiScore = 0;
  const emiToIncomeRatio = data.monthlyIncome && data.requestedEMI
    ? data.requestedEMI / data.monthlyIncome
    : 0;
  if (emiToIncomeRatio < 0.3) emiScore = 100;
  else if (emiToIncomeRatio < 0.5) emiScore = 50;
  else if (emiToIncomeRatio < 0.7) emiScore = 0;
  else emiScore = -50;
  factors.emiRatio = emiScore;
  score += emiScore;

  // Employment type (max 100 points)
  let empScore = 0;
  if (data.employmentType === 'SALARIED') empScore = 100;
  else if (data.employmentType === 'SELF_EMPLOYED') empScore = 70;
  else empScore = 30;
  factors.employment = empScore;
  score += empScore;

  // Years in employment (max 50 points)
  let expScore = 0;
  if (data.yearsInEmployment && data.yearsInEmployment >= 5) expScore = 50;
  else if (data.yearsInEmployment && data.yearsInEmployment >= 2) expScore = 30;
  else expScore = 10;
  factors.experience = expScore;
  score += expScore;

  // Repayment history (max 100 points)
  let repaymentScore = 50;
  if (data.repaymentHistory && data.repaymentHistory.length > 0) {
    const onTimePayments = data.repaymentHistory.filter(p => p === 1).length;
    repaymentScore = Math.round((onTimePayments / data.repaymentHistory.length) * 100);
  }
  factors.repaymentHistory = repaymentScore;
  score += repaymentScore - 50;

  // Geo risk (max 50 points)
  let geoScore = 25;
  factors.geoRisk = geoScore;
  score += geoScore;

  // Cap score between 300 and 900
  score = Math.max(300, Math.min(900, score));

  return {
    score,
    factors,
    incomeRatio: data.monthlyIncome ? data.monthlyIncome / 100000 : 0,
    emiToIncomeRatio,
    employmentScore: empScore,
    repaymentHistory: repaymentScore,
    geoRiskScore: geoScore
  };
}

// Helper function to check fraud patterns
async function checkFraudPatterns(data: {
  panNumber?: string;
  phone?: string;
  email?: string;
  deviceId?: string;
  ipAddress?: string;
  loanApplicationId: string;
}): Promise<{
  hasRisk: boolean;
  alerts: Array<{ type: string; severity: string; details: string }>;
}> {
  const alerts: Array<{ type: string; severity: string; details: string }> = [];

  // Check for multiple PAN applications
  if (data.panNumber) {
    const panMatches = await db.applicationFingerprint.count({
      where: {
        panNumber: data.panNumber,
        loanApplicationId: { not: data.loanApplicationId }
      }
    });
    if (panMatches > 0) {
      alerts.push({
        type: 'MULTIPLE_PAN',
        severity: 'HIGH',
        details: `PAN number has been used in ${panMatches} other application(s)`
      });
    }
  }

  // Check for multiple phone applications
  if (data.phone) {
    const phoneMatches = await db.applicationFingerprint.count({
      where: {
        phoneNumber: data.phone,
        loanApplicationId: { not: data.loanApplicationId }
      }
    });
    if (phoneMatches > 0) {
      alerts.push({
        type: 'MULTIPLE_PHONE',
        severity: 'MEDIUM',
        details: `Phone number has been used in ${phoneMatches} other application(s)`
      });
    }
  }

  // Check for multiple email applications
  if (data.email) {
    const emailMatches = await db.applicationFingerprint.count({
      where: {
        emailAddress: data.email,
        loanApplicationId: { not: data.loanApplicationId }
      }
    });
    if (emailMatches > 0) {
      alerts.push({
        type: 'MULTIPLE_EMAIL',
        severity: 'MEDIUM',
        details: `Email has been used in ${emailMatches} other application(s)`
      });
    }
  }

  // Check for multiple device applications
  if (data.deviceId) {
    const deviceMatches = await db.applicationFingerprint.count({
      where: {
        deviceId: data.deviceId,
        loanApplicationId: { not: data.loanApplicationId }
      }
    });
    if (deviceMatches > 0) {
      alerts.push({
        type: 'MULTIPLE_DEVICE',
        severity: 'HIGH',
        details: `Device has been used for ${deviceMatches} other application(s)`
      });
    }
  }

  // Create fingerprint record
  await db.applicationFingerprint.create({
    data: {
      panNumber: data.panNumber,
      phoneNumber: data.phone,
      emailAddress: data.email,
      deviceId: data.deviceId,
      ipAddress: data.ipAddress,
      loanApplicationId: data.loanApplicationId,
      isDuplicate: alerts.length > 0
    }
  });

  // Create fraud alerts
  for (const alert of alerts) {
    await db.fraudAlert.create({
      data: {
        loanApplicationId: data.loanApplicationId,
        alertType: alert.type,
        severity: alert.severity,
        details: alert.details
      }
    });
  }

  return {
    hasRisk: alerts.length > 0,
    alerts
  };
}
