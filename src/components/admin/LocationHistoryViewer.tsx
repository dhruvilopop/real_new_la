'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, Users, Clock, Search, RefreshCw, Loader2, 
  Smartphone, Monitor, Tablet, Globe, ExternalLink,
  Calendar, Filter, AlertCircle, Shield, Building2, User, Briefcase, CreditCard, Wallet,
  ArrowLeft, Crosshair, CheckCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface LocationRecord {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  action: string;
  loanApplicationId: string | null;
  paymentId: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    role: string;
  };
}

interface UserInfo {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  locationCount: number;
}

const ACTION_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  APP_OPEN: { label: 'App Opened', className: 'bg-blue-100 text-blue-700', icon: Smartphone },
  LOAN_APPLY: { label: 'Loan Applied', className: 'bg-emerald-100 text-emerald-700', icon: AlertCircle },
  EMI_PAY: { label: 'EMI Paid', className: 'bg-amber-100 text-amber-700', icon: Clock },
  SESSION_CONFIRM: { label: 'Sanction Confirmed', className: 'bg-purple-100 text-purple-700', icon: AlertCircle },
  LOGIN: { label: 'Logged In', className: 'bg-cyan-100 text-cyan-700', icon: Users },
};

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', icon: Shield, color: 'bg-red-500' },
  COMPANY: { label: 'Company', icon: Building2, color: 'bg-blue-500' },
  AGENT: { label: 'Agent', icon: Briefcase, color: 'bg-emerald-500' },
  STAFF: { label: 'Staff', icon: User, color: 'bg-purple-500' },
  CASHIER: { label: 'Cashier', icon: CreditCard, color: 'bg-amber-500' },
  CUSTOMER: { label: 'Customer', icon: Wallet, color: 'bg-teal-500' },
  ACCOUNTANT: { label: 'Accountant', icon: CreditCard, color: 'bg-indigo-500' },
};

export default function LocationHistoryViewer() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [totalRecords, setTotalRecords] = useState(0);
  
  // New state for user selection
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [capturingLocation, setCapturingLocation] = useState(false);

  const fetchLocations = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await fetch('/api/location/track?all=true');
      const data = await response.json();
      if (data.success) {
        setLocations(data.locations || []);
        setTotalRecords(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      if (!isRefresh) {
        toast({
          title: 'Error',
          description: 'Failed to fetch location history',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Get unique users with location counts
  const usersWithLocationCounts: UserInfo[] = (() => {
    const userMap = new Map<string, UserInfo>();
    
    locations.forEach(loc => {
      if (!userMap.has(loc.userId)) {
        userMap.set(loc.userId, {
          id: loc.userId,
          name: loc.user?.name,
          email: loc.user?.email,
          phone: loc.user?.phone,
          role: loc.user?.role,
          locationCount: 1
        });
      } else {
        const existing = userMap.get(loc.userId)!;
        existing.locationCount++;
      }
    });
    
    return Array.from(userMap.values());
  })();

  // Filter users based on search
  const filteredUsers = usersWithLocationCounts.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.phone?.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Get unique roles from location data
  const availableRoles = [...new Set(locations.map(l => l.user?.role).filter(Boolean))];
  
  // Group locations by role for stats
  const roleStats = availableRoles.map(role => ({
    role,
    count: locations.filter(l => l.user?.role === role).length,
    config: ROLE_CONFIG[role] || { label: role, icon: User, color: 'bg-gray-500' }
  })).sort((a, b) => b.count - a.count);

  // Filter locations for selected user or by search
  const filteredLocations = locations.filter(loc => {
    // If a user is selected, only show their locations
    if (selectedUser) {
      return loc.userId === selectedUser.id;
    }
    
    const matchesSearch = 
      loc.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.user?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.user?.phone?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = filterAction === 'all' || loc.action === filterAction;
    const matchesRole = filterRole === 'all' || loc.user?.role === filterRole;
    return matchesSearch && matchesAction && matchesRole;
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
      case 'smartphone':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      case 'desktop':
      case 'computer':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  // Capture live location
  const captureLiveLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Not Supported',
        description: 'Geolocation is not supported by your browser',
        variant: 'destructive'
      });
      return;
    }

    setCapturingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Get device info
          const userAgent = navigator.userAgent;
          let deviceType = 'Desktop';
          if (/mobile/i.test(userAgent)) deviceType = 'Mobile';
          else if (/tablet/i.test(userAgent)) deviceType = 'Tablet';
          
          // Detect browser
          let browser = 'Unknown';
          if (userAgent.includes('Chrome')) browser = 'Chrome';
          else if (userAgent.includes('Firefox')) browser = 'Firefox';
          else if (userAgent.includes('Safari')) browser = 'Safari';
          else if (userAgent.includes('Edge')) browser = 'Edge';
          
          // Detect OS
          let os = 'Unknown';
          if (userAgent.includes('Windows')) os = 'Windows';
          else if (userAgent.includes('Mac')) os = 'MacOS';
          else if (userAgent.includes('Linux')) os = 'Linux';
          else if (userAgent.includes('Android')) os = 'Android';
          else if (userAgent.includes('iOS')) os = 'iOS';

          const response = await fetch('/api/location/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: selectedUser?.id || 'admin-capture',
              latitude,
              longitude,
              accuracy,
              action: 'APP_OPEN',
              deviceInfo: { deviceType, browser, os }
            })
          });

          const data = await response.json();
          
          if (data.success) {
            toast({
              title: 'Location Captured',
              description: `Successfully saved location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            });
            // Refresh locations
            fetchLocations(true);
          } else {
            throw new Error(data.error || 'Failed to save location');
          }
        } catch (error) {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to save location',
            variant: 'destructive'
          });
        } finally {
          setCapturingLocation(false);
        }
      },
      (error) => {
        setCapturingLocation(false);
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        toast({
          title: 'Location Error',
          description: errorMessage,
          variant: 'destructive'
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Render user list view
  const renderUserList = () => (
    <>
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Location Records</p>
                <p className="text-2xl font-bold">{totalRecords} / 500</p>
                <p className="text-xs text-blue-200 mt-1">Max 500 records stored</p>
              </div>
              <div className="p-3 bg-white/20 rounded-full">
                <MapPin className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Unique Users Tracked</p>
                <p className="text-2xl font-bold">
                  {usersWithLocationCounts.length}
                </p>
                <p className="text-xs text-emerald-200 mt-1">Users with location data</p>
              </div>
              <div className="p-3 bg-white/20 rounded-full">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Today's Activity</p>
                <p className="text-2xl font-bold">
                  {locations.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
                </p>
                <p className="text-xs text-purple-200 mt-1">Location events today</p>
              </div>
              <div className="p-3 bg-white/20 rounded-full">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Filter Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-blue-600" />
            Filter by Role
          </CardTitle>
          <CardDescription>
            Click on a role to filter users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterRole === 'all' ? 'default' : 'outline'}
              className={filterRole === 'all' ? 'bg-gray-800 hover:bg-gray-700' : ''}
              onClick={() => setFilterRole('all')}
            >
              <Users className="h-4 w-4 mr-2" />
              All Roles ({usersWithLocationCounts.length})
            </Button>
            {roleStats.map(({ role, count, config }) => {
              const Icon = config.icon;
              return (
                <Button
                  key={role}
                  variant={filterRole === role ? 'default' : 'outline'}
                  className={filterRole === role ? 'bg-gray-800 hover:bg-gray-700' : ''}
                  onClick={() => setFilterRole(role)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {config.label} ({usersWithLocationCounts.filter(u => u.role === role).length})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Users with Location History
              </CardTitle>
              <CardDescription>
                Click on a user to view their location logs
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by name, email, phone..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => fetchLocations(true)} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No users with location history found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {filteredUsers.map((user, index) => {
                  const roleConfig = ROLE_CONFIG[user.role] || { label: user.role, icon: User, color: 'bg-gray-500' };
                  const RoleIcon = roleConfig.icon;
                  
                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="p-4 border border-gray-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer bg-white"
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className={`h-12 w-12 ${roleConfig.color}`}>
                            <AvatarFallback className="bg-transparent text-white font-semibold text-lg">
                              {user.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900">{user.name || 'Unknown'}</h4>
                              <Badge variant="outline" className="text-xs">
                                <RoleIcon className="h-3 w-3 mr-1" />
                                {roleConfig.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {user.phone && (
                              <p className="text-xs text-gray-400">{user.phone}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-blue-600 font-semibold">
                              <MapPin className="h-4 w-4" />
                              <span>{user.locationCount}</span>
                            </div>
                            <p className="text-xs text-gray-400">Location logs</p>
                          </div>
                          <ExternalLink className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  );

  // Render user's location logs
  const renderUserLocationLogs = () => {
    const roleConfig = ROLE_CONFIG[selectedUser?.role || ''] || { label: selectedUser?.role, icon: User, color: 'bg-gray-500' };
    const RoleIcon = roleConfig.icon;

    return (
      <>
        {/* User Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Users
                </Button>
                <div className="flex items-center gap-3">
                  <Avatar className={`h-12 w-12 ${roleConfig.color}`}>
                    <AvatarFallback className="bg-transparent text-white font-semibold text-lg">
                      {selectedUser?.name?.charAt(0) || selectedUser?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{selectedUser?.name || 'Unknown'}</h3>
                      <Badge variant="outline" className="text-xs">
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{selectedUser?.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-blue-600 font-semibold">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedUser?.locationCount}</span>
                  </div>
                  <p className="text-xs text-gray-400">Location logs</p>
                </div>
                
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={captureLiveLocation}
                  disabled={capturingLocation}
                >
                  {capturingLocation ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Capturing...
                    </>
                  ) : (
                    <>
                      <Crosshair className="h-4 w-4 mr-2" />
                      Capture Live Location
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Logs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Location Logs
                </CardTitle>
                <CardDescription>
                  Showing {filteredLocations.length} location records for this user
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="APP_OPEN">App Opened</SelectItem>
                    <SelectItem value="LOAN_APPLY">Loan Applied</SelectItem>
                    <SelectItem value="EMI_PAY">EMI Paid</SelectItem>
                    <SelectItem value="SESSION_CONFIRM">Sanction Confirmed</SelectItem>
                    <SelectItem value="LOGIN">Logged In</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => fetchLocations(true)} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No location records found for this user</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 pr-4">
                  {filteredLocations.map((loc, index) => {
                    const actionConfig = ACTION_CONFIG[loc.action] || { label: loc.action, className: 'bg-gray-100 text-gray-700', icon: MapPin };
                    const ActionIcon = actionConfig.icon;
                    
                    return (
                      <motion.div
                        key={loc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all bg-white"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-full">
                              <MapPin className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={actionConfig.className}>
                                  <ActionIcon className="h-3 w-3 mr-1" />
                                  {actionConfig.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                <span>{formatDate(loc.createdAt)}</span>
                                <span>•</span>
                                <span className="text-blue-600">{formatTimeAgo(loc.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {/* Location Info */}
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-red-500" />
                              <span className="font-mono text-gray-600">
                                {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                              </span>
                              {loc.accuracy && (
                                <span className="text-xs text-gray-400">
                                  (±{loc.accuracy.toFixed(0)}m)
                                </span>
                              )}
                            </div>
                            
                            {/* Device Info */}
                            {loc.deviceType && (
                              <div className="flex items-center gap-1 text-gray-500" title={`${loc.browser || ''} ${loc.os || ''}`}>
                                {getDeviceIcon(loc.deviceType)}
                                <span className="text-xs">{loc.deviceType}</span>
                              </div>
                            )}
                            
                            {/* View on Map Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-200 text-blue-600 hover:bg-blue-50"
                              onClick={() => openInMaps(loc.latitude, loc.longitude)}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Map
                            </Button>
                          </div>
                        </div>
                        
                        {/* Address if available */}
                        {loc.address && (
                          <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
                            <span className="font-medium">Address:</span> {loc.address}
                            {loc.city && <span>, {loc.city}</span>}
                            {loc.state && <span>, {loc.state}</span>}
                            {loc.country && <span>, {loc.country}</span>}
                          </div>
                        )}
                        
                        {/* Related records */}
                        {(loc.loanApplicationId || loc.paymentId) && (
                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                            {loc.loanApplicationId && (
                              <span>Loan: <span className="font-mono">{loc.loanApplicationId.slice(0, 8)}...</span></span>
                            )}
                            {loc.paymentId && (
                              <span>Payment: <span className="font-mono">{loc.paymentId.slice(0, 8)}...</span></span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </>
    );
  };

  return (
    <div className="space-y-4">
      {selectedUser ? renderUserLocationLogs() : renderUserList()}
    </div>
  );
}
