'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Eye, EyeOff, Lock, Mail, Loader2, ArrowLeft, UserPlus, LogIn, Phone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithGoogle } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface CustomerLoginPageProps {
  onBack: () => void;
}

export default function CustomerLoginPage({ onBack }: CustomerLoginPageProps) {
  const { customerLogin, customerRegister } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    if (isSignUp && !name) {
      toast({ title: 'Error', description: 'Please enter your name', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const result = await customerRegister({ email, password, name, phone });
        if (result.success) {
          toast({ title: 'Success', description: 'Account created successfully!' });
          window.location.reload();
        } else {
          toast({ title: 'Error', description: result.error || 'Sign up failed', variant: 'destructive' });
        }
      } else {
        const result = await customerLogin(email, password);
        if (result.success) {
          toast({ title: 'Success', description: 'Login successful!' });
          window.location.reload();
        } else {
          toast({ title: 'Error', description: result.error || 'Login failed', variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.success && result.user) {
        // Sync with backend immediately
        const syncResponse = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: result.user.email,
            firebaseUid: result.user.uid,
            name: result.user.displayName,
            profilePicture: result.user.photoURL,
            phone: result.user.phoneNumber
          })
        });

        if (syncResponse.ok) {
          const syncData = await syncResponse.json();
          // Store user in localStorage for immediate access
          localStorage.setItem('demoUser', JSON.stringify(syncData.user));
          toast({ title: 'Success', description: 'Login successful!' });
          window.location.reload();
        } else {
          const errorData = await syncResponse.json();
          toast({ title: 'Error', description: errorData.error || 'Failed to sync account', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Error', description: result.error || 'Google login failed', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
      
      {/* Decorative Elements */}
      <div className="absolute top-20 right-20 w-72 h-72 bg-amber-100 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-orange-100 rounded-full blur-3xl opacity-30" />

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md border border-gray-100 text-gray-600 hover:text-amber-600 hover:shadow-lg transition-all"
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
          <div className="p-8 pb-4 text-center border-b border-gray-50">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200"
            >
              <User className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
            <p className="text-gray-500 text-sm mt-1">Money Mitra Financial Advisor</p>
          </div>

          {/* Tabs */}
          <div className="px-8 pt-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 text-sm ${
                  !isSignUp 
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
              <button
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 text-sm ${
                  isSignUp 
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                Sign Up
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="p-8 pt-6">
            <AnimatePresence mode="wait">
              <motion.form
                key={isSignUp ? 'signup' : 'signin'}
                initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {isSignUp && (
                  <div className="space-y-2">
                    <Label className="text-gray-700 text-sm font-medium">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-12 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm font-medium">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-12 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl text-sm"
                    />
                  </div>
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <Label className="text-gray-700 text-sm font-medium">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-12 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm font-medium">Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12 pr-12 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl text-sm"
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

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-200 transition-all text-sm"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isSignUp ? (
                    'Create Account'
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </motion.form>
            </AnimatePresence>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-white text-gray-400 text-sm">or continue with</span>
              </div>
            </div>

            {/* Google Button */}
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full h-12 bg-white border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all text-sm"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            {/* Terms */}
            {isSignUp && (
              <p className="mt-4 text-xs text-center text-gray-400">
                By creating an account, you agree to our{' '}
                <span className="text-amber-600 hover:underline cursor-pointer">Terms</span>
                {' '}and{' '}
                <span className="text-amber-600 hover:underline cursor-pointer">Privacy Policy</span>
              </p>
            )}
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
