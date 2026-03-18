'use client';

import { useState, ReactNode, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import NotificationBell from '@/components/notification/NotificationBell';
import {
  Home, FileText, CheckCircle, Clock, Users, Wallet, Shield, Building2, BarChart3,
  Settings, LogOut, Menu, Search, Edit, Calculator, MapPin, AlertTriangle, PieChart,
  CreditCard, Banknote, User, ClipboardCheck, Calendar, Receipt, TrendingUp,
  Target, FileCheck, Activity, Briefcase, BookOpen, IndianRupee, Landmark, Percent,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';

interface MenuItem { id: string; label: string; icon: React.ElementType; count?: number; badge?: string; children?: MenuItem[]; }

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  menuItems?: MenuItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  stats?: { label: string; value: string | number; icon: React.ElementType; color: string; onClick?: () => void; clickable?: boolean }[];
  gradient?: string;
  logoIcon?: React.ElementType;
  headerRight?: ReactNode;
}

export default function DashboardLayout({
  children, 
  title = 'Dashboard', 
  subtitle, 
  menuItems = [], 
  activeTab = 'dashboard', 
  onTabChange, 
  stats, 
  gradient = 'bg-gradient-to-br from-emerald-500 to-teal-600', 
  logoIcon: LogoIcon = Landmark, 
  headerRight
}: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const userName = user?.name || 'User';
  const userRole = user?.role?.replace('_', ' ') || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const displayTitle = settings.companyName || title;
  const displayLogo = settings.companyLogo;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Dual Credit System State
  const hasFetchedRef = useRef(false);
  const [companyCredit, setCompanyCredit] = useState<number>(0);
  const [personalCredit, setPersonalCredit] = useState<number>(0);
  const [totalCompanyCredit, setTotalCompanyCredit] = useState<number>(0);
  const [totalPersonalCredit, setTotalPersonalCredit] = useState<number>(0);
  
  // Fetch credit on initial load only (no polling to prevent DB connection issues)
  useEffect(() => {
    const fetchUserCredit = async () => {
      try {
        // For ACCOUNTANT, fetch Super Admin's total credits
        if (user?.role === 'ACCOUNTANT') {
          // Get Super Admin's credits (total company credit)
          const superAdminRes = await fetch('/api/user?role=SUPER_ADMIN');
          if (superAdminRes.ok) {
            const superAdmins = await superAdminRes.json();
            if (superAdmins.users && superAdmins.users.length > 0) {
              let totalCompany = 0;
              let totalPersonal = 0;
              for (const admin of superAdmins.users) {
                totalCompany += admin.companyCredit || 0;
                totalPersonal += admin.personalCredit || 0;
              }
              setTotalCompanyCredit(totalCompany);
              setTotalPersonalCredit(totalPersonal);
            }
          }
        } else if (user?.id && user.role !== 'CUSTOMER') {
          // For all roles (including SUPER_ADMIN), fetch individual credits
          const res = await fetch(`/api/credit?userId=${user.id}&action=summary`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.summary) {
              setCompanyCredit(data.summary.companyCredit || 0);
              setPersonalCredit(data.summary.personalCredit || 0);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch credit:', error);
      }
    };
    
    // Only fetch on initial mount - no polling
    if (user?.id && user.role !== 'CUSTOMER') {
      fetchUserCredit();
    }
  }, [user?.id, user?.role]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-6 w-6" />
            </Button>
            {displayLogo ? (
              <motion.div className="h-10 w-auto max-w-[160px] flex items-center" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <img src={displayLogo} alt={displayTitle} className="max-h-full max-w-full object-contain" />
              </motion.div>
            ) : (
              <motion.div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center shadow-lg`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <LogoIcon className="w-6 h-6 text-white" />
              </motion.div>
            )}
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900">{displayTitle}</h1>
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Credit Display for ACCOUNTANT - Show TOTAL credits from Super Admin */}
            {user?.role === 'ACCOUNTANT' && (
              <>
                {/* Total Company Credit */}
                <motion.div 
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="p-1.5 bg-emerald-100 rounded-md">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Total Company Credit</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(totalCompanyCredit)}</p>
                  </div>
                </motion.div>
                
                {/* Total Personal Credit */}
                <motion.div 
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="p-1.5 bg-amber-100 rounded-md">
                    <User className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Total Personal Credit</p>
                    <p className="text-sm font-bold text-amber-700">{formatCurrency(totalPersonalCredit)}</p>
                  </div>
                </motion.div>
              </>
            )}
            
            {/* Credit Display for other roles (except CUSTOMER, SUPER_ADMIN, ACCOUNTANT) */}
            {user?.role !== 'CUSTOMER' && user?.role !== 'SUPER_ADMIN' && user?.role !== 'ACCOUNTANT' && (
              <>
                {/* Company Credit */}
                <motion.div 
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="p-1.5 bg-emerald-100 rounded-md">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Company Credit</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(companyCredit)}</p>
                  </div>
                </motion.div>
                
                {/* Personal Credit */}
                <motion.div 
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="p-1.5 bg-amber-100 rounded-md">
                    <User className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Personal Credit</p>
                    <p className="text-sm font-bold text-amber-700">{formatCurrency(personalCredit)}</p>
                  </div>
                </motion.div>
              </>
            )}
            
            {/* Dual Credit Display for SUPER_ADMIN */}
            {user?.role === 'SUPER_ADMIN' && (
              <>
                {/* Company Credit */}
                <motion.div 
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="p-1.5 bg-emerald-100 rounded-md">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Company Credit</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(companyCredit)}</p>
                  </div>
                </motion.div>
                
                {/* Personal Credit */}
                <motion.div 
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="p-1.5 bg-amber-100 rounded-md">
                    <User className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Personal Credit</p>
                    <p className="text-sm font-bold text-amber-700">{formatCurrency(personalCredit)}</p>
                  </div>
                </motion.div>
              </>
            )}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-10 w-64 bg-gray-50 border-gray-200" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <NotificationBell />
            <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{userName}</p>
                <p className="text-xs text-gray-500">{userRole}</p>
              </div>
              <Avatar className="h-9 w-9 border-2 border-white shadow">
                <AvatarFallback className={`${gradient} text-white font-semibold`}>{userInitial}</AvatarFallback>
              </Avatar>
            </div>
            {headerRight}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Mobile Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div variants={{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }} initial="initial" animate="animate" exit="exit"
                className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
              <motion.nav
                variants={{ initial: { x: -280 }, animate: { x: 0 }, exit: { x: -280 } }}
                initial="initial" animate="animate" exit="exit" transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl lg:hidden"
              >
                <SidebarContent menuItems={menuItems} activeTab={activeTab} onTabChange={(tab) => { onTabChange?.(tab); setSidebarOpen(false); }}
                  expandedMenu={expandedMenu} setExpandedMenu={setExpandedMenu} signOut={signOut} userName={userName} userRole={userRole}
                  userInitial={userInitial} gradient={gradient} onClose={() => setSidebarOpen(false)} companyName={settings.companyName} companyLogo={settings.companyLogo} />
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        <nav className="hidden lg:flex lg:flex-col lg:w-72 lg:bg-white lg:border-r lg:border-gray-200">
          <SidebarContent menuItems={menuItems} activeTab={activeTab} onTabChange={onTabChange || (() => {})}
            expandedMenu={expandedMenu} setExpandedMenu={setExpandedMenu} signOut={signOut} userName={userName} userRole={userRole}
            userInitial={userInitial} gradient={gradient} onClose={() => {}} companyName={settings.companyName} companyLogo={settings.companyLogo} />
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {stats && stats.length > 0 && activeTab === 'dashboard' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                const isClickable = stat.clickable !== false && stat.onClick;
                return (
                  <motion.div 
                    key={stat.label} 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: index * 0.05 }} 
                    whileHover={isClickable ? { y: -4, scale: 1.02, transition: { duration: 0.2 } } : undefined}
                    whileTap={isClickable ? { scale: 0.98 } : undefined}
                  >
                    <div 
                      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-full transition-all ${
                        isClickable ? 'cursor-pointer hover:shadow-md hover:border-emerald-200' : ''
                      }`}
                      onClick={stat.onClick}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        </div>
                        <div className={`p-2 rounded-lg ${stat.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                          <Icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ menuItems, activeTab, onTabChange, expandedMenu, setExpandedMenu, signOut, userName, userRole, userInitial, gradient, onClose, companyName, companyLogo }: {
  menuItems: MenuItem[]; activeTab: string; onTabChange: (tab: string) => void; expandedMenu: string | null; setExpandedMenu: (menu: string | null) => void;
  signOut: () => void; userName: string; userRole: string; userInitial: string; gradient: string; onClose: () => void; companyName?: string; companyLogo?: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {companyLogo ? <img src={companyLogo} alt={companyName || 'Logo'} className="h-8 w-auto max-w-[120px] object-contain" />
            : <div className={`w-8 h-8 rounded-lg ${gradient} flex items-center justify-center`}><Shield className="w-4 h-4 text-white" /></div> }
          <span className="font-semibold text-gray-900">{companyName || 'Menu'}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </Button>
      </div>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-white shadow">
            <AvatarFallback className={`${gradient} text-white font-semibold`}>{userInitial}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500 truncate">{userRole}</p>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenu === item.id;
            return (
              <div key={item.id}>
                <motion.button
                  onClick={() => { if (hasChildren) { setExpandedMenu(isExpanded ? null : item.id); } else { onTabChange(item.id); } }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all relative group ${isActive ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                  whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  <span className="flex-1 text-sm">{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <Badge className={`h-5 min-w-5 px-1.5 text-xs ${isActive ? 'bg-emerald-500' : 'bg-gray-200 text-gray-700'}`}>{item.count}</Badge>
                  )}
                </motion.button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-gray-100 space-y-2">
        {/* Settings only for SUPER_ADMIN */}
        {userRole === 'SUPER_ADMIN' && (
          <button onClick={() => onTabChange('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Settings className="h-5 w-5 text-gray-400" />Settings
          </button>
        )}
        <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-red-600 hover:bg-red-50 transition-all">
          <LogOut className="h-5 w-5" />Sign Out
        </button>
      </div>
    </div>
  );
}

// Menu configurations for each role
// Note: Settings button is rendered separately at the bottom of the sidebar
export const ROLE_MENU_ITEMS: Record<string, MenuItem[]> = {
  SUPER_ADMIN: [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'emi-collection', label: 'EMI Collection', icon: Wallet },
    { id: 'emi-calendar', label: 'EMI Calendar', icon: Calendar },
    { id: 'offline-loans', label: 'Offline Loans', icon: FileText },
    { id: 'interest-only', label: 'Interest Only Loans', icon: Percent },
    { id: 'pending', label: 'New Applications', icon: FileText },
    { id: 'final', label: 'Final Approvals', icon: CheckCircle },
    { id: 'progress', label: 'In Progress', icon: Clock },
    { id: 'activeLoans', label: 'Active Loans', icon: Wallet },
    { id: 'myCredit', label: 'My Credit', icon: IndianRupee },
    { id: 'creditManagement', label: 'Credit Management', icon: CreditCard },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'customers', label: 'Customers', icon: User },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'locationHistory', label: 'Location History', icon: MapPin },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'risk', label: 'Risk Management', icon: AlertTriangle },
    { id: 'products', label: 'Loan Products', icon: Briefcase },
    { id: 'audit', label: 'Audit Logs', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ],
  COMPANY: [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'emi-collection', label: 'EMI Collection', icon: Wallet },
    { id: 'emi-calendar', label: 'EMI Calendar', icon: Calendar },
    { id: 'offline-loans', label: 'Offline Loans', icon: FileText },
    { id: 'pending', label: 'Pending Approvals', icon: Clock },
    { id: 'progress', label: 'In Progress', icon: FileText },
    { id: 'active', label: 'Active Loans', icon: CheckCircle },
    { id: 'agents', label: 'Agent Management', icon: Users },
    { id: 'personalCredits', label: 'My Credits', icon: IndianRupee },
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'risk', label: 'Risk Analysis', icon: Target }
  ],
  AGENT: [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'emi-collection', label: 'EMI Collection', icon: Wallet },
    { id: 'emi-calendar', label: 'EMI Calendar', icon: Calendar },
    { id: 'offline-loans', label: 'Offline Loans', icon: FileText },
    { id: 'pending', label: 'Pending Approval', icon: Clock },
    { id: 'session', label: 'Create Sanction', icon: Edit },
    { id: 'active', label: 'Active Loans', icon: CheckCircle },
    { id: 'staff', label: 'My Staff', icon: ClipboardCheck },
    { id: 'myCredit', label: 'My Credit', icon: IndianRupee },
    { id: 'calculator', label: 'EMI Calculator', icon: Calculator },
    { id: 'performance', label: 'Performance', icon: TrendingUp }
  ],
  STAFF: [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'pending', label: 'Pending Verification', icon: Clock },
    { id: 'completed', label: 'Completed', icon: CheckCircle },
    { id: 'activeLoans', label: 'Active Loans', icon: Banknote },
    { id: 'myCredit', label: 'My Credit', icon: IndianRupee },
    { id: 'field', label: 'Field Visits', icon: MapPin }
  ],
  CASHIER: [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'pending', label: 'Pending Disbursement', icon: Clock },
    { id: 'paymentRequests', label: 'Payment Requests', icon: FileText },
    { id: 'history', label: 'Recent', icon: Receipt },
    { id: 'activeLoans', label: 'Active Loans', icon: Banknote },
    { id: 'audit', label: 'Audit Logs', icon: Activity }
  ],
  CUSTOMER: [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'services', label: 'Services', icon: Briefcase },
    { id: 'loans', label: 'My Loans', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User }
  ],
  ACCOUNTANT: [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'excel-export', label: 'Excel Export', icon: FileSpreadsheet },
    { id: 'money-logs', label: 'Money Logs', icon: Activity },
    { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
    { id: 'journal', label: 'Journal Entries', icon: Edit },
    { id: 'fixed-assets', label: 'Fixed Assets', icon: Building2 },
    { id: 'trial-balance', label: 'Trial Balance', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: PieChart },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'bank', label: 'Bank Accounts', icon: Banknote },
    { id: 'year-end', label: 'Year End', icon: Calendar }
  ]
};
