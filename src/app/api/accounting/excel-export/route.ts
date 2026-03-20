import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import { cache, CacheTTL } from '@/lib/cache';

// GET - Generate comprehensive Excel data for government reporting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'full';
    const companyIds = searchParams.get('companyIds')?.split(',').filter(Boolean) || [];
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format_type = searchParams.get('format') || 'json';

    // Check cache
    const cacheKey = `excel:${reportType}:${companyIds.join(',')}:${startDate || ''}:${endDate || ''}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      if (format_type === 'csv') {
        return new NextResponse(cached.csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${cached.filename}"`
          }
        });
      }
      return NextResponse.json({ success: true, ...cached });
    }

    let data: any = {};
    
    switch (reportType) {
      case 'customer-loan-details':
        data = await getCustomerLoanDetails(companyIds, startDate, endDate);
        break;
      case 'emi-collection':
        data = await getEMICollectionData(companyIds, startDate, endDate);
        break;
      case 'disbursements':
        data = await getDisbursementData(companyIds, startDate, endDate);
        break;
      case 'customers':
        data = await getCustomerData(companyIds);
        break;
      case 'loans':
        data = await getLoanData(companyIds, startDate, endDate);
        break;
      case 'transactions':
        data = await getTransactionData(companyIds, startDate, endDate);
        break;
      case 'bank-reconciliation':
        data = await getBankReconciliationData(companyIds, startDate, endDate);
        break;
      case 'trial-balance':
        data = await getTrialBalanceData(companyIds);
        break;
      case 'profit-loss':
        data = await getProfitLossData(companyIds, startDate, endDate);
        break;
      case 'full':
      default:
        data = await getFullReportData(companyIds, startDate, endDate);
        break;
    }

    // Format as CSV if requested
    if (format_type === 'csv') {
      const csv = convertToCSV(data);
      const filename = `${reportType}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      
      // Cache the result
      cache.set(cacheKey, { csv, filename, ...data }, CacheTTL.SHORT);
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // Cache the result
    cache.set(cacheKey, data, CacheTTL.SHORT);

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

// COMPREHENSIVE CUSTOMER-WISE LOAN DETAILS WITH ALL EMI DATES
async function getCustomerLoanDetails(companyIds: string[], startDate?: string | null, endDate?: string | null) {
  const whereClause: any = {};
  if (companyIds.length > 0) {
    whereClause.companyId = { in: companyIds };
  }

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  // Fetch all online loans with complete EMI schedules
  const onlineLoans = await db.loanApplication.findMany({
    where: {
      ...whereClause,
      status: { in: ['ACTIVE', 'DISBURSED', 'CLOSED'] }
    },
    include: {
      customer: true,
      company: true,
      sessionForm: true,
      emiSchedules: {
        orderBy: { installmentNumber: 'asc' }
      },
      payments: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch all offline loans with complete EMI schedules
  const offlineLoans = await db.offlineLoan.findMany({
    where: {
      status: { in: ['ACTIVE', 'CLOSED'] }
    },
    include: {
      customer: true,
      company: true,
      emis: {
        orderBy: { installmentNumber: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const records: any[] = [];

  // Process online loans - ONE ROW PER CUSTOMER with loan summary
  for (const loan of onlineLoans) {
    const customer = loan.customer;
    const emiSchedules = loan.emiSchedules || [];
    const payments = loan.payments || [];
    
    // Create EMI dates string
    const emiDates = emiSchedules.map((emi, idx) => 
      `EMI ${idx + 1}: ${format(new Date(emi.dueDate), 'dd/MM/yyyy')} (${emi.paymentStatus})`
    ).join('; ');
    
    // Create paid EMI dates
    const paidEmiDates = emiSchedules
      .filter(e => e.paymentStatus === 'PAID')
      .map((emi, idx) => 
        `EMI ${emi.installmentNumber}: Paid on ${emi.paidDate ? format(new Date(emi.paidDate), 'dd/MM/yyyy') : 'N/A'} - ₹${emi.paidAmount?.toLocaleString() || 0}`
      ).join('; ');
    
    // Calculate totals
    const totalEMIAmount = emiSchedules.reduce((sum, e) => sum + e.totalAmount, 0);
    const totalPaid = emiSchedules.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    const totalPrincipalPaid = emiSchedules.reduce((sum, e) => sum + (e.paidPrincipal || 0), 0);
    const totalInterestPaid = emiSchedules.reduce((sum, e) => sum + (e.paidInterest || 0), 0);
    const pendingAmount = totalEMIAmount - totalPaid;
    const emisPaid = emiSchedules.filter(e => e.paymentStatus === 'PAID').length;
    const emisPending = emiSchedules.filter(e => ['PENDING', 'OVERDUE'].includes(e.paymentStatus)).length;
    const emisOverdue = emiSchedules.filter(e => e.paymentStatus === 'OVERDUE').length;

    records.push({
      'Loan Type': 'ONLINE',
      'Loan ID': loan.applicationNo,
      'Loan Status': loan.status,
      'Disbursement Date': loan.disbursedAt ? format(new Date(loan.disbursedAt), 'dd/MM/yyyy') : 'N/A',
      
      // Customer Details
      'Customer ID': customer?.id || 'N/A',
      'Customer Name': customer?.name || loan.firstName + ' ' + loan.lastName,
      'Customer Phone': customer?.phone || loan.phone || 'N/A',
      'Customer Email': customer?.email || loan.email || 'N/A',
      'Customer PAN': loan.panNumber || customer?.panNumber || 'N/A',
      'Customer Aadhaar': loan.aadhaarNumber ? `XXXX-XXXX-${loan.aadhaarNumber.slice(-4)}` : 'N/A',
      'Customer Address': customer?.address || loan.address || 'N/A',
      'Customer City': customer?.city || 'N/A',
      'Customer State': customer?.state || 'N/A',
      'Customer Pincode': customer?.pincode || loan.pincode || 'N/A',
      'Employment Type': customer?.employmentType || 'N/A',
      'Monthly Income': customer?.monthlyIncome || 0,
      
      // Company Details
      'Company ID': loan.companyId,
      'Company Name': loan.company?.name || 'N/A',
      'Company Code': loan.company?.code || 'N/A',
      
      // Loan Amount Details
      'Requested Amount': loan.requestedAmount,
      'Approved Amount': loan.sessionForm?.approvedAmount || loan.requestedAmount,
      'Disbursed Amount': loan.disbursedAmount || loan.sessionForm?.approvedAmount || loan.requestedAmount,
      'Interest Rate (%)': loan.sessionForm?.interestRate || 0,
      'Tenure (Months)': loan.sessionForm?.tenure || 0,
      'EMI Amount': loan.sessionForm?.emiAmount || 0,
      'Processing Fee': loan.sessionForm?.processingFee || 0,
      'Total Interest': loan.sessionForm?.totalInterest || 0,
      'Total Repayment': loan.sessionForm?.totalAmount || 0,
      
      // EMI Summary
      'Total EMIs': emiSchedules.length,
      'EMIs Paid': emisPaid,
      'EMIs Pending': emisPending,
      'EMIs Overdue': emisOverdue,
      'Total EMI Amount': totalEMIAmount,
      'Total Paid': totalPaid,
      'Principal Paid': totalPrincipalPaid,
      'Interest Paid': totalInterestPaid,
      'Outstanding Balance': pendingAmount,
      
      // EMI Schedule Dates
      'EMI Due Dates': emiDates,
      'Paid EMI Details': paidEmiDates || 'None',
      
      // Next EMI
      'Next EMI Due Date': emiSchedules.find(e => ['PENDING', 'OVERDUE'].includes(e.paymentStatus))?.dueDate 
        ? format(new Date(emiSchedules.find(e => ['PENDING', 'OVERDUE'].includes(e.paymentStatus))!.dueDate), 'dd/MM/yyyy')
        : 'All Paid',
      'Next EMI Amount': emiSchedules.find(e => ['PENDING', 'OVERDUE'].includes(e.paymentStatus))?.totalAmount || 0,
      
      // Dates
      'Application Date': format(new Date(loan.createdAt), 'dd/MM/yyyy'),
      'Last Updated': format(new Date(loan.updatedAt), 'dd/MM/yyyy'),
      
      // Purpose
      'Loan Purpose': loan.purpose || 'N/A',
      'Notes': loan.notes || 'N/A'
    });
  }

  // Process offline loans
  for (const loan of offlineLoans) {
    const customer = loan.customer;
    const emis = loan.emis || [];
    
    // Create EMI dates string
    const emiDates = emis.map((emi, idx) => 
      `EMI ${idx + 1}: ${format(new Date(emi.dueDate), 'dd/MM/yyyy')} (${emi.paymentStatus})`
    ).join('; ');
    
    // Create paid EMI dates
    const paidEmiDates = emis
      .filter(e => e.paymentStatus === 'PAID')
      .map((emi) => 
        `EMI ${emi.installmentNumber}: Paid on ${emi.paidDate ? format(new Date(emi.paidDate), 'dd/MM/yyyy') : 'N/A'} - ₹${emi.paidAmount?.toLocaleString() || 0}`
      ).join('; ');
    
    // Calculate totals
    const totalEMIAmount = emis.reduce((sum, e) => sum + e.totalAmount, 0);
    const totalPaid = emis.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    const totalPrincipalPaid = emis.reduce((sum, e) => sum + (e.paidPrincipal || 0), 0);
    const totalInterestPaid = emis.reduce((sum, e) => sum + (e.paidInterest || 0), 0);
    const pendingAmount = totalEMIAmount - totalPaid;
    const emisPaid = emis.filter(e => e.paymentStatus === 'PAID').length;
    const emisPending = emis.filter(e => ['PENDING', 'OVERDUE'].includes(e.paymentStatus)).length;
    const emisOverdue = emis.filter(e => e.paymentStatus === 'OVERDUE').length;

    records.push({
      'Loan Type': 'OFFLINE',
      'Loan ID': loan.loanNumber,
      'Loan Status': loan.status,
      'Disbursement Date': loan.disbursementDate ? format(new Date(loan.disbursementDate), 'dd/MM/yyyy') : 'N/A',
      
      // Customer Details
      'Customer ID': customer?.id || loan.customerId || 'N/A',
      'Customer Name': customer?.name || loan.customerName || 'N/A',
      'Customer Phone': customer?.phone || loan.customerPhone || 'N/A',
      'Customer Email': customer?.email || loan.customerEmail || 'N/A',
      'Customer PAN': 'N/A',
      'Customer Aadhaar': 'N/A',
      'Customer Address': loan.customerAddress || 'N/A',
      'Customer City': 'N/A',
      'Customer State': 'N/A',
      'Customer Pincode': 'N/A',
      'Employment Type': 'N/A',
      'Monthly Income': 0,
      
      // Company Details
      'Company ID': loan.companyId,
      'Company Name': loan.company?.name || 'N/A',
      'Company Code': loan.company?.code || 'N/A',
      
      // Loan Amount Details
      'Requested Amount': loan.loanAmount,
      'Approved Amount': loan.loanAmount,
      'Disbursed Amount': loan.loanAmount,
      'Interest Rate (%)': loan.interestRate || 0,
      'Tenure (Months)': loan.tenure || 0,
      'EMI Amount': loan.emiAmount || 0,
      'Processing Fee': loan.processingFee || 0,
      'Total Interest': emis.reduce((sum, e) => sum + e.interestAmount, 0),
      'Total Repayment': totalEMIAmount,
      
      // EMI Summary
      'Total EMIs': emis.length,
      'EMIs Paid': emisPaid,
      'EMIs Pending': emisPending,
      'EMIs Overdue': emisOverdue,
      'Total EMI Amount': totalEMIAmount,
      'Total Paid': totalPaid,
      'Principal Paid': totalPrincipalPaid,
      'Interest Paid': totalInterestPaid,
      'Outstanding Balance': pendingAmount,
      
      // EMI Schedule Dates
      'EMI Due Dates': emiDates,
      'Paid EMI Details': paidEmiDates || 'None',
      
      // Next EMI
      'Next EMI Due Date': emis.find(e => ['PENDING', 'OVERDUE'].includes(e.paymentStatus))?.dueDate 
        ? format(new Date(emis.find(e => ['PENDING', 'OVERDUE'].includes(e.paymentStatus))!.dueDate), 'dd/MM/yyyy')
        : 'All Paid',
      'Next EMI Amount': emis.find(e => ['PENDING', 'OVERDUE'].includes(e.paymentStatus))?.totalAmount || 0,
      
      // Dates
      'Application Date': format(new Date(loan.createdAt), 'dd/MM/yyyy'),
      'Last Updated': format(new Date(loan.updatedAt), 'dd/MM/yyyy'),
      
      // Purpose
      'Loan Purpose': loan.loanType || 'N/A',
      'Notes': loan.notes || 'N/A'
    });
  }

  return {
    title: 'Customer-Wise Loan Details with EMI Schedule',
    records,
    summary: {
      totalLoans: records.length,
      onlineLoans: records.filter(r => r['Loan Type'] === 'ONLINE').length,
      offlineLoans: records.filter(r => r['Loan Type'] === 'OFFLINE').length,
      totalDisbursed: records.reduce((sum, r) => sum + (r['Disbursed Amount'] || 0), 0),
      totalOutstanding: records.reduce((sum, r) => sum + (r['Outstanding Balance'] || 0), 0),
      byCompany: records.reduce((acc, r) => {
        const company = r['Company Name'];
        if (!acc[company]) acc[company] = { count: 0, outstanding: 0 };
        acc[company].count++;
        acc[company].outstanding += r['Outstanding Balance'] || 0;
        return acc;
      }, {} as Record<string, { count: number; outstanding: number }>)
    }
  };
}

// EMI Collection Data
async function getEMICollectionData(companyIds: string[], startDate?: string | null, endDate?: string | null) {
  const whereClause: any = {};
  
  if (companyIds.length > 0) {
    whereClause.companyId = { in: companyIds };
  }

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  // Fetch all active loans
  const loans = await db.loanApplication.findMany({
    where: {
      ...whereClause,
      status: { in: ['ACTIVE', 'DISBURSED'] }
    },
    include: {
      customer: true,
      emiSchedules: {
        where: Object.keys(dateFilter).length > 0 ? { paidDate: dateFilter } : { paymentStatus: 'PAID' },
        orderBy: { dueDate: 'asc' }
      },
      company: true,
      sessionForm: true
    }
  });

  // Fetch all offline loans
  const offlineLoans = await db.offlineLoan.findMany({
    where: {
      status: 'ACTIVE'
    },
    include: {
      customer: true,
      emis: {
        where: Object.keys(dateFilter).length > 0 ? { paidDate: dateFilter } : { paymentStatus: 'PAID' },
        orderBy: { dueDate: 'asc' }
      },
      company: true
    }
  });

  const emiRecords: any[] = [];

  // Process online loans
  for (const loan of loans) {
    for (const emi of loan.emiSchedules) {
      emiRecords.push({
        'Loan Type': 'ONLINE',
        'Loan ID': loan.applicationNo,
        'Customer ID': loan.customerId,
        'Customer Name': loan.customer?.name || 'N/A',
        'Customer Phone': loan.customer?.phone || 'N/A',
        'Customer Email': loan.customer?.email || 'N/A',
        'Company': loan.company?.name || 'N/A',
        'EMI Number': emi.installmentNumber,
        'Due Date': format(new Date(emi.dueDate), 'dd/MM/yyyy'),
        'Paid Date': emi.paidDate ? format(new Date(emi.paidDate), 'dd/MM/yyyy') : 'Pending',
        'EMI Amount': emi.totalAmount,
        'Principal': emi.principalAmount,
        'Interest': emi.interestAmount,
        'Paid Amount': emi.paidAmount || 0,
        'Principal Paid': emi.paidPrincipal || 0,
        'Interest Paid': emi.paidInterest || 0,
        'Payment Mode': emi.paymentMode || 'N/A',
        'UTR/Reference': emi.utrNumber || 'N/A',
        'Status': emi.paymentStatus,
        'Days Overdue': emi.daysOverdue || 0,
        'Late Fee': emi.penaltyAmount || 0,
        'Disbursed Amount': loan.sessionForm?.approvedAmount || loan.requestedAmount,
        'Interest Rate': loan.sessionForm?.interestRate || 'N/A',
        'Tenure': loan.sessionForm?.tenure || 'N/A'
      });
    }
  }

  // Process offline loans
  for (const loan of offlineLoans) {
    for (const emi of loan.emis) {
      emiRecords.push({
        'Loan Type': 'OFFLINE',
        'Loan ID': loan.loanNumber,
        'Customer ID': loan.customerId || 'N/A',
        'Customer Name': loan.customer?.name || 'N/A',
        'Customer Phone': loan.customer?.phone || 'N/A',
        'Customer Email': loan.customer?.email || 'N/A',
        'Company': loan.company?.name || 'N/A',
        'EMI Number': emi.installmentNumber,
        'Due Date': format(new Date(emi.dueDate), 'dd/MM/yyyy'),
        'Paid Date': emi.paidDate ? format(new Date(emi.paidDate), 'dd/MM/yyyy') : 'Pending',
        'EMI Amount': emi.totalAmount,
        'Principal': emi.principalAmount,
        'Interest': emi.interestAmount,
        'Paid Amount': emi.paidAmount || 0,
        'Principal Paid': emi.paidPrincipal || 0,
        'Interest Paid': emi.paidInterest || 0,
        'Payment Mode': emi.paymentMode || 'N/A',
        'UTR/Reference': emi.paymentReference || 'N/A',
        'Status': emi.paymentStatus,
        'Days Overdue': 0,
        'Late Fee': 0,
        'Disbursed Amount': loan.loanAmount,
        'Interest Rate': loan.interestRate,
        'Tenure': loan.tenure
      });
    }
  }

  return {
    title: 'EMI Collection Report',
    records: emiRecords,
    summary: {
      totalEMIs: emiRecords.length,
      totalAmount: emiRecords.reduce((sum, r) => sum + (r['EMI Amount'] || 0), 0),
      totalCollected: emiRecords.reduce((sum, r) => sum + (r['Paid Amount'] || 0), 0),
      pendingAmount: emiRecords.reduce((sum, r) => sum + ((r['EMI Amount'] || 0) - (r['Paid Amount'] || 0)), 0)
    }
  };
}

// Disbursement Data
async function getDisbursementData(companyIds: string[], startDate?: string | null, endDate?: string | null) {
  const whereClause: any = {
    status: { in: ['ACTIVE', 'DISBURSED'] }
  };
  
  if (companyIds.length > 0) {
    whereClause.companyId = { in: companyIds };
  }

  if (startDate || endDate) {
    whereClause.disbursedAt = {};
    if (startDate) whereClause.disbursedAt.gte = new Date(startDate);
    if (endDate) whereClause.disbursedAt.lte = new Date(endDate);
  }

  const loans = await db.loanApplication.findMany({
    where: whereClause,
    include: {
      customer: true,
      company: true,
      sessionForm: true
    },
    orderBy: { disbursedAt: 'desc' }
  });

  const offlineLoans = await db.offlineLoan.findMany({
    where: {
      status: 'ACTIVE'
    },
    include: {
      customer: true,
      company: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const records: any[] = [];

  // Process online loans
  for (const loan of loans) {
    records.push({
      'Loan Type': 'ONLINE',
      'Loan ID': loan.applicationNo,
      'Customer ID': loan.customerId,
      'Customer Name': loan.customer?.name || 'N/A',
      'Customer Phone': loan.customer?.phone || 'N/A',
      'Customer Email': loan.customer?.email || 'N/A',
      'Customer PAN': loan.panNumber || 'N/A',
      'Customer Aadhaar': loan.aadhaarNumber ? `XXXX-XXXX-${loan.aadhaarNumber.slice(-4)}` : 'N/A',
      'Company': loan.company?.name || 'N/A',
      'Disbursement Date': loan.disbursedAt ? format(new Date(loan.disbursedAt), 'dd/MM/yyyy') : 'N/A',
      'Disbursed Amount': loan.disbursedAmount || loan.sessionForm?.approvedAmount || loan.requestedAmount,
      'Interest Rate': loan.sessionForm?.interestRate || 'N/A',
      'Tenure (Months)': loan.sessionForm?.tenure || 'N/A',
      'EMI Amount': loan.sessionForm?.emiAmount || 'N/A',
      'Processing Fee': loan.sessionForm?.processingFee || 0,
      'Disbursement Mode': loan.disbursementMode || 'N/A',
      'Disbursement Reference': loan.disbursementRef || 'N/A',
      'Bank Account': loan.bankAccountNumber ? `XXXX${loan.bankAccountNumber.slice(-4)}` : 'N/A',
      'Bank Name': loan.bankName || 'N/A',
      'IFSC Code': loan.bankIfsc || 'N/A',
      'Purpose': loan.purpose || 'N/A'
    });
  }

  // Process offline loans
  for (const loan of offlineLoans) {
    records.push({
      'Loan Type': 'OFFLINE',
      'Loan ID': loan.loanNumber,
      'Customer ID': loan.customerId || 'N/A',
      'Customer Name': loan.customer?.name || 'N/A',
      'Customer Phone': loan.customer?.phone || 'N/A',
      'Customer Email': loan.customer?.email || 'N/A',
      'Customer PAN': 'N/A',
      'Customer Aadhaar': 'N/A',
      'Company': loan.company?.name || 'N/A',
      'Disbursement Date': format(new Date(loan.createdAt), 'dd/MM/yyyy'),
      'Disbursed Amount': loan.loanAmount,
      'Interest Rate': loan.interestRate,
      'Tenure (Months)': loan.tenure,
      'EMI Amount': loan.emiAmount || 'N/A',
      'Processing Fee': loan.processingFee || 0,
      'Disbursement Mode': 'OFFLINE',
      'Disbursement Reference': 'N/A',
      'Bank Account': 'N/A',
      'Bank Name': 'N/A',
      'IFSC Code': 'N/A',
      'Purpose': loan.notes || 'N/A'
    });
  }

  return {
    title: 'Loan Disbursement Report',
    records,
    summary: {
      totalLoans: records.length,
      totalDisbursed: records.reduce((sum, r) => sum + (r['Disbursed Amount'] || 0), 0),
      totalProcessingFees: records.reduce((sum, r) => sum + (r['Processing Fee'] || 0), 0),
      byCompany: records.reduce((acc, r) => {
        const company = r['Company'];
        if (!acc[company]) acc[company] = { count: 0, amount: 0 };
        acc[company].count++;
        acc[company].amount += r['Disbursed Amount'] || 0;
        return acc;
      }, {} as Record<string, { count: number; amount: number }>)
    }
  };
}

// Customer Data
async function getCustomerData(companyIds: string[]) {
  const whereClause: any = { role: 'CUSTOMER' };
  
  const customers = await db.user.findMany({
    where: whereClause,
    include: {
      loanApplications: {
        where: companyIds.length > 0 ? { companyId: { in: companyIds } } : {},
        include: { company: true, sessionForm: true }
      }
    }
  });

  const records: any[] = [];

  for (const customer of customers) {
    const loans = customer.loanApplications;
    const activeLoans = loans.filter(l => ['ACTIVE', 'DISBURSED'].includes(l.status));
    
    records.push({
      'Customer ID': customer.id,
      'Customer Name': customer.name || 'N/A',
      'Email': customer.email,
      'Phone': customer.phone || 'N/A',
      'PAN Number': customer.panNumber || 'N/A',
      'Aadhaar Number': customer.aadhaarNumber ? `XXXX-XXXX-${customer.aadhaarNumber.slice(-4)}` : 'N/A',
      'Date of Birth': customer.dateOfBirth ? format(new Date(customer.dateOfBirth), 'dd/MM/yyyy') : 'N/A',
      'Address': customer.address || 'N/A',
      'City': customer.city || 'N/A',
      'State': customer.state || 'N/A',
      'Pincode': customer.pincode || 'N/A',
      'Employment Type': customer.employmentType || 'N/A',
      'Monthly Income': customer.monthlyIncome || 0,
      'Total Loans': loans.length,
      'Active Loans': activeLoans.length,
      'Total Borrowed': loans.reduce((sum, l) => sum + (l.sessionForm?.approvedAmount || l.requestedAmount), 0),
      'Outstanding Balance': activeLoans.reduce((sum, l) => sum + (l.sessionForm?.approvedAmount || l.requestedAmount), 0),
      'Account Created': format(new Date(customer.createdAt), 'dd/MM/yyyy'),
      'Status': customer.isActive ? 'Active' : 'Inactive'
    });
  }

  return {
    title: 'Customer Report',
    records,
    summary: {
      totalCustomers: records.length,
      activeCustomers: records.filter(r => r['Status'] === 'Active').length,
      totalOutstanding: records.reduce((sum, r) => sum + (r['Outstanding Balance'] || 0), 0)
    }
  };
}

// Full Report Data
async function getFullReportData(companyIds: string[], startDate?: string | null, endDate?: string | null) {
  const [emi, disbursements, customers, transactions] = await Promise.all([
    getEMICollectionData(companyIds, startDate, endDate),
    getDisbursementData(companyIds, startDate, endDate),
    getCustomerData(companyIds),
    getTransactionData(companyIds, startDate, endDate)
  ]);

  return {
    title: 'Comprehensive Financial Report',
    generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm:ss'),
    emiCollection: emi,
    disbursements,
    customers,
    transactions
  };
}

// Transaction Data (Bank transactions)
async function getTransactionData(companyIds: string[], startDate?: string | null, endDate?: string | null) {
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const bankAccounts = await db.bankAccount.findMany({
    where: companyIds.length > 0 ? { companyId: { in: companyIds } } : {},
    include: {
      transactions: {
        where: Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {},
        orderBy: { transactionDate: 'desc' },
        take: 500
      },
      company: true
    }
  });

  const records: any[] = [];

  for (const account of bankAccounts) {
    for (const txn of account.transactions) {
      records.push({
        'Transaction ID': txn.id,
        'Date': format(new Date(txn.transactionDate), 'dd/MM/yyyy'),
        'Time': format(new Date(txn.transactionDate), 'HH:mm:ss'),
        'Company': account.company?.name || 'N/A',
        'Bank Name': account.bankName,
        'Account Number': account.accountNumber,
        'Transaction Type': txn.transactionType,
        'Amount': txn.amount,
        'Balance After': txn.balanceAfter,
        'Description': txn.description,
        'Reference Type': txn.referenceType,
        'Reference ID': txn.referenceId || 'N/A',
        'Created At': format(new Date(txn.createdAt), 'dd/MM/yyyy HH:mm:ss')
      });
    }
  }

  return {
    title: 'Bank Transaction Report',
    records,
    summary: {
      totalTransactions: records.length,
      totalCredits: records.filter(r => r['Transaction Type'] === 'CREDIT').reduce((sum, r) => sum + (r['Amount'] || 0), 0),
      totalDebits: records.filter(r => r['Transaction Type'] === 'DEBIT').reduce((sum, r) => sum + (r['Amount'] || 0), 0)
    }
  };
}

// Trial Balance Data
async function getTrialBalanceData(companyIds: string[]) {
  const accounts = await db.chartOfAccount.findMany({
    where: companyIds.length > 0 ? { companyId: { in: companyIds } } : {},
    include: { 
      company: true,
      journalLines: true
    },
    orderBy: { accountCode: 'asc' }
  });

  const records = accounts.map(acc => {
    const totalDebit = acc.journalLines?.reduce((sum, line) => sum + (line.debitAmount || 0), 0) || 0;
    const totalCredit = acc.journalLines?.reduce((sum, line) => sum + (line.creditAmount || 0), 0) || 0;
    
    return {
      'Account Code': acc.accountCode,
      'Account Name': acc.accountName,
      'Account Type': acc.accountType,
      'Company': acc.company?.name || 'N/A',
      'Opening Balance': acc.openingBalance || 0,
      'Debit': totalDebit,
      'Credit': totalCredit,
      'Current Balance': acc.currentBalance,
      'Active': acc.isActive ? 'Yes' : 'No'
    };
  });

  return {
    title: 'Trial Balance',
    records,
    summary: {
      totalDebit: records.reduce((sum, r) => sum + (r['Debit'] || 0), 0),
      totalCredit: records.reduce((sum, r) => sum + (r['Credit'] || 0), 0),
      isBalanced: Math.abs(
        records.reduce((sum, r) => sum + (r['Debit'] || 0), 0) - 
        records.reduce((sum, r) => sum + (r['Credit'] || 0), 0)
      ) < 0.01
    }
  };
}

// Profit & Loss Data
async function getProfitLossData(companyIds: string[], startDate?: string | null, endDate?: string | null) {
  const journalEntries = await db.journalEntry.findMany({
    where: {
      ...(companyIds.length > 0 ? { companyId: { in: companyIds } } : {}),
      ...(startDate || endDate ? {
        entryDate: {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {})
        }
      } : {})
    },
    include: {
      lines: { include: { account: true } },
      company: true
    }
  });

  const incomeAccounts: Record<string, number> = {};
  const expenseAccounts: Record<string, number> = {};

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      if (line.account.accountType === 'INCOME') {
        const name = line.account.accountName;
        incomeAccounts[name] = (incomeAccounts[name] || 0) + line.creditAmount - line.debitAmount;
      } else if (line.account.accountType === 'EXPENSE') {
        const name = line.account.accountName;
        expenseAccounts[name] = (expenseAccounts[name] || 0) + line.debitAmount - line.creditAmount;
      }
    }
  }

  const records: any[] = [
    { 'Particulars': 'INCOME', 'Amount': '' },
    ...Object.entries(incomeAccounts).map(([name, amount]) => ({
      'Particulars': `  ${name}`,
      'Amount': amount > 0 ? amount : 0
    })),
    { 'Particulars': 'Total Income', 'Amount': Object.values(incomeAccounts).reduce((a, b) => a + (b > 0 ? b : 0), 0) },
    { 'Particulars': '', 'Amount': '' },
    { 'Particulars': 'EXPENSES', 'Amount': '' },
    ...Object.entries(expenseAccounts).map(([name, amount]) => ({
      'Particulars': `  ${name}`,
      'Amount': amount > 0 ? amount : 0
    })),
    { 'Particulars': 'Total Expenses', 'Amount': Object.values(expenseAccounts).reduce((a, b) => a + (b > 0 ? b : 0), 0) },
    { 'Particulars': '', 'Amount': '' },
    { 'Particulars': 'NET PROFIT/(LOSS)', 'Amount': '' }
  ];

  const totalIncome = Object.values(incomeAccounts).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const totalExpenses = Object.values(expenseAccounts).reduce((a, b) => a + (b > 0 ? b : 0), 0);

  return {
    title: 'Profit & Loss Statement',
    records,
    summary: {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses
    }
  };
}

// Bank Reconciliation Data
async function getBankReconciliationData(companyIds: string[], startDate?: string | null, endDate?: string | null) {
  const bankAccounts = await db.bankAccount.findMany({
    where: companyIds.length > 0 ? { companyId: { in: companyIds } } : {},
    include: {
      company: true,
      transactions: {
        where: startDate || endDate ? {
          transactionDate: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {})
          }
        } : {},
        orderBy: { transactionDate: 'desc' }
      }
    }
  });

  const records: any[] = [];

  for (const account of bankAccounts) {
    const transactions = account.transactions || [];
    const totalCredits = transactions.filter(t => t.transactionType === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = transactions.filter(t => t.transactionType === 'DEBIT').reduce((sum, t) => sum + t.amount, 0);

    records.push({
      'Company': account.company?.name || 'N/A',
      'Bank Name': account.bankName,
      'Account Number': account.accountNumber,
      'Account Name': account.accountName,
      'IFSC Code': account.ifscCode || 'N/A',
      'Branch': account.branchName || 'N/A',
      'Account Type': account.accountType,
      'Opening Balance': account.openingBalance || 0,
      'Total Credits': totalCredits,
      'Total Debits': totalDebits,
      'Closing Balance': account.currentBalance,
      'Calculated Balance': (account.openingBalance || 0) + totalCredits - totalDebits,
      'Difference': account.currentBalance - ((account.openingBalance || 0) + totalCredits - totalDebits),
      'Is Default': account.isDefault ? 'Yes' : 'No',
      'Status': 'Reconciled'
    });
  }

  return {
    title: 'Bank Reconciliation Report',
    records,
    summary: {
      totalAccounts: records.length,
      totalBalance: records.reduce((sum, r) => sum + (r['Closing Balance'] || 0), 0),
      discrepancyAccounts: records.filter(r => r['Difference'] !== 0).length
    }
  };
}

// Get Loan Data
async function getLoanData(companyIds: string[], startDate?: string | null, endDate?: string | null) {
  const whereClause: any = {};
  if (companyIds.length > 0) {
    whereClause.companyId = { in: companyIds };
  }
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = new Date(startDate);
    if (endDate) whereClause.createdAt.lte = new Date(endDate);
  }

  const loans = await db.loanApplication.findMany({
    where: whereClause,
    include: {
      customer: true,
      company: true,
      sessionForm: true,
      emiSchedules: { orderBy: { installmentNumber: 'asc' } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const records = loans.map(loan => ({
    'Loan ID': loan.applicationNo,
    'Customer ID': loan.customerId,
    'Customer Name': loan.customer?.name || 'N/A',
    'Customer Phone': loan.customer?.phone || 'N/A',
    'Customer Email': loan.customer?.email || 'N/A',
    'Company': loan.company?.name || 'N/A',
    'Loan Type': loan.loanType,
    'Status': loan.status,
    'Requested Amount': loan.requestedAmount,
    'Approved Amount': loan.sessionForm?.approvedAmount || loan.requestedAmount,
    'Interest Rate': loan.sessionForm?.interestRate || 'N/A',
    'Tenure': loan.sessionForm?.tenure || 'N/A',
    'EMI Amount': loan.sessionForm?.emiAmount || 'N/A',
    'Total Interest': loan.sessionForm?.totalInterest || 0,
    'Total Amount': loan.sessionForm?.totalAmount || 0,
    'Disbursed Amount': loan.disbursedAmount || 0,
    'Disbursement Date': loan.disbursedAt ? format(new Date(loan.disbursedAt), 'dd/MM/yyyy') : 'N/A',
    'Disbursement Mode': loan.disbursementMode || 'N/A',
    'EMIs Paid': loan.emiSchedules?.filter(e => e.paymentStatus === 'PAID').length || 0,
    'EMIs Pending': loan.emiSchedules?.filter(e => e.paymentStatus !== 'PAID').length || 0,
    'Outstanding Principal': loan.emiSchedules?.filter(e => e.paymentStatus !== 'PAID').reduce((sum, e) => sum + e.principalAmount, 0) || 0,
    'Created Date': format(new Date(loan.createdAt), 'dd/MM/yyyy'),
    'Purpose': loan.purpose || 'N/A'
  }));

  return {
    title: 'Loan Report',
    records,
    summary: {
      totalLoans: records.length,
      totalDisbursed: records.reduce((sum, r) => sum + (r['Disbursed Amount'] || 0), 0),
      totalOutstanding: records.reduce((sum, r) => sum + (r['Outstanding Principal'] || 0), 0),
      byStatus: records.reduce((acc, r) => {
        acc[r['Status']] = (acc[r['Status']] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    }
  };
}

// Convert to CSV
function convertToCSV(data: any): string {
  if (!data.records || data.records.length === 0) {
    return 'No data available';
  }

  const headers = Object.keys(data.records[0]);
  let csv = headers.join(',') + '\n';

  for (const record of data.records) {
    const values = headers.map(header => {
      const value = record[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += values.join(',') + '\n';
  }

  // Add summary if available
  if (data.summary) {
    csv += '\n\nSUMMARY\n';
    for (const [key, value] of Object.entries(data.summary)) {
      if (typeof value === 'object' && value !== null) {
        csv += `${key}:\n`;
        for (const [k, v] of Object.entries(value)) {
          csv += `  ${k}: ${JSON.stringify(v)}\n`;
        }
      } else {
        csv += `${key}: ${value}\n`;
      }
    }
  }

  return csv;
}
