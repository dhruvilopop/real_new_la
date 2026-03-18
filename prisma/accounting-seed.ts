import { PrismaClient, AccountType } from '@prisma/client';

const prisma = new PrismaClient();

// Predefined Chart of Accounts following double-entry accounting principles
const chartOfAccounts = [
  // ==================== ASSETS ====================
  {
    accountCode: '1000',
    accountName: 'ASSETS',
    accountType: AccountType.ASSET,
    description: 'Total Assets',
    isSystemAccount: true,
  },
  // Current Assets
  {
    accountCode: '1100',
    accountName: 'Current Assets',
    accountType: AccountType.ASSET,
    parentAccountCode: '1000',
    description: 'Assets that can be converted to cash within one year',
    isSystemAccount: true,
  },
  {
    accountCode: '1101',
    accountName: 'Loan Principal Outstanding',
    accountType: AccountType.ASSET,
    parentAccountCode: '1100',
    description: 'Total outstanding loan principal amount',
    isSystemAccount: true,
  },
  {
    accountCode: '1102',
    accountName: 'Interest Receivable',
    accountType: AccountType.ASSET,
    parentAccountCode: '1100',
    description: 'Interest amount receivable from customers',
    isSystemAccount: true,
  },
  {
    accountCode: '1103',
    accountName: 'Processing Fee Receivable',
    accountType: AccountType.ASSET,
    parentAccountCode: '1100',
    description: 'Processing fees yet to be collected',
    isSystemAccount: true,
  },
  {
    accountCode: '1104',
    accountName: 'Penalty Receivable',
    accountType: AccountType.ASSET,
    parentAccountCode: '1100',
    description: 'Penalty charges receivable from customers',
    isSystemAccount: true,
  },
  {
    accountCode: '1105',
    accountName: 'Other Receivables',
    accountType: AccountType.ASSET,
    parentAccountCode: '1100',
    description: 'Other amounts receivable',
    isSystemAccount: true,
  },
  {
    accountCode: '1106',
    accountName: 'Accrued Interest',
    accountType: AccountType.ASSET,
    parentAccountCode: '1100',
    description: 'Interest accrued but not yet received',
    isSystemAccount: true,
  },
  // Cash and Bank
  {
    accountCode: '1200',
    accountName: 'Cash and Bank',
    accountType: AccountType.ASSET,
    parentAccountCode: '1000',
    description: 'Cash and bank balances',
    isSystemAccount: true,
  },
  {
    accountCode: '1201',
    accountName: 'Bank Account',
    accountType: AccountType.ASSET,
    parentAccountCode: '1200',
    description: 'Main operating bank account',
    isSystemAccount: true,
  },
  {
    accountCode: '1202',
    accountName: 'Cash Account',
    accountType: AccountType.ASSET,
    parentAccountCode: '1200',
    description: 'Petty cash and cash in hand',
    isSystemAccount: true,
  },
  {
    accountCode: '1203',
    accountName: 'Bank Account - Operations',
    accountType: AccountType.ASSET,
    parentAccountCode: '1200',
    description: 'Operational bank account for disbursements',
    isSystemAccount: true,
  },
  // Fixed Assets
  {
    accountCode: '1300',
    accountName: 'Fixed Assets',
    accountType: AccountType.ASSET,
    parentAccountCode: '1000',
    description: 'Long-term tangible assets',
    isSystemAccount: true,
  },
  {
    accountCode: '1301',
    accountName: 'Office Equipment',
    accountType: AccountType.ASSET,
    parentAccountCode: '1300',
    description: 'Office furniture and equipment',
    isSystemAccount: false,
  },
  {
    accountCode: '1302',
    accountName: 'Computers & Software',
    accountType: AccountType.ASSET,
    parentAccountCode: '1300',
    description: 'Computer hardware and software',
    isSystemAccount: false,
  },

  // ==================== LIABILITIES ====================
  {
    accountCode: '2000',
    accountName: 'LIABILITIES',
    accountType: AccountType.LIABILITY,
    description: 'Total Liabilities',
    isSystemAccount: true,
  },
  {
    accountCode: '2100',
    accountName: 'Current Liabilities',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2000',
    description: 'Short-term liabilities due within one year',
    isSystemAccount: true,
  },
  {
    accountCode: '2101',
    accountName: 'GST Payable',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2100',
    description: 'GST collected and payable to government',
    isSystemAccount: true,
  },
  {
    accountCode: '2102',
    accountName: 'TDS Payable',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2100',
    description: 'TDS deducted and payable',
    isSystemAccount: true,
  },
  {
    accountCode: '2103',
    accountName: 'Payables',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2100',
    description: 'Amounts payable to vendors and service providers',
    isSystemAccount: true,
  },
  {
    accountCode: '2104',
    accountName: 'Agent Commission Payable',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2100',
    description: 'Commission payable to agents',
    isSystemAccount: true,
  },
  {
    accountCode: '2105',
    accountName: 'Staff Salary Payable',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2100',
    description: 'Salary payable to staff',
    isSystemAccount: true,
  },
  // Long-term Liabilities
  {
    accountCode: '2200',
    accountName: 'Long-term Liabilities',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2000',
    description: 'Long-term debts and obligations',
    isSystemAccount: true,
  },
  {
    accountCode: '2201',
    accountName: 'Investor Capital',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2200',
    description: 'Capital invested by investors',
    isSystemAccount: true,
  },
  {
    accountCode: '2202',
    accountName: 'Borrowed Funds',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2200',
    description: 'Funds borrowed from banks and financial institutions',
    isSystemAccount: true,
  },
  {
    accountCode: '2203',
    accountName: 'Term Loan',
    accountType: AccountType.LIABILITY,
    parentAccountCode: '2200',
    description: 'Long-term loans from banks',
    isSystemAccount: false,
  },

  // ==================== INCOME ====================
  {
    accountCode: '3000',
    accountName: 'INCOME',
    accountType: AccountType.INCOME,
    description: 'Total Income / Revenue',
    isSystemAccount: true,
  },
  // Interest Income
  {
    accountCode: '3100',
    accountName: 'Interest Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3000',
    description: 'Income from interest on loans',
    isSystemAccount: true,
  },
  {
    accountCode: '3101',
    accountName: 'Interest Income - Loans',
    accountType: AccountType.INCOME,
    parentAccountCode: '3100',
    description: 'Interest earned from loan disbursals',
    isSystemAccount: true,
  },
  {
    accountCode: '3102',
    accountName: 'Interest Income - Late Payment',
    accountType: AccountType.INCOME,
    parentAccountCode: '3100',
    description: 'Additional interest from late payments',
    isSystemAccount: true,
  },
  // Fee Income
  {
    accountCode: '3200',
    accountName: 'Fee Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3000',
    description: 'Income from various fees',
    isSystemAccount: true,
  },
  {
    accountCode: '3201',
    accountName: 'Processing Fee Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3200',
    description: 'Income from loan processing fees',
    isSystemAccount: true,
  },
  {
    accountCode: '3202',
    accountName: 'Late Fee Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3200',
    description: 'Income from late payment fees',
    isSystemAccount: true,
  },
  {
    accountCode: '3203',
    accountName: 'Bounce Charges Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3200',
    description: 'Income from cheque/ECS bounce charges',
    isSystemAccount: true,
  },
  {
    accountCode: '3204',
    accountName: 'Foreclosure Charges Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3200',
    description: 'Income from loan foreclosure charges',
    isSystemAccount: true,
  },
  {
    accountCode: '3205',
    accountName: 'Documentation Charges Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3200',
    description: 'Income from documentation charges',
    isSystemAccount: false,
  },
  // Other Income
  {
    accountCode: '3300',
    accountName: 'Other Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3000',
    description: 'Other sources of income',
    isSystemAccount: true,
  },
  {
    accountCode: '3301',
    accountName: 'Miscellaneous Income',
    accountType: AccountType.INCOME,
    parentAccountCode: '3300',
    description: 'Miscellaneous income sources',
    isSystemAccount: false,
  },

  // ==================== EXPENSES ====================
  {
    accountCode: '4000',
    accountName: 'EXPENSES',
    accountType: AccountType.EXPENSE,
    description: 'Total Expenses',
    isSystemAccount: true,
  },
  // Personnel Expenses
  {
    accountCode: '4100',
    accountName: 'Personnel Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4000',
    description: 'Expenses related to personnel',
    isSystemAccount: true,
  },
  {
    accountCode: '4101',
    accountName: 'Staff Salary',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4100',
    description: 'Salaries paid to staff',
    isSystemAccount: true,
  },
  {
    accountCode: '4102',
    accountName: 'Commission Paid - Agents',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4100',
    description: 'Commission paid to agents',
    isSystemAccount: true,
  },
  {
    accountCode: '4103',
    accountName: 'Staff Welfare',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4100',
    description: 'Staff welfare expenses',
    isSystemAccount: false,
  },
  {
    accountCode: '4104',
    accountName: 'Training Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4100',
    description: 'Staff training and development',
    isSystemAccount: false,
  },
  // Operational Expenses
  {
    accountCode: '4200',
    accountName: 'Operational Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4000',
    description: 'Day-to-day operational expenses',
    isSystemAccount: true,
  },
  {
    accountCode: '4201',
    accountName: 'Office Rent',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4200',
    description: 'Office rent and lease payments',
    isSystemAccount: true,
  },
  {
    accountCode: '4202',
    accountName: 'Utilities',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4200',
    description: 'Electricity, water, internet, etc.',
    isSystemAccount: false,
  },
  {
    accountCode: '4203',
    accountName: 'Office Supplies',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4200',
    description: 'Office supplies and stationery',
    isSystemAccount: false,
  },
  {
    accountCode: '4204',
    accountName: 'Communication Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4200',
    description: 'Telephone and communication costs',
    isSystemAccount: false,
  },
  // Marketing & Business Development
  {
    accountCode: '4300',
    accountName: 'Marketing Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4000',
    description: 'Marketing and promotional expenses',
    isSystemAccount: true,
  },
  {
    accountCode: '4301',
    accountName: 'Advertising',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4300',
    description: 'Advertising and promotional campaigns',
    isSystemAccount: false,
  },
  {
    accountCode: '4302',
    accountName: 'Business Development',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4300',
    description: 'Business development expenses',
    isSystemAccount: false,
  },
  // Technology Expenses
  {
    accountCode: '4400',
    accountName: 'Technology Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4000',
    description: 'Technology and software expenses',
    isSystemAccount: true,
  },
  {
    accountCode: '4401',
    accountName: 'Software & Hosting',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4400',
    description: 'Software licenses and hosting fees',
    isSystemAccount: true,
  },
  {
    accountCode: '4402',
    accountName: 'IT Maintenance',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4400',
    description: 'IT infrastructure maintenance',
    isSystemAccount: false,
  },
  // Financial Expenses
  {
    accountCode: '4500',
    accountName: 'Financial Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4000',
    description: 'Financial and banking expenses',
    isSystemAccount: true,
  },
  {
    accountCode: '4501',
    accountName: 'Bank Charges',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4500',
    description: 'Bank transaction charges',
    isSystemAccount: true,
  },
  {
    accountCode: '4502',
    accountName: 'Interest on Borrowed Funds',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4500',
    description: 'Interest paid on borrowed capital',
    isSystemAccount: true,
  },
  {
    accountCode: '4503',
    accountName: 'Payment Gateway Charges',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4500',
    description: 'Charges for payment gateway services',
    isSystemAccount: false,
  },
  // Administrative Expenses
  {
    accountCode: '4600',
    accountName: 'Administrative Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4000',
    description: 'General administrative expenses',
    isSystemAccount: true,
  },
  {
    accountCode: '4601',
    accountName: 'Legal & Professional Fees',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4600',
    description: 'Legal and professional consultancy',
    isSystemAccount: false,
  },
  {
    accountCode: '4602',
    accountName: 'Insurance',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4600',
    description: 'Insurance premiums',
    isSystemAccount: false,
  },
  {
    accountCode: '4603',
    accountName: 'Travel Expenses',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4600',
    description: 'Travel and conveyance',
    isSystemAccount: false,
  },
  {
    accountCode: '4604',
    accountName: 'Miscellaneous Expense',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4600',
    description: 'Miscellaneous expenses',
    isSystemAccount: true,
  },
  {
    accountCode: '4605',
    accountName: 'Depreciation',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4600',
    description: 'Depreciation on fixed assets',
    isSystemAccount: false,
  },
  // Provision for Bad Debts
  {
    accountCode: '4700',
    accountName: 'Provisions',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4000',
    description: 'Provisions and write-offs',
    isSystemAccount: true,
  },
  {
    accountCode: '4701',
    accountName: 'Provision for Bad Debts',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4700',
    description: 'Provision for non-performing assets',
    isSystemAccount: true,
  },
  {
    accountCode: '4702',
    accountName: 'Write-off - Bad Debts',
    accountType: AccountType.EXPENSE,
    parentAccountCode: '4700',
    description: 'Bad debts written off',
    isSystemAccount: true,
  },

  // ==================== EQUITY ====================
  {
    accountCode: '5000',
    accountName: 'EQUITY',
    accountType: AccountType.EQUITY,
    description: 'Owners Equity and Reserves',
    isSystemAccount: true,
  },
  {
    accountCode: '5100',
    accountName: 'Share Capital',
    accountType: AccountType.EQUITY,
    parentAccountCode: '5000',
    description: 'Share capital of the company',
    isSystemAccount: true,
  },
  {
    accountCode: '5200',
    accountName: 'Reserves & Surplus',
    accountType: AccountType.EQUITY,
    parentAccountCode: '5000',
    description: 'Accumulated reserves and surplus',
    isSystemAccount: true,
  },
  {
    accountCode: '5201',
    accountName: 'Retained Earnings',
    accountType: AccountType.EQUITY,
    parentAccountCode: '5200',
    description: 'Retained earnings from previous years',
    isSystemAccount: true,
  },
  {
    accountCode: '5202',
    accountName: 'Current Year Profit',
    accountType: AccountType.EQUITY,
    parentAccountCode: '5200',
    description: 'Profit for the current financial year',
    isSystemAccount: true,
  },
];

async function seedChartOfAccounts() {
  console.log('Starting Chart of Accounts seed...');

  // Create a map to store created accounts by code
  const accountMap: Record<string, string> = {};

  // First, create all accounts without parent relationships
  for (const account of chartOfAccounts) {
    const created = await prisma.chartOfAccount.create({
      data: {
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        description: account.description,
        isSystemAccount: account.isSystemAccount,
      },
    });
    accountMap[account.accountCode] = created.id;
    console.log(`Created account: ${account.accountCode} - ${account.accountName}`);
  }

  // Now update parent relationships
  for (const account of chartOfAccounts) {
    if (account.parentAccountCode) {
      await prisma.chartOfAccount.update({
        where: { id: accountMap[account.accountCode] },
        data: {
          parentAccountId: accountMap[account.parentAccountCode],
        },
      });
    }
  }

  console.log('Chart of Accounts seeded successfully!');
}

async function seedFinancialYear() {
  console.log('Creating Financial Year...');

  const currentYear = new Date().getFullYear();
  const startDate = new Date(currentYear, 3, 1); // April 1st
  const endDate = new Date(currentYear + 1, 2, 31); // March 31st

  await prisma.financialYear.create({
    data: {
      name: `FY ${currentYear}-${(currentYear + 1).toString().slice(2)}`,
      startDate,
      endDate,
      isClosed: false,
    },
  });

  console.log('Financial Year created successfully!');
}

async function seedDefaultBankAccount() {
  console.log('Creating default bank account...');

  await prisma.bankAccount.create({
    data: {
      bankName: 'State Bank of India',
      accountNumber: '1234567890123456',
      accountName: 'SMFC Finance Ltd',
      branchName: 'Main Branch',
      ifscCode: 'SBIN0001234',
      accountType: 'CURRENT',
      openingBalance: 10000000, // 1 Crore opening balance
      currentBalance: 10000000,
      isDefault: true,
      isActive: true,
    },
  });

  console.log('Default bank account created successfully!');
}

async function seedGSTConfig() {
  console.log('Creating GST Configuration...');

  await prisma.gSTConfig.createMany({
    data: [
      {
        gstRate: 18,
        gstType: 'CGST',
        applicableFrom: new Date(2017, 6, 1),
        isActive: true,
      },
      {
        gstRate: 18,
        gstType: 'SGST',
        applicableFrom: new Date(2017, 6, 1),
        isActive: true,
      },
      {
        gstRate: 18,
        gstType: 'IGST',
        applicableFrom: new Date(2017, 6, 1),
        isActive: true,
      },
    ],
  });

  console.log('GST Configuration created successfully!');
}

async function seedAccountantUser() {
  console.log('Creating Accountant User...');

  const existingAccountant = await prisma.user.findUnique({
    where: { email: 'accountant@smfc.com' },
  });

  if (!existingAccountant) {
    await prisma.user.create({
      data: {
        email: 'accountant@smfc.com',
        name: 'Chief Accountant',
        role: 'ACCOUNTANT',
        firebaseUid: 'accountant-firebase-uid',
        password: 'accountant123',
        plainPassword: 'accountant123',
        phone: '9876543217',
        isActive: true,
      },
    });
    console.log('Accountant user created: accountant@smfc.com / accountant123');
  } else {
    console.log('Accountant user already exists');
  }
}

async function main() {
  try {
    await seedChartOfAccounts();
    await seedFinancialYear();
    await seedDefaultBankAccount();
    await seedGSTConfig();
    await seedAccountantUser();
    console.log('\n✅ All accounting seed data created successfully!');
  } catch (error) {
    console.error('Error seeding accounting data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
