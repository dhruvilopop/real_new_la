'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Valid action types matching the API
export type LocationAction = 'APP_OPEN' | 'LOAN_APPLY' | 'EMI_PAY' | 'SESSION_CONFIRM' | 'LOGIN';

export interface DeviceInfo {
  deviceType?: string;
  browser?: string;
  os?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface TrackLocationOptions {
  loanApplicationId?: string;
  paymentId?: string;
}

export interface TrackLocationResult {
  success: boolean;
  locationId?: string;
  location?: {
    latitude: number;
    longitude: number;
    action: LocationAction;
    createdAt: Date;
  };
  error?: string;
}

interface UseLocationTrackingOptions {
  userId?: string;
  autoTrackOnMount?: boolean;
  autoTrackAction?: LocationAction;
}

interface LocationTrackingState {
  isLoading: boolean;
  isSupported: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
  lastLocation: LocationData | null;
  error: string | null;
}

/**
 * Hook for tracking user location
 * 
 * @param options - Configuration options
 * @param options.userId - User ID to associate with location logs
 * @param options.autoTrackOnMount - Whether to automatically track location on mount
 * @param options.autoTrackAction - Action to use for auto-tracking (defaults to 'APP_OPEN')
 * 
 * @returns Location tracking utilities and state
 */
export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const { 
    userId, 
    autoTrackOnMount = false, 
    autoTrackAction = 'APP_OPEN' 
  } = options;

  const [state, setState] = useState<LocationTrackingState>({
    isLoading: false,
    isSupported: typeof window !== 'undefined' && 'geolocation' in navigator,
    permissionStatus: 'unknown',
    lastLocation: null,
    error: null,
  });

  const hasAutoTracked = useRef(false);

  // Get device information
  const getDeviceInfo = useCallback((): DeviceInfo => {
    if (typeof window === 'undefined') {
      return {};
    }

    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';
    let deviceType = 'Desktop';

    // Detect browser
    if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browser = 'Opera';
    }

    // Detect OS
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      os = 'MacOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
    }

    // Detect device type
    if (/Mobi|Android/i.test(userAgent)) {
      deviceType = 'Mobile';
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceType = 'Tablet';
    }

    return { deviceType, browser, os };
  }, []);

  // Check permission status
  const checkPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
    if (!state.isSupported) {
      return 'unknown';
    }

    try {
      // Try to use the Permissions API if available
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        return permission.state;
      }
    } catch {
      // Permissions API not supported, will check on first geolocation call
    }

    return 'unknown';
  }, [state.isSupported]);

  // Get current position
  const getCurrentPosition = useCallback((): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!state.isSupported) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            lastLocation: locationData,
            permissionStatus: 'granted'
          }));
          resolve(locationData);
        },
        (error) => {
          let errorMessage = 'Failed to get location';
          let permissionStatus: 'denied' | 'prompt' = 'prompt';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied by user';
              permissionStatus = 'denied';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }

          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: errorMessage,
            permissionStatus
          }));
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // Cache for 1 minute
        }
      );
    });
  }, [state.isSupported]);

  // Track location and send to API
  const trackLocation = useCallback(async (
    action: LocationAction,
    additionalData?: TrackLocationOptions
  ): Promise<TrackLocationResult> => {
    try {
      // Get current position
      const locationData = await getCurrentPosition();

      // If no userId provided, return just the location data
      if (!userId) {
        return {
          success: true,
          location: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            action,
            createdAt: new Date(),
          },
        };
      }

      // Send to API
      const response = await fetch('/api/location/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          action,
          loanApplicationId: additionalData?.loanApplicationId,
          paymentId: additionalData?.paymentId,
          deviceInfo: getDeviceInfo(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save location');
      }

      return {
        success: true,
        locationId: data.locationId,
        location: data.location,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [userId, getCurrentPosition, getDeviceInfo]);

  // Request permission explicitly (useful for showing UI feedback)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      return false;
    }

    try {
      await getCurrentPosition();
      return true;
    } catch {
      return false;
    }
  }, [state.isSupported, getCurrentPosition]);

  // Auto-track on mount if enabled
  useEffect(() => {
    if (autoTrackOnMount && userId && !hasAutoTracked.current && state.isSupported) {
      hasAutoTracked.current = true;
      
      // Check permission first
      checkPermission().then(status => {
        if (status !== 'denied') {
          trackLocation(autoTrackAction).catch(() => {
            // Silently fail for auto-track
          });
        }
      });
    }
  }, [autoTrackOnMount, userId, autoTrackAction, state.isSupported, checkPermission, trackLocation]);

  // Check initial permission status
  useEffect(() => {
    if (state.isSupported) {
      checkPermission().then(status => {
        setState(prev => ({ ...prev, permissionStatus: status }));
      });
    }
  }, [state.isSupported, checkPermission]);

  return {
    // State
    isLoading: state.isLoading,
    isSupported: state.isSupported,
    permissionStatus: state.permissionStatus,
    lastLocation: state.lastLocation,
    error: state.error,
    
    // Actions
    trackLocation,
    getCurrentPosition,
    requestPermission,
    getDeviceInfo,
    
    // Utilities
    isPermissionDenied: state.permissionStatus === 'denied',
    isPermissionGranted: state.permissionStatus === 'granted',
  };
}

export default useLocationTracking;
