import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, OverlayViewF } from '@react-google-maps/api';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { db, doc, onSnapshot } from '@/src/lib/firebase';

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface MapComponentProps {
  initialViewState?: ViewState;
  onViewStateChange?: (viewState: ViewState) => void;
  onClick?: (e: { lngLat: { lng: number; lat: number } }) => void;
  className?: string;
  children?: React.ReactNode;
  interactive?: boolean;
}

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: 105.8342, // Hanoi default
  latitude: 21.0278,
  zoom: 12
};

const lightMapStyle = [
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
];

// Map options
const defaultOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  mapTypeId: 'roadmap',
  styles: lightMapStyle,
};

export function MapComponent({
  initialViewState = DEFAULT_VIEW_STATE,
  onViewStateChange,
  onClick,
  className,
  children,
  interactive = true
}: MapComponentProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  useEffect(() => {
    // Fetch API key from Firebase settings
    const unsub = onSnapshot(doc(db, 'configs', 'storage'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().googleMapsKey) {
        setApiKey(docSnap.data().googleMapsKey);
      } else {
        // Fallback to empty string which might show "Development purposes only" 
        // or trigger an error if Google enforces it.
        setApiKey(''); 
      }
    });
    return () => unsub();
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    language: 'vi',
    region: 'VN'
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const center = useMemo(() => ({
    lat: initialViewState.latitude,
    lng: initialViewState.longitude
  }), [initialViewState.latitude, initialViewState.longitude]);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  const handleCenterChanged = () => {
    if (map && onViewStateChange) {
      const newCenter = map.getCenter();
      if (newCenter) {
        onViewStateChange({
          latitude: newCenter.lat(),
          longitude: newCenter.lng(),
          zoom: map.getZoom() || 14
        });
      }
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (interactive && onClick && e.latLng) {
      onClick({
        lngLat: {
          lat: e.latLng.lat(),
          lng: e.latLng.lng()
        }
      });
    }
  };

  if (apiKey === null) {
    return (
      <div className={cn("relative w-full h-full overflow-hidden rounded-md flex items-center justify-center bg-gray-100", className)}>
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn("relative w-full h-full overflow-hidden rounded-md flex items-center justify-center bg-red-50 text-red-500 font-medium text-sm", className)}>
        Không thể tải Google Maps
      </div>
    );
  }

  return isLoaded ? (
    <div className={cn("relative w-full h-full overflow-hidden rounded-md", className)}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={initialViewState.zoom || 14}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onCenterChanged={handleCenterChanged}
        onClick={handleMapClick}
        options={{
          ...defaultOptions,
          draggable: interactive,
          scrollwheel: interactive,
          disableDoubleClickZoom: !interactive,
        }}
      >
        {children}
      </GoogleMap>
    </div>
  ) : (
    <div className={cn("relative w-full h-full overflow-hidden rounded-md flex items-center justify-center bg-gray-100", className)}>
      <Loader2 className="h-6 w-6 text-primary animate-spin" />
    </div>
  );
}

// Reusable Custom Marker using OverlayViewF
import { OverlayView } from '@react-google-maps/api';

export function CustomMarker({ 
  longitude, 
  latitude, 
  color = "bg-red-500", 
  onClick, 
  labelText,
  children 
}: { 
  longitude: number; 
  latitude: number; 
  color?: string; 
  onClick?: () => void; 
  labelText?: string;
  children?: React.ReactNode; 
}) {
  return (
    <OverlayViewF
      position={{ lat: latitude, lng: longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(width, height) => ({
        x: -(width / 2),
        y: -height
      })}
    >
      <div 
        className="relative flex flex-col items-center group cursor-pointer transition-transform duration-200 hover:scale-105"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        <div className={cn("p-1.5 rounded-full shadow-md border-2 border-white flex items-center justify-center transition-all duration-200", color)}>
          <MapPin className="h-5 w-5 text-white" />
        </div>
        <div className="absolute top-[32px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-black/40 rounded-full blur-[2px]" />
        
        {labelText && (
          <div className="mt-1.5 px-1.5 py-0.5 rounded-md bg-white text-gray-900 text-[10px] font-bold shadow-md border border-gray-200/80 max-w-[110px] truncate whitespace-nowrap pointer-events-none relative z-0">
            {labelText}
          </div>
        )}
        
        {children && (
          <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
            {children}
          </div>
        )}
      </div>
    </OverlayViewF>
  );
}
