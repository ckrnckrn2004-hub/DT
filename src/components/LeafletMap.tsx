import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Place, Transport } from '../types';

interface LeafletMapProps {
  // If viewing a single spot location
  singlePlace?: Place | null;
  // If viewing the final route schedule
  routePlaces?: Place[];
  selectedTransports?: Transport[];
  passengers?: string;
  hasLuggage?: boolean;
}

const TERMINAL_COORDS: [number, number] = [36.2813, 126.9118]; // Buyeo Terminal [Lat, Lon]

export default function LeafletMap({
  singlePlace,
  routePlaces = [],
  selectedTransports = [],
  passengers = "1",
  hasLuggage = false,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;

    // 1. Initialize Map Instance (Only once)
    if (!mapInstanceRef.current) {
      // Create map centered near Buyeo center
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([36.275, 126.912], 14);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (!layerGroup) return;

    // Clear previous markers & polylines
    layerGroup.clearLayers();
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Custom marker icon creator utilizing Tailwind CSS
    const createCustomIcon = (emoji: string, label: string, isStart = false) => {
      const colorBg = isStart ? 'bg-brand-navy border-brand-gold text-brand-gold' : 'bg-white border-brand-navy text-brand-navy';
      return L.divIcon({
        html: `
          <div class="flex flex-col items-center select-none" style="transform: translate(-10px, -24px);">
            <div class="px-2 py-1 bg-brand-navy text-white text-[9px] font-black rounded shadow-md border border-brand-gold whitespace-nowrap mb-1">
              ${label}
            </div>
            <div class="flex items-center justify-center w-8 h-8 rounded-full ${colorBg} shadow-lg border-2 animate-scale-up">
              <span class="text-sm">${emoji}</span>
            </div>
            <div class="w-1.5 h-1.5 bg-brand-navy rotate-45 -mt-1 border-r border-b border-brand-gold"></div>
          </div>
        `,
        className: 'custom-leaflet-icon-container',
        iconSize: [32, 45],
        iconAnchor: [16, 40],
      });
    };

    // --- MODE 1: Single Place Detail Map ---
    if (singlePlace) {
      const coords = singlePlace.coords;
      if (coords && Array.isArray(coords) && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        map.setView(coords, 15);

        // Add Marker for single place
        L.marker(coords, {
          icon: createCustomIcon("📍", singlePlace.name)
        })
          .addTo(layerGroup)
          .bindPopup(`<strong>${singlePlace.name}</strong><br><span class="text-xs text-gray-500">${singlePlace.category}</span>`)
          .openPopup();
      }
    }
    // --- MODE 2: Route Planner / Schedule Map ---
    else if (routePlaces.length > 0) {
      const placesInOrder = [...routePlaces];
      const waypoints = [TERMINAL_COORDS, ...placesInOrder.map(p => {
        // If DRT is selected, prioritize drtCoords, else busCoords
        const isDrtSelected = selectedTransports.some(t => t.id === 'drt');
        return isDrtSelected ? p.drtCoords : p.busCoords;
      })].filter(pt => pt && Array.isArray(pt) && pt.length === 2 && !isNaN(pt[0]) && !isNaN(pt[1])) as [number, number][];

      // Add Starting Terminal Marker
      L.marker(TERMINAL_COORDS, {
        icon: createCustomIcon("🚌", "출발: 부여터미널", true)
      })
        .addTo(layerGroup)
        .bindPopup(`<strong>부여시외버스터미널</strong><br><span class="text-xs text-gray-500">여행 출발 정점</span>`);

      // Add Destination Markers
      placesInOrder.forEach((place, index) => {
        const isDrtSelected = selectedTransports.some(t => t.id === 'drt');
        const placeCoords = isDrtSelected ? place.drtCoords : place.busCoords;

        if (placeCoords && Array.isArray(placeCoords) && placeCoords.length === 2 && !isNaN(placeCoords[0]) && !isNaN(placeCoords[1])) {
          L.marker(placeCoords as [number, number], {
            icon: createCustomIcon(
              index === 0 ? "🎯" : "📍", 
              `${index + 1}코스: ${place.name}`
            )
          })
            .addTo(layerGroup)
            .bindPopup(`
              <div class="p-1 space-y-1">
                <h4 class="font-extrabold text-xs text-brand-navy">${place.name}</h4>
                <p class="text-[10px] text-gray-500 font-medium">${place.category}</p>
                ${place.waitingPlace ? `<span class="inline-block bg-amber-50 text-amber-800 text-[8px] font-bold px-1.5 py-0.5 rounded border border-brand-gold/20">대기소: ${place.waitingPlace}</span>` : ''}
              </div>
            `);
        }
      });

      // Construct OSRM Routing URL connecting all waypoints in sequence
      const osrmQueryPoints = waypoints.map(pt => `${pt[1]},${pt[0]}`).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmQueryPoints}?overview=full&geometries=geojson`;

      // Determine styling of path based on selected transit
      let strokeColor = '#047857'; // Green for normal Bus / default
      let isDashed = false;
      let strokeWidth = 5;

      const primaryTransit = selectedTransports[0]?.id || 'bus';
      if (primaryTransit === 'drt') {
        strokeColor = '#d97706'; // Orange
        isDashed = true;
      } else if (primaryTransit === 'taxi' || primaryTransit === 'tourism_taxi') {
        strokeColor = '#1e40af'; // Blue
      } else if (primaryTransit === 'walk') {
        strokeColor = '#dc2626'; // Red for walking
        isDashed = true;
        strokeWidth = 4;
      } else if (primaryTransit === 'ferry' || primaryTransit === 'amphibious') {
        strokeColor = '#06b6d4'; // Cyan for water vessels
      }

      fetch(osrmUrl)
        .then(res => {
          if (!isMounted) return null;
          return res.json();
        })
        .then(data => {
          if (!isMounted || !data || !mapInstanceRef.current) return;
          if (data.routes && data.routes.length > 0) {
            const geomCoordinates = data.routes[0].geometry.coordinates;
            const routeLatLngs = geomCoordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);

            // Draw driving path polyline
            const pathLine = L.polyline(routeLatLngs, {
              color: strokeColor,
              weight: strokeWidth,
              opacity: 0.85,
              dashArray: isDashed ? '6, 8' : undefined,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(mapInstanceRef.current);

            polylineRef.current = pathLine;

            // Fit map bounds safely
            const bounds = pathLine.getBounds();
            if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
              mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
            }
          } else {
            // Fallback to straight lines in case OSRM service is down or invalid
            const fallbackLine = L.polyline(waypoints, {
              color: '#ef4444',
              weight: 4,
              dashArray: '5, 5'
            }).addTo(mapInstanceRef.current);

            polylineRef.current = fallbackLine;
            const bounds = fallbackLine.getBounds();
            if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
              mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
            }
          }
        })
        .catch(err => {
          if (!isMounted || !mapInstanceRef.current) return;
          console.error("OSRM API Fetch failed, drawing fallback straight polylines:", err);
          const fallbackLine = L.polyline(waypoints, {
            color: '#ef4444',
            weight: 4,
            dashArray: '5, 5'
          }).addTo(mapInstanceRef.current);

          polylineRef.current = fallbackLine;
          const bounds = fallbackLine.getBounds();
          if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [singlePlace, routePlaces, selectedTransports]);

  // Clean up Leaflet map instance on unmount to prevent container conflict errors
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-brand-navy/10 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full min-h-[260px] bg-brand-beige/25" />
    </div>
  );
}
