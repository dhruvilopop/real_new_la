"use client";

import { useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import LandingPage from "@/components/landing/LandingPage";
import SuperAdminDashboard from "@/components/admin/SuperAdminDashboard";
import CompanyDashboard from "@/components/company/CompanyDashboard";
import AgentDashboard from "@/components/agent/AgentDashboard";
import StaffDashboard from "@/components/staff/StaffDashboard";
import CashierDashboard from "@/components/cashier/CashierDashboard";
import CustomerDashboard from "@/components/customer/CustomerDashboard";
import AccountantDashboard from "@/components/accountant/AccountantDashboard";

function AppContent() {
  const { user, loading } = useAuth();

  // Show loading state during SSR and initial hydration
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show landing page
  if (!user) {
    return <LandingPage />;
  }

  // Render appropriate dashboard based on user role
  const renderDashboard = () => {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return <SuperAdminDashboard />;
      case 'COMPANY':
        return <CompanyDashboard />;
      case 'AGENT':
        return <AgentDashboard />;
      case 'STAFF':
        return <StaffDashboard />;
      case 'CASHIER':
        return <CashierDashboard />;
      case 'CUSTOMER':
        return <CustomerDashboard />;
      case 'ACCOUNTANT':
        return <AccountantDashboard />;
      default:
        return <LandingPage />;
    }
  };

  return (
    <SettingsProvider>
      {renderDashboard()}
    </SettingsProvider>
  );
}

export default function Home() {
  return <AppContent />;
}
