import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateApplicationNo } from '@/utils/helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, loanType, requestedAmount, requestedTenure, purpose } = body;

    if (!customerId || !requestedAmount || !requestedTenure) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const applicationNo = generateApplicationNo();

    const loan = await db.loanApplication.create({
      data: {
        applicationNo,
        customerId,
        loanType: loanType || 'PERSONAL',
        requestedAmount: parseFloat(requestedAmount),
        requestedTenure: parseInt(requestedTenure),
        purpose,
        status: 'SUBMITTED'
      }
    });

    await db.auditLog.create({
      data: {
        userId: customerId,
        action: 'CREATE',
        module: 'LOAN',
        description: `Loan application ${applicationNo} submitted`,
        recordId: loan.id,
        recordType: 'LoanApplication',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      loan
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json(
      { error: 'Failed to create loan application' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanId, status, userId, ...updateData } = body;

    if (!loanId) {
      return NextResponse.json(
        { error: 'Loan ID is required' },
        { status: 400 }
      );
    }

    const loan = await db.loanApplication.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan application not found' },
        { status: 404 }
      );
    }

    // Separate LoanApplication fields from LoanForm fields
    const loanFormFields = ['panVerified', 'aadhaarVerified', 'bankVerified', 'employmentVerified', 
                           'addressVerified', 'incomeVerified', 'verificationRemarks', 'fraudFlag'];
    
    // Map frontend field names to schema field names
    const fieldMapping: Record<string, string> = {
      ref1Name: 'reference1Name',
      ref1Phone: 'reference1Phone',
      ref1Relation: 'reference1Relation',
      ref1Address: 'reference1Address',
      ref2Name: 'reference2Name',
      ref2Phone: 'reference2Phone',
      ref2Relation: 'reference2Relation',
      ref2Address: 'reference2Address',
    };
    
    const loanApplicationData: Record<string, unknown> = {};
    const loanFormData: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(updateData)) {
      // Map the field name if it's in the mapping
      const mappedKey = fieldMapping[key] || key;
      
      if (loanFormFields.includes(mappedKey)) {
        loanFormData[mappedKey] = value;
      } else {
        loanApplicationData[mappedKey] = value;
      }
    }
    
    // Build update data for LoanApplication
    const data: Record<string, unknown> = { updatedAt: new Date() };
    
    // Copy only non-empty values from loanApplicationData
    for (const [key, value] of Object.entries(loanApplicationData)) {
      // Skip empty strings and undefined values
      if (value === '' || value === undefined || value === null) {
        continue;
      }
      // For strings, trim and check if not empty
      if (typeof value === 'string' && value.trim() === '') {
        continue;
      }
      // Special handling for dateOfBirth - skip if it's an empty or invalid date
      if (key === 'dateOfBirth') {
        if (typeof value === 'string' && value.trim()) {
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate.getTime())) {
            data[key] = parsedDate;
          }
        }
        continue; // Skip the normal assignment for dateOfBirth
      }
      data[key] = value;
    }
    
    // Handle numeric fields - only set if valid number
    if (data.monthlyIncome) {
      const num = parseFloat(data.monthlyIncome as string);
      if (!isNaN(num)) data.monthlyIncome = num;
      else delete data.monthlyIncome;
    }
    if (data.annualIncome) {
      const num = parseFloat(data.annualIncome as string);
      if (!isNaN(num)) data.annualIncome = num;
      else delete data.annualIncome;
    }
    if (data.yearsInEmployment) {
      const num = parseInt(data.yearsInEmployment as string);
      if (!isNaN(num)) data.yearsInEmployment = num;
      else delete data.yearsInEmployment;
    }
    if (data.totalWorkExperience) {
      const num = parseInt(data.totalWorkExperience as string);
      if (!isNaN(num)) data.totalWorkExperience = num;
      else delete data.totalWorkExperience;
    }
    // riskScore is already an integer from the form
    if (data.riskScore !== undefined) {
      const num = parseInt(data.riskScore as string);
      if (!isNaN(num)) data.riskScore = num;
      else delete data.riskScore;
    }
    
    // Handle status update
    if (status) {
      data.status = status;
      if (status === 'LOAN_FORM_COMPLETED') {
        data.loanFormCompletedAt = new Date();
        data.currentStage = 'SESSION_CREATION';
        
        // Reassign back to the agent who assigned this staff
        // Get the staff user and find their supervising agent
        if (userId) {
          const staffUser = await db.user.findUnique({
            where: { id: userId },
            select: { agentId: true }
          });
          if (staffUser?.agentId) {
            data.currentHandlerId = staffUser.agentId;
          }
        }
      }
    }

    // Update the loan application (without LoanForm fields)
    const updatedLoan = await db.loanApplication.update({
      where: { id: loanId },
      data
    });

    // Create or update loan form
    const existingLoanForm = await db.loanForm.findUnique({
      where: { loanApplicationId: loanId }
    });

    if (existingLoanForm) {
      await db.loanForm.update({
        where: { loanApplicationId: loanId },
        data: {
          panVerified: updateData.panVerified || false,
          aadhaarVerified: updateData.aadhaarVerified || false,
          bankVerified: updateData.bankVerified || false,
          employmentVerified: !!(updateData.employmentType && updateData.employerName),
          addressVerified: !!(updateData.address && updateData.city),
          incomeVerified: !!(updateData.monthlyIncome),
          verificationDate: new Date(),
          verifiedById: userId,
          riskScore: parseInt(updateData.riskScore) || 0,
          fraudFlag: updateData.fraudFlag || false,
          fraudReason: updateData.fraudFlag ? updateData.verificationRemarks : null,
          verificationRemarks: updateData.verificationRemarks,
          internalRemarks: updateData.verificationRemarks
        }
      });
    } else {
      await db.loanForm.create({
        data: {
          loanApplicationId: loanId,
          panVerified: updateData.panVerified || false,
          aadhaarVerified: updateData.aadhaarVerified || false,
          bankVerified: updateData.bankVerified || false,
          employmentVerified: !!(updateData.employmentType && updateData.employerName),
          addressVerified: !!(updateData.address && updateData.city),
          incomeVerified: !!(updateData.monthlyIncome),
          verificationDate: new Date(),
          verifiedById: userId,
          riskScore: parseInt(updateData.riskScore) || 0,
          fraudFlag: updateData.fraudFlag || false,
          fraudReason: updateData.fraudFlag ? updateData.verificationRemarks : null,
          verificationRemarks: updateData.verificationRemarks,
          internalRemarks: updateData.verificationRemarks
        }
      });
    }

    // Create workflow log if status changed
    if (status && status !== loan.status) {
      await db.workflowLog.create({
        data: {
          loanApplicationId: loanId,
          actionById: userId || 'system',
          previousStatus: loan.status,
          newStatus: status,
          action: 'complete_form',
          remarks: updateData.verificationRemarks || 'Verification completed',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      });
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: userId || 'system',
        action: 'UPDATE',
        module: 'LOAN',
        description: `Loan application ${loan.applicationNo} updated`,
        recordId: loanId,
        recordType: 'LoanApplication',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      loan: updatedLoan
    });
  } catch (error) {
    console.error('Error updating loan:', error);
    return NextResponse.json(
      { error: 'Failed to update loan application', details: (error as Error).message },
      { status: 500 }
    );
  }
}
