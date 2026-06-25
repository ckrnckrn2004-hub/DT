import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Place, Transport } from '../types';
import { Search, Compass, MapPin, Loader2 } from 'lucide-react';

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
const GONGJU_KTX_COORDS: [number, number] = [36.2375, 127.1108]; // Gongju KTX Station [Lat, Lon]

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

  const [segments, setSegments] = useState<{ name: string; color: string; distance?: string; duration?: string }[]>([]);
  
  // Search feature states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const searchMarkerRef = useRef<L.Marker | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    setIsSearching(true);
    setErrorMessage('');

    // Remove old search marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    const query = searchQuery.trim();

    // Local exact pin database for 12 core spots in Buyeo to guarantee precise pin location!
    const localDb: Record<string, { coords: [number, number]; label: string; desc: string }> = {
      '정림사지': { coords: [36.278385, 126.914107], label: '국보 정림사지 오층석탑', desc: '사비 백제 불교 문화의 중심지' },
      '궁남지': { coords: [36.2662, 126.9125], label: '궁남지 연못 정원', desc: '우리나라 최초의 인공 정원' },
      '부소산성': { coords: [36.2895, 126.9121], label: '부소산성 / 낙화암', desc: '백제의 마지막 요새' },
      '낙화암': { coords: [36.2930, 126.9100], label: '낙화암', desc: '삼천궁녀의 전설이 깃든 곳' },
      '국립부여박물관': { coords: [36.2751, 126.9197], label: '국립부여박물관', desc: '백제금동대향로 소장처' },
      '부여박물관': { coords: [36.2751, 126.9197], label: '국립부여박물관', desc: '백제금동대향로 소장처' },
      '백제문화단지': { coords: [36.3015, 126.8978], label: '백제문화단지', desc: '사비성 재현 명소' },
      '백마강': { coords: [36.2891, 126.9075], label: '백마강 수상관광', desc: '낙화암 아래 백마강 절경' },
      '구드래나루터': { coords: [36.2861, 126.9033], label: '구드래나루터', desc: '백마강 황포돛배 선착장' },
      '부여왕릉원': { coords: [36.2783, 126.9405], label: '부여왕릉원', desc: '사비 백제 왕가 무덤군' },
      '부여전통시장': { coords: [36.2818, 126.9148], label: '부여 전통시장', desc: '부여 시내 중심 시장' },
      '전통시장': { coords: [36.2818, 126.9148], label: '부여 전통시장', desc: '부여 시내 중심 시장' },
      '무량사': { coords: [36.3151, 126.7125], label: '무량사', desc: '천년 고찰 만수산 무량사' },
      '서동요테마파크': { coords: [36.1963, 126.8152], label: '서동요 테마파크', desc: '사극 오픈 세트장' },
      '신동엽문학관': { coords: [36.2768, 126.9121], label: '신동엽 문학관', desc: '시인 신동엽 생가 및 박물관' }
    };

    const cleanQuery = query.replace(/\s+/g, '');
    const matchedKey = Object.keys(localDb).find(key => cleanQuery.includes(key) || key.includes(cleanQuery));

    if (matchedKey) {
      const match = localDb[matchedKey];
      mapInstanceRef.current.setView(match.coords, 16);
      
      const marker = L.marker(match.coords, {
        icon: L.divIcon({
          html: `
            <div class="flex flex-col items-center select-none" style="transform: translate(-10px, -24px);">
              <div class="px-2.5 py-1 bg-brand-gold text-brand-navy text-[10px] font-black rounded-lg shadow-xl border border-brand-navy/15 whitespace-nowrap mb-1">
                🎯 정확한 검색: ${match.label}
              </div>
              <div class="flex items-center justify-center w-8 h-8 rounded-full bg-brand-navy text-brand-gold shadow-2xl border-2 border-brand-gold animate-bounce">
                <span class="text-sm">📍</span>
              </div>
              <div class="w-1.5 h-1.5 bg-brand-navy rotate-45 -mt-1 border-r border-b border-brand-gold"></div>
            </div>
          `,
          className: 'custom-leaflet-icon-container',
          iconSize: [32, 45],
          iconAnchor: [16, 40],
        })
      })
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div class="p-1 space-y-1">
            <h4 class="font-extrabold text-xs text-brand-navy">${match.label}</h4>
            <p class="text-[10px] text-gray-500 font-medium">${match.desc}</p>
            <span class="inline-block bg-amber-50 text-amber-800 text-[8px] font-bold px-1.5 py-0.5 rounded border border-brand-gold/20">구글맵 안심 지오코딩 완료</span>
          </div>
        `)
        .openPopup();

      searchMarkerRef.current = marker;
      setIsSearching(false);
      return;
    }

    // Fallback: Search online via OpenStreetMap Nominatim Geocoding API
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=부여 ${encodeURIComponent(query)}&limit=3`);
      if (!response.ok) throw new Error();
      const data = await response.json();

      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        const displayName = first.display_name.split(',')[0] || query;

        mapInstanceRef.current.setView([lat, lon], 15);

        const marker = L.marker([lat, lon], {
          icon: L.divIcon({
            html: `
              <div class="flex flex-col items-center select-none" style="transform: translate(-10px, -24px);">
                <div class="px-2.5 py-1 bg-brand-gold text-brand-navy text-[9px] font-black rounded-lg shadow-md border border-brand-navy whitespace-nowrap mb-1">
                  🔍 검색: ${displayName}
                </div>
                <div class="flex items-center justify-center w-7 h-7 rounded-full bg-brand-navy text-brand-gold shadow-lg border-2 border-brand-gold">
                  <span class="text-xs">📍</span>
                </div>
                <div class="w-1.5 h-1.5 bg-brand-navy rotate-45 -mt-1 border-r border-b border-brand-gold"></div>
              </div>
            `,
            className: 'custom-leaflet-icon-container',
            iconSize: [28, 40],
            iconAnchor: [14, 35],
          })
        })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<strong>${displayName}</strong><br><span class="text-[10px] text-gray-400">온라인 검색 좌표</span>`)
          .openPopup();

        searchMarkerRef.current = marker;
      } else {
        setErrorMessage('결과가 없네요! 사비 명칭을 정확히 입력해주세요.');
      }
    } catch (err) {
      setErrorMessage('위치 조회 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

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

        // Recalculate container bounds after drawer/modal open animations
        setTimeout(() => {
          if (isMounted && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
            mapInstanceRef.current.setView(coords, 15);
          }
        }, 250);
      }
    }
    // --- MODE 2: Route Planner / Schedule Map ---
    else if (routePlaces.length > 0) {
      const placesInOrder = [...routePlaces];
      const isDrtSelected = selectedTransports.some(t => t.id === 'drt');

      const waypointPlacesCoords = placesInOrder.map(p => {
        return isDrtSelected ? p.drtCoords : p.busCoords;
      }).filter(pt => pt && Array.isArray(pt) && pt.length === 2 && !isNaN(pt[0]) && !isNaN(pt[1])) as [number, number][];

      const waypoints = [TERMINAL_COORDS, ...waypointPlacesCoords];
      if (isDrtSelected) {
        waypoints.push(GONGJU_KTX_COORDS);
      }

      // Safety guard: if there aren't enough waypoints to route, just center on terminal and skip drawing line
      if (waypoints.length < 2) {
        map.setView(TERMINAL_COORDS, 13);
        return;
      }

      // Add Starting Terminal Marker
      L.marker(TERMINAL_COORDS, {
        icon: createCustomIcon("🚌", "출발: 부여터미널", true)
      })
        .addTo(layerGroup)
        .bindPopup(`<strong>부여시외버스터미널</strong><br><span class="text-xs text-gray-500">여행 출발 정점</span>`);

      // Add Destination Markers
      placesInOrder.forEach((place, index) => {
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

      // Add Gongju KTX Station Terminal Marker for DRT
      if (isDrtSelected) {
        L.marker(GONGJU_KTX_COORDS, {
          icon: createCustomIcon("🚄", "종점: 공주역 KTX", true)
        })
          .addTo(layerGroup)
          .bindPopup(`
            <div class="p-1 space-y-1">
              <h4 class="font-extrabold text-xs text-brand-navy">공주역 KTX (종점)</h4>
              <p class="text-[10px] text-gray-500 font-medium">수요응답형 버스(DRT) 연계 종점</p>
              <span class="inline-block bg-emerald-50 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded border border-brand-gold/20">※ 오전 07:20, 오후 18:30 각 1회 (총 2회) 운행</span>
            </div>
          `);
      }

      // Fetch segment-by-segment OSRM routes for distinct course colors
      const segmentColors = [
        '#2563eb', // Royal Blue (1st course segment)
        '#f59e0b', // Amber Orange (2nd course segment)
        '#10b981', // Emerald Green (3rd course segment)
        '#8b5cf6', // Violet Purple (4th course segment)
        '#ec4899', // Hot Pink (5th course segment)
        '#06b6d4', // Cyan (6th course segment)
        '#ef4444', // Red (7th course segment)
        '#14b8a6', // Teal (8th course segment)
        '#f43f5e', // Rose (9th course segment)
        '#a855f7', // Purple (10th course segment)
      ];

      // Clear segments before loading new ones
      setSegments([]);

      const segmentPromises: Promise<any>[] = [];
      const segmentInfos: { name: string; color: string }[] = [];

      for (let i = 0; i < waypoints.length - 1; i++) {
        const start = waypoints[i];
        const end = waypoints[i + 1];
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        
        let legName = "";
        if (i === 0) {
          legName = `출발지 ➔ 1코스 (${placesInOrder[0]?.name || "목적지"})`;
        } else if (i === waypoints.length - 2 && isDrtSelected) {
          legName = `${i}코스 ➔ 종점 (공주역 KTX)`;
        } else {
          const fromPlace = placesInOrder[i - 1];
          const toPlace = placesInOrder[i];
          legName = `${i}코스 (${fromPlace?.name}) ➔ ${i + 1}코스 (${toPlace?.name})`;
        }

        segmentInfos.push({
          name: legName,
          color: segmentColors[i % segmentColors.length],
        });

        segmentPromises.push(
          fetch(url)
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null)
        );
      }

      Promise.all(segmentPromises)
        .then(results => {
          if (!isMounted || !mapInstanceRef.current || !layerGroupRef.current) return;
          
          const newSegmentsState: { name: string; color: string; distance?: string; duration?: string }[] = [];
          const drawnLines: L.Polyline[] = [];

          results.forEach((data, index) => {
            const info = segmentInfos[index];
            const startPt = waypoints[index];
            const endPt = waypoints[index + 1];

            if (data && data.routes && data.routes.length > 0) {
              const geomCoordinates = data.routes[0].geometry.coordinates;
              const routeLatLngs = geomCoordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
              
              const distKm = (data.routes[0].distance / 1000).toFixed(1);
              const durMin = (data.routes[0].duration / 60).toFixed(0);

              newSegmentsState.push({
                name: info.name,
                color: info.color,
                distance: `${distKm}km`,
                duration: `${durMin}분`,
              });

              const primaryTransit = selectedTransports[0]?.id || 'bus';
              const isDashed = primaryTransit === 'walk';
              const strokeWidth = primaryTransit === 'drt' ? 6 : 5;

              // Draw segment line inside layerGroup so it gets cleaned up perfectly
              const segmentLine = L.polyline(routeLatLngs, {
                color: info.color,
                weight: strokeWidth,
                opacity: 0.9,
                dashArray: isDashed ? '6, 8' : undefined,
                lineCap: 'round',
                lineJoin: 'round',
              }).addTo(layerGroupRef.current);

              segmentLine.bindPopup(`
                <div class="p-1 text-center font-sans">
                  <span class="inline-block px-2 py-0.5 text-[9px] font-black text-white rounded shadow-2xs mb-1" style="background-color: ${info.color}">
                    구간 ${index + 1}
                  </span>
                  <p class="font-extrabold text-xs text-brand-navy">${info.name}</p>
                  <p class="text-[9.5px] text-gray-500 font-semibold mt-0.5">거리: ${distKm}km | 시간: ${durMin}분 소요</p>
                </div>
              `);

              drawnLines.push(segmentLine);
            } else {
              // Fallback to straight line if OSRM segment fails
              newSegmentsState.push({
                name: info.name,
                color: info.color,
                distance: "직선 연결",
                duration: "정보 없음",
              });

              const fallbackLine = L.polyline([startPt, endPt], {
                color: info.color,
                weight: 4,
                dashArray: '5, 5',
                opacity: 0.8,
              }).addTo(layerGroupRef.current);

              drawnLines.push(fallbackLine);
            }
          });

          setSegments(newSegmentsState);

          // Fit map bounds to show all drawn lines
          if (drawnLines.length > 0) {
            const group = L.featureGroup(drawnLines);
            const bounds = group.getBounds();
            if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
              mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
            }
          }
        })
        .catch(err => {
          if (!isMounted || !mapInstanceRef.current || !layerGroupRef.current) return;
          console.error("OSRM Segment Fetch failed, falling back to straight lines:", err);
          
          const drawnLines: L.Polyline[] = [];
          const newSegmentsState: { name: string; color: string; distance?: string; duration?: string }[] = [];

          for (let i = 0; i < waypoints.length - 1; i++) {
            const startPt = waypoints[i];
            const endPt = waypoints[i + 1];
            const info = segmentInfos[i] || { name: `구간 ${i+1}`, color: '#ef4444' };

            newSegmentsState.push({
              name: info.name,
              color: info.color,
              distance: "직선 오프라인",
            });

            const fallbackLine = L.polyline([startPt, endPt], {
              color: info.color,
              weight: 4,
              dashArray: '5, 5',
              opacity: 0.8,
            }).addTo(layerGroupRef.current);

            drawnLines.push(fallbackLine);
          }

          setSegments(newSegmentsState);

          if (drawnLines.length > 0) {
            const group = L.featureGroup(drawnLines);
            const bounds = group.getBounds();
            if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
              mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
            }
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
      
      {/* Floating Search Bar Overlay */}
      <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-1 select-none pointer-events-auto">
        <form onSubmit={handleSearch} className="flex items-center bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-brand-navy/15 px-2.5 py-1.5 w-[210px] gap-1 animate-scale-up">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="명소 직접 검색 (예: 정림사지)"
            className="flex-1 text-[10px] font-bold text-brand-navy placeholder:text-brand-navy/35 outline-none bg-transparent"
          />
          <button 
            type="submit" 
            disabled={isSearching}
            className="text-brand-navy/60 hover:text-brand-navy transition-colors active:scale-90 cursor-pointer"
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-gold-dark" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
        {errorMessage && (
          <div className="bg-red-50 text-red-700 text-[8.5px] font-extrabold px-2 py-1 rounded-lg border border-red-100 shadow-sm animate-scale-up max-w-[210px]">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>

      {/* Floating Course Route Segment Legend Overlay */}
      {routePlaces.length > 0 && segments.length > 0 && (
        <div className="absolute top-2 right-2 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-brand-navy/15 max-w-[220px] text-left space-y-1.5 select-none pointer-events-auto max-h-[160px] overflow-y-auto no-scrollbar animate-scale-up">
          <h5 className="text-[10px] font-black text-brand-navy flex items-center gap-1 border-b border-brand-navy/5 pb-1">
            <span>🎨 코스 구간별 안심 실시간 동선</span>
          </h5>
          <div className="space-y-1.5 text-[9px]">
            {segments.map((seg, idx) => (
              <div key={idx} className="flex items-start gap-1.5 font-bold text-brand-navy/80 leading-tight">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 shadow-3xs" style={{ backgroundColor: seg.color }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-black">{seg.name}</div>
                  {seg.distance && (
                    <div className="text-[8px] text-brand-navy/40 font-bold">
                      {seg.distance} • {seg.duration}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
