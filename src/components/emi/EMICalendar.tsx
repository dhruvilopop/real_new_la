'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft, ChevronRight, Calendar, IndianRupee, CheckCircle,
  Clock, AlertTriangle, User, Phone, Wallet, Building2
} from 'lucide-react';
import EMIPaymentDialog from './EMIPaymentDialog';

interface EMIItem {
  id: string;
  installmentNumber: number;
  totalAmount: number;
  principalAmount: number;
  interestAmount: number;
  dueDate: string;
  paymentStatus: string;
  paidAmount: number;
  paidPrincipal: number;
  paidInterest: number;
  outstandingPrincipal: number;
  loanApplication?: {
    id: string;
    applicationNo: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  offlineLoan?: {
    id: string;
    loanNumber: string;
    customerName: string;
    customerPhone: string;
    loanAmount: number;
    interestRate: number;
    tenure: number;
    company?: { id: string; name: string };
  };
}

interface CalendarDay {
  date: string;
  online: EMIItem[];
  offline: EMIItem[];
  total: number;
  paid: number;
}

interface EMICalendarProps {
  userId: string;
  userRole: string;
}

export default function EMICalendar({ userId, userRole }: EMICalendarProps) {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEmis, setSelectedEmis] = useState<{ online: EMIItem[]; offline: EMIItem[] }>({ online: [], offline: [] });
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedEmi, setSelectedEmi] = useState<EMIItem | null>(null);
  const [selectedType, setSelectedType] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    fetchCalendar();
  }, [userId, userRole, currentDate]);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const res = await fetch(`/api/emi-reminder?action=calendar&userId=${userId}&userRole=${userRole}&year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCalendar(data.calendar);
        }
      }
    } catch (error) {
      console.error('Failed to fetch calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid
  const generateCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: { date: Date; day: number; isCurrentMonth: boolean; emis?: CalendarDay }[] = [];
    
    // Add days from previous month
    const startDayOfWeek = firstDay.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, day: date.getDate(), isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateKey = date.toISOString().slice(0, 10);
      const dayEmis = calendar.find(d => d.date === dateKey);
      days.push({ date, day, isCurrentMonth: true, emis: dayEmis });
    }
    
    // Add days from next month
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, day: date.getDate(), isCurrentMonth: false });
    }
    
    return days;
  };

  const handleDayClick = (day: { date: Date; emis?: CalendarDay }) => {
    if (day.emis && (day.emis.online.length > 0 || day.emis.offline.length > 0)) {
      setSelectedDate(day.date.toISOString().slice(0, 10));
      setSelectedEmis({ online: day.emis.online, offline: day.emis.offline });
      setDialogOpen(true);
    }
  };

  const handlePayEmi = (emi: EMIItem, type: 'online' | 'offline') => {
    setSelectedEmi(emi);
    setSelectedType(type);
    setPaymentDialogOpen(true);
  };

  const handlePaymentComplete = () => {
    fetchCalendar();
    // Refresh the selected day's EMIs
    if (selectedDate) {
      const dayEmis = calendar.find(d => d.date === selectedDate);
      if (dayEmis) {
        setSelectedEmis({ online: dayEmis.online, offline: dayEmis.offline });
      }
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const renderEmiItem = (emi: EMIItem, type: 'online' | 'offline') => {
    const customerName = type === 'offline'
      ? emi.offlineLoan?.customerName
      : `${emi.loanApplication?.firstName || ''} ${emi.loanApplication?.lastName || ''}`.trim();
    const loanNumber = type === 'offline'
      ? emi.offlineLoan?.loanNumber
      : emi.loanApplication?.applicationNo;
    const phone = type === 'offline'
      ? emi.offlineLoan?.customerPhone
      : emi.loanApplication?.phone;
    const canPay = emi.paymentStatus !== 'PAID';

    return (
      <motion.div
        key={emi.id}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-3 rounded-lg border ${
          emi.paymentStatus === 'PAID'
            ? 'bg-green-50 border-green-200'
            : emi.paymentStatus === 'OVERDUE'
            ? 'bg-red-50 border-red-200'
            : emi.paymentStatus === 'PARTIALLY_PAID'
            ? 'bg-amber-50 border-amber-200'
            : emi.paymentStatus === 'INTEREST_ONLY_PAID'
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant={type === 'offline' ? 'secondary' : 'outline'} className="text-xs">
                {type === 'offline' ? 'Offline' : 'Online'}
              </Badge>
              <Badge className={
                emi.paymentStatus === 'PAID'
                  ? 'bg-green-100 text-green-700'
                  : emi.paymentStatus === 'OVERDUE'
                  ? 'bg-red-100 text-red-700'
                  : emi.paymentStatus === 'PARTIALLY_PAID'
                  ? 'bg-amber-100 text-amber-700'
                  : emi.paymentStatus === 'INTEREST_ONLY_PAID'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              }>
                {emi.paymentStatus.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-gray-500">EMI #{emi.installmentNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-3 w-3 text-gray-400" />
              <span className="text-sm font-medium">{customerName}</span>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
              <span>{loanNumber}</span>
              {phone && <span>• {phone}</span>}
            </div>
            {type === 'offline' && emi.offlineLoan?.company && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <Building2 className="h-3 w-3" />
                {emi.offlineLoan.company.name}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Principal: {formatCurrency(emi.principalAmount)} | Interest: {formatCurrency(emi.interestAmount)}
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900">{formatCurrency(emi.totalAmount)}</p>
            {emi.paymentStatus === 'PAID' && (
              <p className="text-xs text-green-600">Paid: {formatCurrency(emi.paidAmount)}</p>
            )}
            {emi.paymentStatus === 'PARTIALLY_PAID' && (
              <p className="text-xs text-amber-600">Remaining: {formatCurrency(emi.totalAmount - emi.paidAmount)}</p>
            )}
            {canPay && (
              <Button
                size="sm"
                className="mt-2 bg-emerald-500 hover:bg-emerald-600"
                onClick={() => handlePayEmi(emi, type)}
              >
                <IndianRupee className="h-3 w-3 mr-1" /> Pay
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const calendarDays = generateCalendarGrid();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate summary
  const totalEmis = calendar.reduce((sum, d) => sum + d.online.length + d.offline.length, 0);
  const totalAmount = calendar.reduce((sum, d) => sum + d.total, 0);
  const totalPaid = calendar.reduce((sum, d) => sum + d.paid, 0);

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              EMI Calendar (All Companies)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={goToToday}>
                Today
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h3 className="text-lg font-semibold">{getMonthName(currentDate)}</h3>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg bg-purple-50 border border-purple-100">
              <p className="text-xs text-purple-600 font-medium">Total EMIs</p>
              <p className="text-lg font-bold text-purple-700">{totalEmis}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-600 font-medium">To Collect</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(totalAmount - totalPaid)}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-50 border border-green-100">
              <p className="text-xs text-green-600 font-medium">Collected</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
            </div>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const hasEmis = day.emis && (day.emis.online.length > 0 || day.emis.offline.length > 0);
                const isPaid = day.emis && day.emis.paid >= day.emis.total && hasEmis;
                const hasPending = day.emis && day.emis.paid < day.emis.total && hasEmis;
                const emiCount = hasEmis ? (day.emis!.online.length + day.emis!.offline.length) : 0;

                return (
                  <motion.button
                    key={index}
                    whileHover={hasEmis ? { scale: 1.05 } : {}}
                    whileTap={hasEmis ? { scale: 0.95 } : {}}
                    onClick={() => handleDayClick(day)}
                    disabled={!hasEmis}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-colors ${
                      !day.isCurrentMonth
                        ? 'text-gray-300'
                        : isToday(day.date)
                        ? 'bg-purple-100 text-purple-700 font-bold'
                        : hasEmis
                        ? isPaid
                          ? 'bg-green-50 hover:bg-green-100 cursor-pointer'
                          : 'bg-amber-50 hover:bg-amber-100 cursor-pointer'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm">{day.day}</span>
                    {hasEmis && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {day.emis!.online.length > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        )}
                        {day.emis!.offline.length > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        )}
                      </div>
                    )}
                    {hasEmis && (
                      <span className={`text-[10px] font-medium ${
                        isPaid ? 'text-green-600' : 'text-amber-600'
                      }`}>
                        {emiCount}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-xs text-gray-500">Online Loan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-400" />
              <span className="text-xs text-gray-500">Offline Loan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
              <span className="text-xs text-gray-500">Paid</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
              <span className="text-xs text-gray-500">Pending</span>
            </div>
          </div>
        </CardContent>

        {/* Day Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-500" />
                EMIs for {selectedDate && formatDate(selectedDate)}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {selectedEmis.online.length === 0 && selectedEmis.offline.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No EMIs for this date</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {/* Show offline EMIs first (more common for offline loan system) */}
                    {selectedEmis.offline.map(emi => renderEmiItem(emi, 'offline'))}
                    {selectedEmis.online.map(emi => renderEmiItem(emi, 'online'))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </Card>

      {/* Payment Dialog */}
      <EMIPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        emi={selectedEmi}
        type={selectedType}
        userId={userId}
        userRole={userRole}
        onPaymentComplete={handlePaymentComplete}
      />
    </>
  );
}
