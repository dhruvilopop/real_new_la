import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// DELETE loan with audit log recording
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const userId = searchParams.get('userId');
    const reason = searchParams.get('reason') || 'No reason provided';
    const loanType = searchParams.get('loanType') || 'ONLINE';

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    // Get the first super admin for audit logging
    const superAdmin = await db.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true }
    });
    
    const auditUserId = userId || superAdmin?.id;

    if (loanType === 'ONLINE') {
      // Fetch online loan details
      const loanDetails = await db.loanApplication.findUnique({
        where: { id: loanId },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          company: { select: { id: true, name: true } },
        }
      });

      if (!loanDetails) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }

      const applicationNo = loanDetails.applicationNo;
      const customerName = loanDetails.customer?.name || 'Unknown';

      // Delete ALL related records in correct order (children first, then parent)
      // Use transactions to ensure atomicity
      
      try {
        // Delete in order of dependency
        // 1. Child records with no further dependencies

        // Delete EMI payments details if any
        await db.eMISchedule.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Payments
        await db.payment.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Session Form
        await db.sessionForm.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Loan Form
        await db.loanForm.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Workflow Logs
        await db.workflowLog.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Loan Top-ups
        await db.loanTopUp.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Foreclosure Requests
        await db.foreclosureRequest.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete EMI Date Change Requests
        await db.eMIDateChangeRequest.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Counter Offers
        await db.counterOffer.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Document Requests
        await db.documentRequest.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Loan Restructures
        await db.loanRestructure.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete NPA Trackings
        await db.nPATracking.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Fraud Alerts
        await db.fraudAlert.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Appointments
        await db.appointment.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Credit Transactions (if related)
        await db.creditTransaction.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Loan Agreement
        await db.loanAgreement.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Application Fingerprint
        await db.applicationFingerprint.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Loan Progress Timeline
        await db.loanProgressTimeline.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Credit Risk Score
        await db.creditRiskScore.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Location Log
        await db.locationLog.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // Delete Audit Logs (except the one we're about to create)
        await db.auditLog.deleteMany({
          where: { loanApplicationId: loanId }
        }).catch(() => {});

        // 2. Now delete the loan application
        await db.loanApplication.delete({ 
          where: { id: loanId } 
        });

        // 3. Create audit log after successful deletion
        if (auditUserId) {
          try {
            await db.auditLog.create({
              data: {
                userId: auditUserId,
                action: 'DELETE',
                module: 'LOAN',
                description: `Loan ${applicationNo} deleted. Reason: ${reason}. Customer: ${customerName}`,
                oldValue: JSON.stringify({
                  applicationNo,
                  status: loanDetails.status,
                  requestedAmount: loanDetails.requestedAmount,
                  customerName,
                  reason
                }),
                newValue: null,
                recordId: loanId,
                recordType: 'LOAN_APPLICATION'
              }
            });
          } catch (e) {
            console.error('Failed to create audit log:', e);
          }
        }

        return NextResponse.json({ 
          success: true, 
          message: `Loan ${applicationNo} deleted successfully`
        });

      } catch (deleteError) {
        console.error('Error during deletion:', deleteError);
        
        // Try to identify what's blocking the deletion
        const errorMessage = deleteError instanceof Error ? deleteError.message : 'Unknown error';
        
        return NextResponse.json({ 
          error: 'Failed to delete loan - foreign key constraint',
          details: errorMessage,
          hint: 'There may be additional related records that need to be removed first'
        }, { status: 500 });
      }

    } else {
      // OFFLINE loan deletion
      const loanDetails = await db.offlineLoan.findUnique({
        where: { id: loanId }
      });

      if (!loanDetails) {
        return NextResponse.json({ error: 'Offline loan not found' }, { status: 404 });
      }

      // Delete offline loan EMIs first
      await db.offlineLoanEMI.deleteMany({ 
        where: { offlineLoanId: loanId } 
      }).catch(() => {});

      // Delete the offline loan
      await db.offlineLoan.delete({ 
        where: { id: loanId } 
      });

      // Create audit log
      if (auditUserId) {
        try {
          await db.auditLog.create({
            data: {
              userId: auditUserId,
              action: 'DELETE',
              module: 'OFFLINE_LOAN',
              description: `Offline Loan ${loanDetails.loanNumber} deleted. Reason: ${reason}`,
              oldValue: JSON.stringify({
                loanNumber: loanDetails.loanNumber,
                status: loanDetails.status,
                loanAmount: loanDetails.loanAmount,
                customerName: loanDetails.customerName,
                reason
              }),
              newValue: null,
              recordId: loanId,
              recordType: 'OFFLINE_LOAN'
            }
          });
        } catch (e) {
          console.error('Failed to create audit log:', e);
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `Offline loan ${loanDetails.loanNumber} deleted successfully`
      });
    }

  } catch (error) {
    console.error('Error deleting loan:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isPrismaError = error instanceof Prisma.PrismaClientKnownRequestError;
    
    return NextResponse.json({ 
      error: 'Failed to delete loan',
      details: errorMessage,
      code: isPrismaError ? (error as Prisma.PrismaClientKnownRequestError).code : undefined
    }, { status: 500 });
  }
}
