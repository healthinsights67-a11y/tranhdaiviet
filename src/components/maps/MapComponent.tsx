import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { renderToString } from 'react-dom/server';

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

// Component to handle map events
function MapEvents({ onViewStateChange, onClick, interactive }: { 
  onViewStateChange?: (viewState: ViewState) => void, 
  onClick?: (e: { lngLat: { lng: number; lat: number } }) => void,
  interactive: boolean 
}) {
  useMapEvents({
    click(e) {
      if (interactive && onClick) {
        onClick({
          lngLat: {
            lat: e.latlng.lat,
            lng: e.latlng.lng
          }
        });
      }
    },
    moveend(e) {
      if (onViewStateChange) {
        const map = e.target;
        const center = map.getCenter();
        onViewStateChange({
          latitude: center.lat,
          longitude: center.lng,
          zoom: map.getZoom()
        });
      }
    }
  });
  return null;
}

// Component to handle dynamic center updates
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export function MapComponent({
  initialViewState = DEFAULT_VIEW_STATE,
  onViewStateChange,
  onClick,
  className,
  children,
  interactive = true
}: MapComponentProps) {
  
  const center: [number, number] = useMemo(() => [
    initialViewState.latitude,
    initialViewState.longitude
  ], [initialViewState.latitude, initialViewState.longitude]);

  return (
    <div className={cn("relative w-full h-full overflow-hidden rounded-md z-0", className)}>
      <MapContainer 
        center={center} 
        zoom={initialViewState.zoom || 14} 
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        className="w-full h-full z-0"
      >
        <ChangeView center={center} zoom={initialViewState.zoom || 14} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapEvents onViewStateChange={onViewStateChange} onClick={onClick} interactive={interactive} />
        {children}
      </MapContainer>
    </div>
  );
}

// Reusable Custom Marker using react-leaflet
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
  const iconHtml = renderToString(
    <div className="relative flex flex-col items-center group cursor-pointer transition-transform duration-200 hover:scale-105">
      <div className={cn(`p-1.5 rounded-full shadow-md border-2 border-white flex items-center justify-center transition-all duration-200`, color)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin text-white"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div className="absolute top-[32px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-black/40 rounded-full blur-[2px]" />
      
      {labelText && (
        <div className="mt-1.5 px-1.5 py-0.5 rounded-md bg-white text-gray-900 text-[10px] font-bold shadow-md border border-gray-200/80 max-w-[110px] truncate whitespace-nowrap pointer-events-none relative z-0">
          {labelText}
        </div>
      )}
    </div>
  );

  const customIcon = L.divIcon({
    html: iconHtml,
    className: 'custom-leaflet-icon',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42]
  });

  return (
    <Marker 
      position={[latitude, longitude]} 
      icon={customIcon}
      eventHandlers={{
        click: () => onClick && onClick()
      }}
    >
      {children && (
        <Popup className="custom-popup" closeButton={false}>
          {children}
        </Popup>
      )}
    </Marker>
  );
}
