import React, { useRef, useState, useEffect } from 'react';
import Map, { NavigationControl, Marker, GeolocateControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { cn } from '@/src/lib/utils';

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

// We use a free vector tile source from MapTiler or OSM. 
// For production without an API key, we can use CartoDB Positron or standard OSM.
// Here we use standard OSM raster tiles since it doesn't require a key, 
// or a free vector style if available.
const mapStyle = {
  version: 8,
  sources: {
    'carto-light': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  },
  layers: [
    {
      id: 'carto-light-layer',
      type: 'raster',
      source: 'carto-light',
      minzoom: 0,
      maxzoom: 20
    }
  ]
};

export function MapComponent({
  initialViewState = DEFAULT_VIEW_STATE,
  onViewStateChange,
  onClick,
  className,
  children,
  interactive = true
}: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState<ViewState>(initialViewState);

  // Allow controlled or uncontrolled
  useEffect(() => {
    if (initialViewState.longitude !== viewState.longitude || initialViewState.latitude !== viewState.latitude) {
      setViewState(initialViewState);
      mapRef.current?.flyTo({ center: [initialViewState.longitude, initialViewState.latitude], zoom: initialViewState.zoom || 14 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialViewState.longitude, initialViewState.latitude]);

  return (
    <div className={cn("relative w-full h-full overflow-hidden rounded-md", className)}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => {
          setViewState(evt.viewState);
          onViewStateChange?.(evt.viewState);
        }}
        onClick={(e) => {
          if (interactive && onClick) onClick(e);
        }}
        mapStyle={mapStyle as any}
        dragPan={interactive}
        dragRotate={interactive}
        scrollZoom={interactive}
        doubleClickZoom={interactive}
      >
        {interactive && <NavigationControl position="bottom-right" />}
        {interactive && <GeolocateControl position="bottom-right" trackUserLocation={true} />}
        
        {children}
      </Map>
    </div>
  );
}

// Reusable Custom Marker
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
    <Marker longitude={longitude} latitude={latitude} anchor="bottom" onClick={(e) => {
      e.originalEvent.stopPropagation();
      onClick?.();
    }}>
      <div className="relative flex flex-col items-center group cursor-pointer transition-transform duration-200 hover:scale-105">
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
    </Marker>
  );
}
