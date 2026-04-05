import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  granted: boolean;
  denied: boolean;
  loading: boolean;
  error: string | null;
}

interface LocationContextType extends LocationState {
  requestLocation: () => void;
  hasCheckedPermission: boolean;
}

const LocationContext = createContext<LocationContextType | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    granted: false,
    denied: false,
    loading: false,
    error: null,
  });
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);

  // Check existing permission on mount
  useEffect(() => {
    if (!navigator.permissions) {
      setHasCheckedPermission(true);
      return;
    }
    navigator.permissions.query({ name: "geolocation" }).then((result) => {
      if (result.state === "granted") {
        // Already granted, get location silently
        setState((s) => ({ ...s, loading: true }));
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setState({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              granted: true,
              denied: false,
              loading: false,
              error: null,
            });
            setHasCheckedPermission(true);
          },
          () => {
            setState((s) => ({ ...s, loading: false }));
            setHasCheckedPermission(true);
          }
        );
      } else if (result.state === "denied") {
        setState((s) => ({ ...s, denied: true }));
        setHasCheckedPermission(true);
      } else {
        // "prompt" state - need to ask
        setHasCheckedPermission(true);
      }
    }).catch(() => {
      setHasCheckedPermission(true);
    });
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "浏览器不支持定位功能", denied: true }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          granted: true,
          denied: false,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          loading: false,
          denied: err.code === err.PERMISSION_DENIED,
          error:
            err.code === err.PERMISSION_DENIED
              ? "定位权限被拒绝"
              : "获取位置失败",
        }));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return (
    <LocationContext.Provider
      value={{ ...state, requestLocation, hasCheckedPermission }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
