'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Shield, Clock, Users, TrendingUp, Phone, Mail, MapPin, ArrowRight, Building2, FileText, User, Lock } from 'lucide-react';
import { formatCurrency } from '@/utils/helpers';
import { motion } from 'framer-motion';
import StaffLoginPage from '@/components/auth/StaffLoginPage';
import CustomerLoginPage from '@/components/auth/CustomerLoginPage';

type AuthView = 'landing' | 'staff-login' | 'customer-login';

export default function LandingPage() {
  const [stats, setStats] = useState({ totalLoans: 0, totalDisbursed: 0, activeCustomers: 0, companies: 0 });
  const [services, setServices] = useState<any[]>([]);
  const [authView, setAuthView] = useState<AuthView>('landing');

  // Fetch CMS data when on landing page
  useEffect(() => {
    if (authView !== 'landing') return;
    
    const controller = new AbortController();
    
    const fetchData = async () => {
      try {
        const [productsRes, statsRes] = await Promise.all([
          fetch('/api/cms/product?isActive=true', { signal: controller.signal }),
          fetch('/api/cms/service?type=all', { signal: controller.signal })
        ]);
        
        const productsData = await productsRes.json();
        const statsData = await statsRes.json();
        
        setServices(productsData.products || []);
        setStats(statsData.stats || { totalLoans: 0, totalDisbursed: 0, activeCustomers: 0, companies: 0 });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error fetching CMS data:', error);
        }
      }
    };
    
    fetchData();
    
    return () => controller.abort();
  }, [authView]);

  // Show login pages
  if (authView === 'staff-login') {
    return <StaffLoginPage onBack={() => setAuthView('landing')} />;
  }

  if (authView === 'customer-login') {
    return <CustomerLoginPage onBack={() => setAuthView('landing')} />;
  }

  const features = [
    { icon: Clock, title: 'Quick Approval', description: 'Get your loan approved in just 24 hours' },
    { icon: Shield, title: 'Secure & Safe', description: 'Your data is protected with bank-grade security' },
    { icon: TrendingUp, title: 'Low Interest Rates', description: 'Competitive rates starting from 8.5% p.a.' },
    { icon: Users, title: '24/7 Support', description: 'Our team is always here to help you' },
  ];

  const displayServices = services.length > 0 ? services : [
    { id: '1', title: 'Personal Loan', description: 'Quick approval, low rates for your personal needs', icon: '👤' },
    { id: '2', title: 'Business Loan', description: 'Grow your business with our flexible financing options', icon: '🏢' },
    { id: '3', title: 'Home Loan', description: 'Make your dream home a reality with competitive rates', icon: '🏠' },
    { id: '4', title: 'Education Loan', description: 'Invest in education, invest in the future', icon: '📚' },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Money Mitra Financial Advisor</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50" onClick={() => setAuthView('staff-login')}>
                <User className="h-4 w-4 mr-2" />Staff Login
              </Button>
              <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setAuthView('customer-login')}>
                <Lock className="h-4 w-4 mr-2" />Customer Login
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 pt-16">
        <section className="py-16 md:py-24 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
              <Badge className="bg-emerald-100 text-emerald-700 mb-4">#1 Digital Lending Platform</Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Your Dreams,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">Our Support</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Get quick and easy loans with the most competitive interest rates. Experience seamless digital lending with instant approval.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-lg px-8" onClick={() => setAuthView('customer-login')}>
                  Apply Now <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[{ value: stats.totalLoans || 1000, label: 'Loans Disbursed', icon: FileText },
                 { value: formatCurrency(stats.totalDisbursed || 50000000), label: 'Total Disbursed', icon: Wallet },
                 { value: stats.activeCustomers || 5000, label: 'Happy Customers', icon: Users },
                 { value: stats.companies || 50, label: 'Partner Companies', icon: Building2 }
              ].map((stat, index) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.1 }} className="text-center">
                  <stat.icon className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                  <p className="text-2xl md:text-3xl font-bold">{stat.value}</p>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 md:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <Badge className="bg-emerald-100 text-emerald-700 mb-4">Why Choose Us</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Features</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                    <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-shadow">
                      <CardContent className="p-6 text-center">
                        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Icon className="h-6 w-6 text-emerald-600" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                        <p className="text-gray-600 text-sm">{feature.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Loan Products */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <Badge className="bg-emerald-100 text-emerald-700 mb-4">Our Products</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Loan Products</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">Choose from our wide range of loan products designed to meet your financial needs</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayServices.map((product: any, index: number) => (
                <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer" onClick={() => setAuthView('customer-login')}>
                    <CardContent className="p-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center text-3xl mb-4">
                        {product.icon || '💰'}
                      </div>
                      <h3 className="font-semibold text-xl mb-2">{product.title}</h3>
                      <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Interest Rate</span>
                          <span className="font-medium text-emerald-600">{product.minInterestRate || 8}% - {product.maxInterestRate || 24}% p.a.</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tenure</span>
                          <span className="font-medium">{product.minTenure || 6} - {product.maxTenure || 60} months</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Amount</span>
                          <span className="font-medium">₹{product.minAmount?.toLocaleString() || '10,000'} - ₹{product.maxAmount?.toLocaleString() || '1,00,00,000'}</span>
                        </div>
                      </div>
                      <Button className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600">
                        Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-gradient-to-r from-emerald-500 to-teal-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
            <p className="text-xl text-emerald-100 mb-8">Apply for a loan today and get instant approval</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-emerald-600 hover:bg-emerald-50 text-lg px-8" onClick={() => setAuthView('customer-login')}>
                Customer Login <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-lg px-8" onClick={() => setAuthView('staff-login')}>
                Staff Login
              </Button>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16 md:py-24 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <Badge className="bg-emerald-100 text-emerald-700 mb-4">Contact Us</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Get in Touch</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg text-center"><CardContent className="p-6">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold mb-2">Phone</h3>
                <p className="text-gray-600">+91 1800-123-4567</p>
              </CardContent></Card>
              <Card className="border-0 shadow-lg text-center"><CardContent className="p-6">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold mb-2">Email</h3>
                <p className="text-gray-600">support@smfc.com</p>
              </CardContent></Card>
              <Card className="border-0 shadow-lg text-center"><CardContent className="p-6">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold mb-2">Address</h3>
                <p className="text-gray-600">123 Finance Street, Mumbai</p>
              </CardContent></Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">Money Mitra Financial Advisor</span>
          </div>
          <p className="text-gray-400">© 2024 Money Mitra Financial Advisor. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
