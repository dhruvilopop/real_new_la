'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Eye, EyeOff, Lock, Mail, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface StaffLoginPageProps {
  onBack: () => void;
}

export default function StaffLoginPage({ onBack }: StaffLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({ title: 'Error', description: 'Please enter email and password', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, verificationCode: requires2FA ? verificationCode : undefined })
      });

      const data = await response.json();

      if (data.requiresCode) {
        setRequires2FA(true);
        setLoading(false);
        toast({ title: '2FA Required', description: 'Please enter your verification code' });
        return;
      }

      if (response.ok && data.success) {
        localStorage.setItem('demoUser', JSON.stringify(data.user));
        toast({ title: 'Success', description: 'Login successful!' });
        window.location.reload();
      } else {
        toast({ title: 'Error', description: data.error || 'Login failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-100 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-100 rounded-full blur-3xl opacity-30" />

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md border border-gray-100 text-gray-600 hover:text-emerald-600 hover:shadow-lg transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Back</span>
      </motion.button>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 text-center border-b border-gray-50">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200"
            >
              <Building2 className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Portal</h1>
            <p className="text-gray-500 text-sm mt-1">Money Mitra Financial Advisor Management</p>
          </div>

          {/* Form */}
          <div className="p-8 pt-6">
            <form onSubmit={handleLogin} className="space-y-5">
              {!requires2FA ? (
                <>
                  {/* Email */}
                  <div className="space-y-2">
                    <Label className="text-gray-700 text-sm font-medium">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="name@smfc.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label className="text-gray-700 text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-12 pr-12 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* 2FA */
                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    Verification Code
                  </Label>
                  <Input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    className="h-14 text-center text-2xl tracking-widest bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl font-mono"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 transition-all text-sm"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : requires2FA ? (
                  'Verify & Sign In'
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-700 font-semibold mb-2">Demo Credentials:</p>
              <div className="text-xs text-emerald-600 space-y-1">
                <p><span className="font-semibold">Super Admin:</span> moneymitra@gmail.com / 1122334455</p>
                <p><span className="font-semibold">Company:</span> company1@test.com / 123456</p>
                <p><span className="font-semibold">Agent:</span> agent@test.com / 123456</p>
                <p><span className="font-semibold">Staff:</span> staff@test.com / 12345678</p>
                <p><span className="font-semibold">Cashier:</span> cash@test.com / 12345678</p>
                <p><span className="font-semibold">Accountant:</span> acc@test.com / 12345678</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              © 2024 Money Mitra Financial Advisor. All rights reserved.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
