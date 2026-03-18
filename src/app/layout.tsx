import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SecurityProvider } from "@/contexts/SecurityContext";

export const metadata: Metadata = {
  title: "Money Mitra Financial Advisor",
  description: "Digital Loan Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SettingsProvider>
            <SecurityProvider>
              {children}
            </SecurityProvider>
          </SettingsProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
