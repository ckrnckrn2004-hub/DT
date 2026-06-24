import React, { useState, useMemo } from 'react';
import {
  Home,
  MapPin,
  Compass,
  Bus,
  ClipboardCheck,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  CloudRain,
  Footprints,
  Info,
  Navigation,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  X
} from 'lucide-react';

import { REGIONS, buyeoDb, TRANSPORTS, WAITING_SPOTS } from './data';
import { Place, Transport, PlaceFilters, TransitFilters, WaitingSpot } from './types';
import LeafletMap from './components/LeafletMap';

export default function App() {
  // Tab states: 'home' | 'places' | 'transit' | 'summary' | 'schedule'
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedRegion, setSelectedRegion] = useState<any>(REGIONS[0]); // default to Buyeo
  
  // Custom vehicle ownership state (Step 1 from first app)
  const [hasCar, setHasCar] = useState<boolean>(false);
  
  // Custom weather setting (can be Sunny or Rainy to showcase weather sensitive scoring!)
  const [isRainyDay, setIsRainyDay] = useState<boolean>(false);

  // Selected places and transports (multi-select from second app)
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [selectedTransports, setSelectedTransports] = useState<string[]>([]);

  // Detailed Modal states
  const [activePlaceModal, setActivePlaceModal] = useState<{ place: Place; mode: 'summary' | 'deep' } | null>(null);
  const [activeTransportModal, setActiveTransportModal] = useState<{ transport: Transport; mode: 'summary' | 'deep' } | null>(null);

  // Environment options (Step 3 from first app)
  const [passengers, setPassengers] = useState<string>("2");
  const [hasLuggage, setHasLuggage] = useState<boolean>(true);

  // Filter states
  const [placeFilters, setPlaceFilters] = useState<PlaceFilters>({
    weather: [],
    themes: [],
    walking: [],
    stay: [],
    indoor: '상관없음'
  });

  const [transitFilters, setTransitFilters] = useState<TransitFilters>({
    people: [],
    budget: [],
    reservation: '상관없음',
    type: [],
    walking: [],
    weather: '상관없음'
  });

  // Reset all filters
  const resetPlaceFilters = () => {
    setPlaceFilters({
      weather: [],
      themes: [],
      walking: [],
      stay: [],
      indoor: '상관없음'
    });
  };

  const resetTransitFilters = () => {
    setTransitFilters({
      people: [],
      budget: [],
      reservation: '상관없음',
      type: [],
      walking: [],
      weather: '상관없음'
    });
  };

  // Toggle selection helpers
  const togglePlaceSelection = (placeId: string) => {
    setSelectedPlaces(prev =>
      prev.includes(placeId) ? prev.filter(id => id !== placeId) : [...prev, placeId]
    );
  };

  const toggleTransportSelection = (transportId: string) => {
    // If hasCar is true, we force CAR selection, otherwise we toggle
    if (hasCar) {
      setSelectedTransports(['walk', 'taxi']); // default walking + taxi
      return;
    }
    setSelectedTransports(prev =>
      prev.includes(transportId) ? prev.filter(id => id !== transportId) : [...prev, transportId]
    );
  };

  // Presets trigger from Home Tab
  const applyPreset = (presetType: 'rainy' | 'photo' | 'easy') => {
    resetPlaceFilters();
    setSelectedRegion(REGIONS[0]); // Buyeo
    setHasCar(false); // Make them 뚜벅이 for full multi-modal transport demonstration

    if (presetType === 'rainy') {
      setIsRainyDay(true);
      // Auto-select Indoor places (National Museum, Shindongyeop Literature, Traditional Market)
      setSelectedPlaces(['buyeomuseum', 'shindongyeop', 'buyeomarket']);
      setSelectedTransports(['taxi', 'drt']);
      setPlaceFilters(prev => ({
        ...prev,
        indoor: '실내',
        weather: ['비']
      }));
    } else if (presetType === 'photo') {
      setIsRainyDay(false);
      // Auto-select scenic places (Gungnamji, Busosanseong, Baekje Culture Land, Ferry)
      setSelectedPlaces(['gungnamji', 'busosanseong', 'baekmagangwater', 'gudraenaru']);
      setSelectedTransports(['ferry', 'walk']);
      setPlaceFilters(prev => ({
        ...prev,
        themes: ['사진', '자연']
      }));
    } else if (presetType === 'easy') {
      setIsRainyDay(false);
      // Auto-select low physical load places (Jeonglimsaji, Museum, Market)
      setSelectedPlaces(['jeonglimsaji', 'buyeomuseum', 'buyeomarket']);
      setSelectedTransports(['taxi', 'walk']);
      setPlaceFilters(prev => ({
        ...prev,
        walking: ['적음']
      }));
    }

    setActiveTab('places');
  };

  // Run a roulette generator to pick a random spot
  const runSpotRoulette = () => {
    const keys = Object.keys(buyeoDb);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const chosenPlace = (buyeoDb as any)[randomKey];
    
    // Toggle the place selection to have this chosen spot selected!
    if (!selectedPlaces.includes(chosenPlace.id)) {
      setSelectedPlaces(prev => [...prev, chosenPlace.id]);
    }
    setActivePlaceModal({ place: chosenPlace, mode: 'summary' });
  };

  // Calculate matching scores for places dynamically based on filters + real-time weather
  const placeWithScores = useMemo(() => {
    return Object.values(buyeoDb).map(place => {
      let score = 60;
      let reasons: string[] = [];

      // If active weather is rainy
      if (isRainyDay) {
        if (place.isIndoor) {
          score += 25;
          reasons.push("☔ 비 오는 날 쾌적하게 비를 피하며 감상할 수 있는 고품격 실내 공간입니다.");
        } else {
          score -= 20;
          reasons.push("⚠️ 비 오는 야외 흙길 산책로로 관람 시 다소 우산 지참 및 불편할 수 있습니다.");
        }
      } else {
        if (!place.isIndoor) {
          score += 15;
          reasons.push("☀️ 맑고 선선한 하늘 아래, 기분 좋게 주변 야외 경관을 보며 걷기 좋습니다.");
        }
      }

      // Filter: themes
      if (placeFilters.themes.length > 0) {
        const matches = placeFilters.themes.filter(t => place.themes.includes(t));
        if (matches.length > 0) {
          score += matches.length * 10;
          reasons.push(`💡 원하시는 테마 (#${matches.join(', #')})를 풍부하게 갖춘 맞춤형 스팟입니다.`);
        }
      }

      // Filter: walking load
      if (placeFilters.walking.length > 0) {
        if (placeFilters.walking.includes('적음') && place.walkingLoad === '적음') {
          score += 15;
          reasons.push("🚶‍♂️ 코스가 평탄하고 짧아, 어린이나 부모님과 함께 오래 걷지 않고 편히 보기 적합합니다.");
        } else if (placeFilters.walking.includes('적음') && place.walkingLoad === '많음') {
          score -= 20;
          reasons.push("⚠️ 가파른 산길이나 오르막 계단 보행량이 높아, 뚜벅이 체력 부담이 큽니다.");
        }
      }

      // Filter: stay duration
      if (placeFilters.stay.length > 0) {
        if (placeFilters.stay.includes('짧게') && place.stayMinutes <= 60) {
          score += 10;
          reasons.push("⏰ 1시간 이내의 가벼운 탐방 코스로, 짧은 일정 내에 묶어 가기 딱 좋습니다.");
        } else if (placeFilters.stay.includes('길게') && place.stayMinutes >= 120) {
          score += 10;
          reasons.push("🖼️ 볼거리가 웅장하고 깊이가 있어, 느긋하게 2시간 이상 시간을 쏟기 알맞습니다.");
        }
      }

      // Filter: indoor/outdoor
      if (placeFilters.indoor !== '상관없음') {
        if (placeFilters.indoor === '실내' && place.isIndoor) {
          score += 15;
          reasons.push("🏛️ 쾌적한 냉난방 실내 구역으로, 안심하고 관람할 수 있습니다.");
        } else if (placeFilters.indoor === '야외' && !place.isIndoor) {
          score += 15;
          reasons.push("🌲 백마강 바람과 푸른 나무 등 시원한 야외 풍경을 그대로 마주하는 힐링 구역입니다.");
        }
      }

      const finalScore = Math.max(0, Math.min(100, score));
      const reason = reasons[reasons.length - 1] || "부여 사비백제 고유의 역사와 낭만을 풍부하게 느낄 수 있는 대표 랜드마크입니다.";

      return {
        ...place,
        score: finalScore,
        reason
      };
    }).sort((a, b) => b.score - a.score);
  }, [placeFilters, isRainyDay]);

  // Filtered transports based on car ownership and user preferences
  const filteredTransports = useMemo(() => {
    let list = TRANSPORTS;

    // IF user has a car, we enforce a simple custom set or highly recommend driving path
    if (hasCar) {
      list = TRANSPORTS.filter(t => t.id === 'walk' || t.id === 'taxi' || t.id === 'tourism_taxi');
    }

    return list.map(transport => {
      let score = 100;

      if (transitFilters.people.length > 0) {
        let ok = false;
        if (transitFilters.people.includes('1명') && transport.minPeople <= 1 && transport.maxPeople >= 1) ok = true;
        if (transitFilters.people.includes('2명') && transport.minPeople <= 2 && transport.maxPeople >= 2) ok = true;
        if (transitFilters.people.includes('3~4명') && transport.minPeople <= 4 && transport.maxPeople >= 3) ok = true;
        if (transitFilters.people.includes('단체') && transport.maxPeople >= 5) ok = true;
        score += ok ? 10 : -25;
      }

      if (transitFilters.budget.length > 0) {
        let isLow = transitFilters.budget.includes('낮음');
        let isMed = transitFilters.budget.includes('보통');
        let isHigh = transitFilters.budget.includes('여유');
        let match = false;
        if (isLow && transport.costLevel === '낮음') match = true;
        if (isMed && transport.costLevel === '보통') match = true;
        if (isHigh && transport.costLevel === '높음') match = true;
        score += match ? 15 : -15;
      }

      if (transitFilters.type.length > 0) {
        let isMatch = false;
        if (transitFilters.type.includes('일반이동') && (transport.type === 'general' || transport.type === 'localTransit' || transport.type === 'taxi')) isMatch = true;
        if (transitFilters.type.includes('관광형') && transport.type === 'tourTransport') isMatch = true;
        if (transitFilters.type.includes('예약형') && transport.type === 'reservation') isMatch = true;
        if (transitFilters.type.includes('대안코스') && transport.type === 'fixedCourse') isMatch = true;
        score += isMatch ? 15 : -20;
      }

      if (transitFilters.walking.length > 0) {
        score += transitFilters.walking.some(w => transport.walkingBurden === w) ? 10 : -10;
      }

      return {
        ...transport,
        score: Math.max(0, Math.min(100, score))
      };
    }).sort((a, b) => b.score - a.score);
  }, [transitFilters, hasCar]);

  // Selected full objects list
  const activeSelectedPlacesList = useMemo(() => {
    return Object.values(buyeoDb).filter(p => selectedPlaces.includes(p.id)) as Place[];
  }, [selectedPlaces]);

  const activeSelectedTransportsList = useMemo(() => {
    return TRANSPORTS.filter(t => selectedTransports.includes(t.id));
  }, [selectedTransports]);

  // Hybrid Analysis Report (Step 4 report calculation from first app but advanced)
  const analysisReportText = useMemo(() => {
    if (activeSelectedPlacesList.length === 0) {
      return "방문하실 관광명소를 <b>[명소선택]</b> 탭에서 최소 1개 이상 담아주셔야 분석 보고서가 생성됩니다.";
    }

    const firstPlace = activeSelectedPlacesList[0];
    const placeName = firstPlace.name;
    const waitingPlace = firstPlace.waitingPlace || "인근 한옥 카페 쉼터";

    // Scenario A: Has personal car or selected car directly
    if (hasCar) {
      return `🚗 자차 이동 모드에 따른 부여 전용 도로망 매칭이 완료되었습니다. 출발지(부여시외버스터미널) 기점에서 목적지인 <b>[${placeName} 전용 지상 주차선]</b> 및 실시간 교통 상황을 안전하게 매핑했습니다. 무료 서동공원 지상 주차장 진입로 연계 가이드라인을 활성화해 주십시오.`;
    }

    const primaryTransitId = selectedTransports[0] || 'walk';

    // Scenario B: DRT (Shuckle) selected
    if (primaryTransitId === 'drt') {
      return `✨ 시내 하방 대중교통 배차 사각지대 공백이 감지되어, 맞춤형 <b>수요응답형 콜버스 (DRT 셔클)</b> 사전 예약을 즉시 연계해 드립니다. <b>${passengers}인</b> 탑승 환경에 맞춰, 추위나 비를 피할 수 있는 안전 픽업 구역인 <b>[${waitingPlace}]</b> 내에서 대기해 주세요. 배차가 완료되면 카카오 알림톡이 전송됩니다.`;
    }

    // Scenario C: Bus selected
    if (primaryTransitId === 'bus') {
      return `🚌 정규 노선 시내버스를 통한 정방향 간선축 매칭이 완료되었습니다. <b>${passengers}인</b> 뚜벅이 여행 및 <b>${hasLuggage ? '큰 짐 있음 💼' : '짐 가벼움'}</b> 환경에 맞춰 정류장 접근 경로를 설계했습니다. 배차 간격이 다소 기므로 출발 전 버스 도착 시간 앱을 꼭 확인해 주시기 바랍니다.`;
    }

    // Scenario D: Taxi selected
    if (primaryTransitId === 'taxi' || primaryTransitId === 'tourism_taxi') {
      return `🚕 <b>${passengers}인</b> 동행 인원 조건에 최적화된 택시 문전 연결형(Door to Door) 매칭이 완료되었습니다. 부여 읍내 구역은 기본 요금(약 3,500원 ~ 5,500원) 수준으로 신속히 이동하여 한낮 폭염이나 비바람 피로도를 전면 차단합니다.`;
    }

    // Scenario E: Ferry / Water Vessel
    if (primaryTransitId === 'ferry' || primaryTransitId === 'amphibious') {
      return `⛵ 백마강 황포돛배(또는 수륙양용버스)를 연계한 낭만적인 이색 물길 코스가 매핑되었습니다. 구드래나루터 선착장 매표소에서 후문 고란사나루터 방향 편도 궤적을 이용하여 부소산성 계단 오르막 도보 하중을 70% 이상 경감해 주십시오. (우천/강풍 시 선착장 결항 전화를 아침에 필수로 확인하세요!)`;
    }

    // Default Walk
    return `👣 <b>${passengers}인</b> 뚜벅이 도보 지름길 가이드가 매칭되었습니다. 정림사지에서 문학관, 시장 골목으로 이어지는 읍내 핵심 플랫 라인은 도보 10분 안팎으로 평탄하여 안전하고 유유자적하게 부여 고유의 역사 공기를 호흡하기 좋습니다.`;
  }, [activeSelectedPlacesList, selectedTransports, hasCar, passengers, hasLuggage]);

  // Clear all and return to home page
  const resetAllAndGoHome = () => {
    setSelectedPlaces([]);
    setSelectedTransports([]);
    setHasCar(false);
    setIsRainyDay(false);
    resetPlaceFilters();
    resetTransitFilters();
    setActiveTab('home');
  };

  return (
    <div className="min-h-screen bg-brand-beige flex flex-col items-center pb-24 text-brand-navy">
      <div className="w-full max-w-md bg-brand-cream min-h-screen shadow-lg flex flex-col relative border-x border-brand-navy/5">
        
        {/* HEADER */}
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-brand-navy/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setActiveTab('home')}>
            <div className="bg-brand-navy text-brand-gold p-1.5 rounded-xl shadow-md flex items-center justify-center">
              <Compass className="w-5 h-5 animate-pulse text-brand-gold" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-brand-navy tracking-tight m-0 leading-none">
                로컬잇다 <span className="text-brand-gold font-black">충청</span>
              </h1>
              <span className="text-[10px] text-brand-navy/60 font-semibold tracking-wider block">
                BUYEO SMART TOUR LINK
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-brand-navy/5 text-brand-navy px-3 py-1 rounded-full text-xs font-semibold border border-brand-navy/5">
            <MapPin className="w-3.5 h-3.5 text-brand-gold" />
            <span>{selectedRegion ? `충남 ${selectedRegion.name}` : "지역선택"}</span>
          </div>
        </header>

        {/* MAIN BODY CONTENT */}
        <main className="flex-1 p-4 space-y-6">

          {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Hero Showcase Card */}
              <div className="bg-brand-navy text-white rounded-3xl p-6 relative overflow-hidden shadow-lg border border-brand-gold/10">
                <div className="absolute right-[-20px] bottom-[-20px] w-40 h-40 bg-brand-gold/15 rounded-full blur-2xl" />
                <span className="text-[10px] text-brand-gold font-bold tracking-wider uppercase bg-brand-gold/10 px-2.5 py-1 rounded-full border border-brand-gold/20 inline-block mb-3">
                  부여 스마트 뚜벅이 연계 솔루션
                </span>
                <h2 className="text-2xl font-black tracking-tight leading-tight mb-2">
                  가고 싶은 유적지를,<br />차 없이 갈 수 있는 여행으로.
                </h2>
                <p className="text-xs text-white/70 leading-relaxed max-w-[95%] mb-5">
                  정규 노선버스의 배차 공백, 한낮 땡볕 무릎 부하를 해결하는 맞춤형 틈새 교통 매칭 가이드 서비스입니다.
                </p>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => setActiveTab('places')}
                    className="w-full bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-xs font-extrabold py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer select-none"
                  >
                    <span>부여 여행 여정 설계 시작하기</span>
                    <ArrowRight className="w-4.5 h-4.5" />
                  </button>
                  
                  <button 
                    onClick={runSpotRoulette}
                    className="w-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold py-2.5 rounded-xl border border-white/20 transition-all cursor-pointer"
                  >
                    🎲 어디 갈지 복불복 명소 뽑기 룰렛
                  </button>
                </div>
              </div>

              {/* Step 1: Vehicle Environment Setting (Brought from first app) */}
              <div className="bg-white border border-brand-navy/10 rounded-3xl p-5 shadow-2xs space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-brand-navy flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-brand-gold" />
                    <span>차량을 가지고 오셨나요?</span>
                  </h3>
                  <p className="text-[10px] text-brand-navy/55">
                    교통수단 소유 여부에 따라 명소 맞춤 정보와 추천 교통수단이 자동 필터링됩니다.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2.5 text-xs font-bold">
                  <button 
                    onClick={() => {
                      setHasCar(true);
                      setSelectedTransports(['taxi']); // Default select taxi or car actions
                    }} 
                    className={`py-4 rounded-2xl border-2 text-center transition-all shadow-xs cursor-pointer ${hasCar ? 'border-brand-navy bg-brand-navy/5 text-brand-navy font-black' : 'border-brand-navy/10 bg-white text-brand-navy/60'}`}
                  >
                    🚗 차량 가져왔음
                  </button>
                  <button 
                    onClick={() => {
                      setHasCar(false);
                      setSelectedTransports(['walk']);
                    }} 
                    className={`py-4 rounded-2xl border-2 text-center transition-all shadow-xs cursor-pointer ${!hasCar ? 'border-brand-navy bg-brand-navy/5 text-brand-navy font-black' : 'border-brand-navy/10 bg-white text-brand-navy/60'}`}
                  >
                    🚖 대중교통 뚜벅이
                  </button>
                </div>
              </div>

              {/* Weather Toggle (Showcase real-time updates) */}
              <div className="bg-brand-cream border border-brand-gold/15 rounded-3xl p-5 shadow-2xs space-y-3.5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-brand-navy uppercase tracking-wider flex items-center gap-1.5">
                    {isRainyDay ? <CloudRain className="w-4 h-4 text-blue-500" /> : <Sun className="w-4 h-4 text-brand-gold animate-spin-slow" />}
                    <span>실시간 부여 기상 여건 반영</span>
                  </h3>
                  <button 
                    onClick={() => setIsRainyDay(!isRainyDay)}
                    className="text-[9.5px] bg-brand-navy text-white px-2.5 py-1 rounded-xl font-bold cursor-pointer"
                  >
                    {isRainyDay ? "☀️ 맑은 날씨로 변경" : "☔ 비 오는 날로 변경"}
                  </button>
                </div>
                
                <p className="text-[11px] leading-relaxed font-semibold">
                  {isRainyDay ? (
                    <span className="text-blue-900">☔ 현재 부여에 비가 오고 있어, 수해 피해 방지 및 도보 하중 경감을 위해 <b>실내 박물관과 쌈밥 맛집</b> 매칭 비율을 200% 상향했습니다.</span>
                  ) : (
                    <span className="text-brand-navy/80">☀️ 오늘 부여 날씨는 야외 유적 관람 및 도보 탐방에 완벽한 기후입니다. 낙화암 및 궁남지 버드나무 산책길을 추천합니다.</span>
                  )}
                </p>
              </div>

              {/* Rapid Scenario Presets */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-brand-navy flex items-center gap-1.5 pl-1">
                  <Sparkles className="w-4 h-4 text-brand-gold" />
                  <span>원클릭 상황별 추천 부여 투어</span>
                </h3>
                
                <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                  <button 
                    onClick={() => applyPreset('rainy')}
                    className="bg-white hover:bg-blue-50 border border-brand-navy/10 rounded-2xl p-3.5 transition-all cursor-pointer flex flex-col items-center space-y-2 shadow-3xs"
                  >
                    <span className="text-2xl select-none">☔</span>
                    <span className="font-extrabold text-brand-navy text-[11px] leading-tight">비 오는 날<br />실내 코스</span>
                  </button>

                  <button 
                    onClick={() => applyPreset('photo')}
                    className="bg-white hover:bg-yellow-50 border border-brand-navy/10 rounded-2xl p-3.5 transition-all cursor-pointer flex flex-col items-center space-y-2 shadow-3xs"
                  >
                    <span className="text-2xl select-none">📸</span>
                    <span className="font-extrabold text-brand-navy text-[11px] leading-tight">인스타 감성<br />사진 명소</span>
                  </button>

                  <button 
                    onClick={() => applyPreset('easy')}
                    className="bg-white hover:bg-green-50 border border-brand-navy/10 rounded-2xl p-3.5 transition-all cursor-pointer flex flex-col items-center space-y-2 shadow-3xs"
                  >
                    <span className="text-2xl select-none">🚶‍♂️</span>
                    <span className="font-extrabold text-brand-navy text-[11px] leading-tight">도보 최소화<br />실속 코스</span>
                  </button>
                </div>
              </div>

              {/* Character Description */}
              <div className="bg-brand-cream border border-brand-gold/10 rounded-2xl p-4.5 text-[11px] leading-relaxed text-brand-navy/80 flex gap-2.5">
                <Info className="w-4.5 h-4.5 text-brand-gold shrink-0 mt-0.5" />
                <p>
                  <strong>로컬잇다 충청 안내:</strong> 여러분이 가고 싶은 부여의 명소들을 다수 담은 뒤, 선호하는 틈새 교통수단을 결합하면 <b>실시간 OSRM 경로 지도</b>와 <b>대기실 안심 지침서</b>가 포함된 완벽한 일정을 완성할 수 있습니다!
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: PLACES SELECTION */}
          {activeTab === 'places' && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <span className="text-xs text-brand-gold-dark font-black tracking-wider uppercase">STEP 02</span>
                <h2 className="text-xl font-black tracking-tight text-brand-navy">부여 관광명소 다중 선택</h2>
                <p className="text-xs text-brand-navy/60">
                  가고 싶은 부여의 유적지들을 마음껏 골라 후보 리스트에 담아보세요.
                </p>
              </div>

              {/* Place Filter Accordion Block */}
              <div className="bg-brand-cream border border-brand-navy/10 rounded-3xl p-4 shadow-2xs space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-brand-navy/5 pb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-brand-navy">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
                    <span>지능형 명소 필터링</span>
                  </div>
                  {(placeFilters.themes.length > 0 || placeFilters.walking.length > 0 || placeFilters.stay.length > 0 || placeFilters.indoor !== '상관없음') && (
                    <button 
                      onClick={resetPlaceFilters}
                      className="text-[9.5px] text-red-500 font-bold bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      🔄 필터 초기화
                    </button>
                  )}
                </div>

                {/* Theme multiselect */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-brand-navy/40 font-bold uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-brand-gold" /> 선호하는 여행 테마
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["역사", "사진", "자연", "체험", "가족", "실내"].map(theme => {
                      const active = placeFilters.themes.includes(theme);
                      return (
                        <button
                          key={theme}
                          onClick={() => setPlaceFilters(prev => ({
                            ...prev,
                            themes: active ? prev.themes.filter(t => t !== theme) : [...prev.themes, theme]
                          }))}
                          className={`px-2.5 py-1 rounded-lg font-bold border text-[10px] transition-all cursor-pointer ${active ? 'bg-brand-gold border-brand-gold text-brand-navy' : 'bg-white text-brand-navy/70 border-brand-navy/10'}`}
                        >
                          #{theme}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Other Filter Items */}
                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-brand-navy/5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-brand-navy/40 font-bold uppercase flex items-center gap-1">
                      <Footprints className="w-3 h-3 text-brand-navy" /> 걷기 하중
                    </label>
                    <div className="flex gap-1">
                      {["적음", "보통", "많음"].map(load => {
                        const active = placeFilters.walking.includes(load);
                        return (
                          <button
                            key={load}
                            onClick={() => setPlaceFilters(prev => ({
                              ...prev,
                              walking: active ? prev.walking.filter(w => w !== load) : [...prev.walking, load]
                            }))}
                            className={`flex-1 py-1 rounded border text-[9.5px] font-bold transition-all cursor-pointer ${active ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-brand-navy/60 border-brand-navy/10'}`}
                          >
                            {load}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-brand-navy/40 font-bold uppercase flex items-center gap-1">
                      <Clock className="w-3 h-3 text-brand-navy" /> 실내 대피 선호
                    </label>
                    <div className="flex gap-1">
                      {["상관없음", "실내", "야외"].map(opt => {
                        const active = placeFilters.indoor === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => setPlaceFilters(prev => ({
                              ...prev,
                              indoor: opt as any
                            }))}
                            className={`flex-1 py-1 rounded border text-[9.5px] font-bold transition-all cursor-pointer ${active ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-brand-navy/60 border-brand-navy/10'}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Header */}
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-brand-navy/50">
                  선택한 명소: <b className="text-brand-gold-dark font-black">{selectedPlaces.length}개</b> 담김
                </span>
                {selectedPlaces.length > 0 && (
                  <button 
                    onClick={() => setSelectedPlaces([])}
                    className="text-[10px] text-red-500 font-bold bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    🧹 전체 선택 취소
                  </button>
                )}
              </div>

              {/* Place List Cards */}
              <div className="grid grid-cols-1 gap-4">
                {placeWithScores.map(item => {
                  const isSelected = selectedPlaces.includes(item.id);
                  return (
                    <div key={item.id}>
                      <SinglePlaceCard 
                        place={item as Place} 
                        score={item.score}
                        reason={item.reason}
                        isSelected={isSelected}
                        onCardClick={() => setActivePlaceModal({ place: item as Place, mode: 'summary' })}
                        onSelectToggle={() => togglePlaceSelection(item.id)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Bottom Next Button */}
              <button 
                onClick={() => setActiveTab('transit')}
                className="w-full bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>3단계: 이동수단 매칭으로 가기 ({selectedPlaces.length}개 담김)</span>
                <ArrowRight className="w-4.5 h-4.5 text-brand-gold animate-bounce-right" />
              </button>
            </div>
          )}

          {/* TAB 3: TRANSIT SELECTION */}
          {activeTab === 'transit' && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <span className="text-xs text-brand-gold-dark font-black tracking-wider uppercase">STEP 03</span>
                <h2 className="text-xl font-black tracking-tight text-brand-navy">맞춤 틈새 교통수단 선택</h2>
                <p className="text-xs text-brand-navy/60">
                  동행 인원과 가방 무개에 딱 알맞는 교통수단을 복수로 선택해 안심노선을 짜보세요.
                </p>
              </div>

              {/* Environment Selection Widget (Step 3 custom widget from first app) */}
              <div className="bg-brand-cream border border-brand-gold/15 rounded-3xl p-4.5 shadow-2xs space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-brand-navy text-xs flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-brand-gold" />
                    <span>세부 이동 동행자 환경 정의</span>
                  </h3>
                  <span className="text-[8px] bg-brand-gold text-brand-navy font-bold px-2 py-0.5 rounded uppercase tracking-wider">안동안심</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-brand-navy/40 font-bold uppercase">탑승 인원 수</label>
                    <select 
                      value={passengers} 
                      onChange={(e) => setPassengers(e.target.value)}
                      className="w-full bg-white border border-brand-navy/10 rounded-xl px-2 py-2 font-bold text-brand-navy text-[11px] outline-none focus:border-brand-navy cursor-pointer"
                    >
                      <option value="1">🙋‍♂️ 1인 (혼자 여행)</option>
                      <option value="2">👥 2인 (동행 연인/친구)</option>
                      <option value="3">👪 3~4인 (가족 투어)</option>
                      <option value="5">🚌 5인 이상 (단체 투어)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-brand-navy/40 font-bold uppercase">수하물/캐리어 여부</label>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => setHasLuggage(true)}
                        className={`flex-1 py-2 text-center rounded-xl font-bold border text-[11px] cursor-pointer ${hasLuggage ? 'bg-brand-navy text-white border-brand-navy shadow-xs' : 'bg-white text-brand-navy/60 border-brand-navy/10'}`}
                      >
                        💼 큰 가방 있음
                      </button>
                      <button 
                        onClick={() => setHasLuggage(false)}
                        className={`flex-1 py-2 text-center rounded-xl font-bold border text-[11px] cursor-pointer ${!hasLuggage ? 'bg-brand-navy text-white border-brand-navy shadow-xs' : 'bg-white text-brand-navy/60 border-brand-navy/10'}`}
                      >
                        🎒 짐 없음
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transit Filter Selector */}
              <div className="bg-brand-cream border border-brand-navy/10 rounded-3xl p-4.5 shadow-2xs space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-brand-navy/5 pb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-brand-navy">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
                    <span>지능형 교통수단 필터</span>
                  </div>
                  {(transitFilters.people.length > 0 || transitFilters.budget.length > 0 || transitFilters.type.length > 0 || transitFilters.walking.length > 0) && (
                    <button 
                      onClick={resetTransitFilters}
                      className="text-[9.5px] text-red-500 font-bold bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      🔄 필터 초기화
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-brand-navy/40 font-bold uppercase flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-brand-gold" /> 비용 수준
                    </label>
                    <div className="flex gap-1">
                      {["낮음", "보통", "여유"].map(budget => {
                        const active = transitFilters.budget.includes(budget);
                        return (
                          <button
                            key={budget}
                            onClick={() => setTransitFilters(prev => ({
                              ...prev,
                              budget: active ? prev.budget.filter(b => b !== budget) : [...prev.budget, budget]
                            }))}
                            className={`flex-1 py-1 rounded border text-[9px] font-black transition-all cursor-pointer ${active ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-brand-navy/60 border-brand-navy/10'}`}
                          >
                            {budget}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-brand-navy/40 font-bold uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-brand-gold" /> 예약 유형
                    </label>
                    <select
                      value={transitFilters.reservation}
                      onChange={(e) => setTransitFilters(prev => ({ ...prev, reservation: e.target.value as any }))}
                      className="w-full bg-white border border-brand-navy/10 rounded-xl px-2 py-1.5 font-bold text-brand-navy text-[11px] outline-none cursor-pointer"
                    >
                      <option value="상관없음">상관없음</option>
                      <option value="예약필요없음">예약 필요 없음</option>
                      <option value="예약가능">사전 예약 수단</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Selection Status */}
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-brand-navy/50">
                  선택한 수단: <b className="text-brand-gold-dark font-black">{selectedTransports.length}개</b> 담김
                </span>
                {selectedTransports.length > 0 && (
                  <button 
                    onClick={() => setSelectedTransports([])}
                    className="text-[10px] text-red-500 font-bold bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    🧹 전체 선택 취소
                  </button>
                )}
              </div>

              {/* Transit Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                {filteredTransports.map(item => {
                  const isSelected = selectedTransports.includes(item.id);
                  return (
                    <div key={item.id}>
                      <SingleTransportCard 
                        transport={item as Transport}
                        isSelected={isSelected}
                        onCardClick={() => setActiveTransportModal({ transport: item as Transport, mode: 'summary' })}
                        onSelectToggle={() => toggleTransportSelection(item.id)}
                        activePeople={transitFilters.people}
                        activeBudget={transitFilters.budget}
                        activeWeather={transitFilters.weather}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Back & Next Navigation Block */}
              <div className="grid grid-cols-3 gap-2.5 pt-4">
                <button 
                  onClick={() => setActiveTab('places')}
                  className="bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy font-bold py-3.5 rounded-2xl text-xs cursor-pointer text-center"
                >
                  ◀ 이전 단계
                </button>
                <button 
                  onClick={() => setActiveTab('summary')}
                  disabled={selectedPlaces.length === 0 || selectedTransports.length === 0}
                  className="col-span-2 bg-brand-navy hover:bg-brand-navy-light disabled:bg-brand-navy/35 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>최종 일정 지도 생성하기 ➔</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: SUMMARY & INTERACTIVE OSRM ROUTE MAP */}
          {activeTab === 'summary' && (
            <div className="space-y-5 animate-fade-in pb-12">
              <div className="space-y-1">
                <span className="text-xs text-brand-gold-dark font-black tracking-wider uppercase">STEP 04</span>
                <h2 className="text-xl font-black tracking-tight text-brand-navy">실시간 노선 라우팅 추적</h2>
                <p className="text-xs text-brand-navy/60">
                  부여 시외터미널 기점부터 선택하신 모든 유적지 명소를 잇는 OSRM 안심 지도를 그립니다.
                </p>
              </div>

              {/* Interactive Full-scale Leaflet Routing Map */}
              <div className="relative h-[290px] w-full rounded-3xl overflow-hidden shadow-md border border-brand-navy/10 bg-brand-beige/10">
                <LeafletMap 
                  routePlaces={activeSelectedPlacesList}
                  selectedTransports={activeSelectedTransportsList}
                  passengers={passengers}
                  hasLuggage={hasLuggage}
                />
              </div>

              {/* Real-time Environment Status Indicators */}
              <div className="bg-brand-cream border border-brand-navy/10 rounded-2xl p-4.5 text-xs text-left space-y-3">
                <div className="flex justify-between items-center border-b border-brand-navy/5 pb-2">
                  <span className="font-black text-brand-navy/40 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-brand-gold" />
                    <span>실시간 매칭 정보 요약</span>
                  </span>
                  <span className="text-[8.5px] bg-brand-navy text-white px-2 py-0.5 rounded font-black tracking-wider uppercase">
                    ENVIRONMENT
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                  <div>
                    <span className="text-brand-navy/50 font-bold block">👥 동행 가이드:</span>
                    <span className="font-extrabold text-brand-navy">
                      {passengers === "1" ? "1인 (나홀로 여행)" : passengers === "2" ? "2인 (연인/친구)" : passengers === "3" ? "3~4인 (소가족)" : "5인 이상 (대단체)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-brand-navy/50 font-bold block">💼 수하물 무게:</span>
                    <span className="font-extrabold text-brand-navy">
                      {hasLuggage ? "대형 캐리어/가방 있음" : "소형 가방 가벼움"}
                    </span>
                  </div>
                  <div>
                    <span className="text-brand-navy/50 font-bold block">🌦️ 현재 부여 기후:</span>
                    <span className="font-extrabold text-brand-navy">
                      {isRainyDay ? "☔ 우천 중 (실내 위주 가중치)" : "☀️ 맑음 (야외 도보 권장)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-brand-navy/50 font-bold block">🚗 소유 환경:</span>
                    <span className="font-extrabold text-brand-navy">
                      {hasCar ? "자차 가져옴 (주차 안내)" : "대중교통 뚜벅이 (콜버스/택시)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Hybrid Analysis Report Display Card (Brought from Page 4 of first app) */}
              <div className="bg-brand-navy text-white p-5 rounded-3xl space-y-3 shadow-lg border border-brand-gold/15">
                <div className="flex items-center gap-1.5 border-b border-white/10 pb-2.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  <h3 className="text-xs font-black text-brand-gold uppercase tracking-wider">
                    🎯 하이브리드 연계 분석 지침서
                  </h3>
                </div>

                <p 
                  className="text-[11.5px] text-white/90 leading-relaxed text-left font-medium"
                  dangerouslySetInnerHTML={{ __html: analysisReportText }}
                />

                <div className="text-[9px] text-white/50 border-t border-white/10 pt-2.5 mt-1.5 text-left font-semibold leading-relaxed">
                  💡 카카오/네이버 맵 규격에 부합하도록 실제 도로 기하학적 궤적(OSRM API)을 실시간으로 추적 연결하여 버스 노선 공백과 체력 부하를 계산해 줍니다.
                </div>
              </div>

              {/* Choice Breakdown & Deselect Row */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-brand-navy/50 pl-1 uppercase tracking-wider text-left">
                  이번 여정에 담긴 코스 목록 ({activeSelectedPlacesList.length}개)
                </h4>
                
                <div className="space-y-2">
                  {activeSelectedPlacesList.map((place, idx) => (
                    <div key={place.id} className="bg-white border border-brand-navy/10 rounded-2xl p-3.5 flex justify-between items-center shadow-3xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-brand-navy text-white flex items-center justify-center text-[10px] font-black shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h5 className="font-extrabold text-xs text-brand-navy leading-none truncate">{place.name}</h5>
                          <span className="text-[9px] text-brand-navy/40 font-bold block mt-1">대기소: {place.waitingPlace || "안내센터 실내 로비"}</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => togglePlaceSelection(place.id)}
                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset / Go Back Actions */}
              <div className="flex gap-2.5 pt-4">
                <button 
                  onClick={() => setActiveTab('transit')}
                  className="w-1/3 bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy font-bold py-4 rounded-xl text-xs cursor-pointer text-center"
                >
                  ◀ 수단 정정
                </button>
                <button 
                  onClick={resetAllAndGoHome}
                  className="w-2/3 bg-brand-navy-light hover:bg-brand-navy text-white font-extrabold py-4 rounded-xl text-xs transition-all shadow-md cursor-pointer text-center"
                >
                  🔄 처음부터 다시 설계하기
                </button>
              </div>
            </div>
          )}

        </main>

        {/* BOTTOM NAVIGATION TAB BAR */}
        <Me 
          activeTab={activeTab} 
          onChangeTab={(tab) => {
            setActiveTab(tab);
          }} 
          disabledTabs={[]}
        />

        {/* PLACE DETAIL MODAL (With Live Map) */}
        {activePlaceModal && (
          <Ve 
            place={activePlaceModal.place}
            mode={activePlaceModal.mode}
            nearWaitingSpots={WAITING_SPOTS.filter(s => s.nearPlaceId === activePlaceModal.place.id)}
            onClose={() => setActivePlaceModal(null)}
            onSwitchToDeep={() => setActivePlaceModal(prev => prev ? { ...prev, mode: 'deep' } : null)}
            isSelected={selectedPlaces.includes(activePlaceModal.place.id)}
            onToggleSelect={() => {
              togglePlaceSelection(activePlaceModal.place.id);
            }}
          />
        )}

        {/* TRANSPORT DETAIL MODAL */}
        {activeTransportModal && (
          <Ge 
            transport={activeTransportModal.transport}
            mode={activeTransportModal.mode}
            isSelected={selectedTransports.includes(activeTransportModal.transport.id)}
            onToggleSelect={() => {
              toggleTransportSelection(activeTransportModal.transport.id);
            }}
            onClose={() => setActiveTransportModal(null)}
            onSwitchToDeep={() => setActiveTransportModal(prev => prev ? { ...prev, mode: 'deep' } : null)}
          />
        )}

      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

interface TabBarProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  disabledTabs?: string[];
}

function Me({ activeTab, onChangeTab, disabledTabs = [] }: TabBarProps) {
  const tabs = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'places', label: '명소선택', icon: MapPin },
    { id: 'transit', label: '이동선택', icon: Bus },
    { id: 'summary', label: '실시간노선', icon: ClipboardCheck },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 w-full glass-nav px-2 py-2 flex items-center justify-around pb-safe-bottom shadow-lg">
      <div className="max-w-md w-full mx-auto flex items-center justify-around">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const disabled = disabledTabs.includes(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => !disabled && onChangeTab(tab.id)}
              disabled={disabled}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-300 relative select-none cursor-pointer ${active ? 'text-brand-gold scale-105 font-black' : 'text-white/60 hover:text-white'}`}
            >
              <Icon className={`w-5 h-5 mb-0.5 transition-transform duration-300 ${active ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
              {active && <span className="absolute -bottom-1 w-5 h-1 bg-brand-gold rounded-full" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Single Place Card Component
interface SinglePlaceCardProps {
  place: Place;
  score: number;
  reason: string;
  isSelected: boolean;
  onCardClick: () => void;
  onSelectToggle: () => void;
}

function SinglePlaceCard({
  place,
  score,
  reason,
  isSelected,
  onCardClick,
  onSelectToggle,
}: SinglePlaceCardProps) {
  let fitColorClass = "from-emerald-400 to-emerald-500";
  let fitBgClass = "bg-emerald-50 text-emerald-800 border-emerald-200/50";
  let fitLabel = "조건 일부 주의";

  if (score >= 90) {
    fitColorClass = "from-amber-400 to-amber-500";
    fitBgClass = "bg-amber-50 text-amber-800 border-brand-gold/30 font-black";
    fitLabel = "아주 잘 맞아요";
  } else if (score >= 75) {
    fitColorClass = "from-blue-400 to-blue-500";
    fitBgClass = "bg-blue-50 text-blue-800 border-blue-200/50 font-bold";
    fitLabel = "잘 맞아요";
  }

  return (
    <div 
      onClick={onCardClick}
      className={`bg-white border rounded-[24px] overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer relative select-none ${isSelected ? 'border-brand-gold ring-3 ring-brand-gold/35' : 'border-brand-navy/10 hover:border-brand-navy/20'}`}
    >
      {isSelected && (
        <div className="absolute top-3 left-3 z-20 bg-brand-gold text-brand-navy px-2.5 py-1 rounded-xl text-[9px] font-black flex items-center gap-1 shadow-md animate-scale-up">
          <CheckCircle2 className="w-3.5 h-3.5 fill-brand-navy stroke-brand-gold" />
          <span>담김</span>
        </div>
      )}

      {/* Image Header */}
      <div className="relative h-36 w-full bg-slate-200 overflow-hidden">
        <img 
          src={place.image} 
          alt={place.name} 
          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Dynamic matching indicators */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {!isSelected && (
            <span className={`px-2 py-0.5 rounded-lg text-[8.5px] font-bold tracking-tight shadow-sm flex items-center gap-1 border ${fitBgClass}`}>
              <Award className="w-3 h-3" />
              <span>{fitLabel} ({score}%)</span>
            </span>
          )}
        </div>

        <div className="absolute top-3 right-3 z-10">
          <span className="bg-black/30 backdrop-blur-md text-white text-[9px] px-2 py-0.5 rounded-md font-medium border border-white/10">
            {place.category}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3 text-white">
          <h3 className="text-base font-black tracking-tight leading-tight mb-1">{place.name}</h3>
          <div className="flex flex-wrap gap-1">
            {place.themes.slice(0, 3).map(theme => (
              <span key={theme} className="text-[9px] bg-white/20 backdrop-blur-sm text-white px-1.5 py-0.5 rounded font-semibold">
                #{theme}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Description body */}
      <div className="p-4.5 space-y-3">
        <p className="text-[11px] text-brand-navy/70 line-clamp-1 leading-relaxed font-extrabold text-left">
          "{place.shortDescription}"
        </p>

        {/* Highlight reasons matching active filters */}
        <div className="space-y-1.5 p-3 bg-brand-cream/35 rounded-xl border border-brand-gold/15 shadow-3xs">
          <div className="flex justify-between items-center text-[9px]">
            <span className={`px-1.5 py-0.2 rounded text-[8px] font-black border ${fitBgClass}`}>
              🎯 매칭도 {score}%
            </span>
            <span className="text-brand-navy/55 font-extrabold">맞춤 해설</span>
          </div>
          <p className="text-[10px] text-brand-navy/85 leading-relaxed font-semibold text-left">
            {reason}
          </p>
        </div>

        {/* Footprint Specifications */}
        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-brand-navy/5 text-[9px]">
          <div className="flex flex-col space-y-0.5 text-left">
            <span className="text-brand-navy/40 font-bold flex items-center gap-0.5">
              <Footprints className="w-2.5 h-2.5" /> 걷기 강도
            </span>
            <span className={`px-1 py-0.2 rounded font-bold text-center text-[9.5px] ${place.walkingLoad === '적음' ? 'bg-green-50 text-green-700 border border-green-100' : place.walkingLoad === '보통' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-orange-50 text-orange-700 border border-orange-100'}`}>
              {place.walkingLoad}
            </span>
          </div>
          <div className="flex flex-col space-y-0.5 text-left">
            <span className="text-brand-navy/40 font-bold flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> 권장 시간
            </span>
            <span className="bg-slate-50 text-slate-700 border border-slate-100 px-1 py-0.2 rounded font-bold text-center text-[9.5px]">
              {place.stayMinutes}분
            </span>
          </div>
          <div className="flex flex-col space-y-0.5 text-left">
            <span className="text-brand-navy/40 font-bold flex items-center gap-0.5">
              <Sun className="w-2.5 h-2.5" /> 추천 환경
            </span>
            <span className="bg-yellow-50 text-yellow-700 border border-yellow-100/50 px-1 py-0.2 rounded font-bold text-center truncate text-[9.5px]">
              {place.isIndoor ? "실내" : "야외림"}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-brand-navy/5">
          <span className="text-[9px] text-brand-navy/40 font-bold">
            💡 터치: 상세 설명, 지도 보기
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectToggle();
            }}
            className={`text-[10.5px] font-extrabold px-4.5 py-2 rounded-xl transition-all cursor-pointer shadow-3xs ${isSelected ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold' : 'bg-brand-gold hover:bg-brand-gold-dark text-brand-navy border border-brand-gold-dark/20 font-black'}`}
          >
            {isSelected ? "제외하기" : "명소 담기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Single Transport Card Component
interface SingleTransportCardProps {
  transport: Transport;
  isSelected: boolean;
  onCardClick: () => void;
  onSelectToggle: () => void;
  activePeople: string[];
  activeBudget: string[];
  activeWeather: string;
}

function SingleTransportCard({
  transport,
  isSelected,
  onCardClick,
  onSelectToggle,
  activePeople,
  activeBudget,
  activeWeather,
}: SingleTransportCardProps) {
  const emoji = {
    walk: "👣",
    bus: "🚌",
    taxi: "🚕",
    citytour: "🚍",
    ferry: "⛵",
    amphibious: "🚍🌊",
    tourism_taxi: "🚖",
    drt: "✨"
  }[transport.id] || "🚌";

  let warningLabel = "";
  if (transport.id === 'drt') warningLabel = "시범 호출";
  else if (transport.reservationRequired) warningLabel = "예약 필수";
  else if (transport.costLevel === '높음') warningLabel = "비용 높음";

  return (
    <div 
      onClick={onCardClick}
      className={`bg-white border rounded-3xl p-4.5 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between cursor-pointer relative select-none min-h-[160px] ${isSelected ? 'border-brand-gold ring-3 ring-brand-gold/35' : 'border-brand-navy/10 hover:border-brand-navy/20'}`}
    >
      {isSelected && (
        <div className="absolute top-2.5 right-2.5 z-10 bg-brand-gold text-brand-navy px-2 py-0.5 rounded-lg text-[8px] font-black flex items-center gap-0.5 shadow-sm animate-scale-up">
          <Check className="w-3 h-3 stroke-[3px]" />
          <span>담김</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl select-none">{emoji}</span>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-brand-navy truncate leading-tight">{transport.name}</h3>
            <span className="text-[8px] text-brand-navy/40 font-bold block mt-0.5">
              정원 {transport.minPeople}~{transport.maxPeople}인
            </span>
          </div>
        </div>

        <p className="text-[10px] text-brand-navy/70 line-clamp-2 leading-relaxed font-bold text-left">
          "{transport.whyUseThis}"
        </p>

        {warningLabel && (
          <div className="flex flex-wrap gap-0.5">
            <span className="bg-amber-50 text-amber-800 border border-amber-200/50 rounded px-1.5 py-0.2 text-[8px] font-bold">
              ⚠️ {warningLabel}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 pt-2 border-t border-brand-navy/5">
        <span className="text-[8px] text-brand-navy/35 font-bold leading-none">
          터치: 설명 보기
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectToggle();
          }}
          className={`text-[9.5px] font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer text-center shadow-3xs ${isSelected ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200' : 'bg-brand-gold hover:bg-brand-gold-dark text-brand-navy border border-brand-gold-dark/20'}`}
        >
          {isSelected ? "제외" : "담기"}
        </button>
      </div>
    </div>
  );
}

// Place Detail Modal Component (With embedded Live Leaflet Map!)
interface PlaceDetailModalProps {
  place: Place;
  mode: 'summary' | 'deep';
  nearWaitingSpots: WaitingSpot[];
  onClose: () => void;
  onSwitchToDeep: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function Ve({
  place,
  mode,
  nearWaitingSpots,
  onClose,
  onSwitchToDeep,
  isSelected,
  onToggleSelect,
}: PlaceDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-brand-cream w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col animate-scale-up border border-brand-navy/10">
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/45 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Scrollable Container */}
        <div className="overflow-y-auto flex-1 no-scrollbar">
          
          {/* Header image / Leaflet Map for place selection location */}
          <div className="relative h-48 w-full bg-slate-100 border-b border-brand-navy/5">
            {/* INJECT LEAFLET MAP INSTEAD OF STATIC IMAGE IF THE USER OPENS IT! This perfectly satisfies "명소 선택시 지도가 그 위치에 맞게 뜨고" */}
            <LeafletMap singlePlace={place} />
            <div className="absolute bottom-3 left-3 right-3 bg-white/80 backdrop-blur-md rounded-xl p-2.5 border border-brand-navy/5 text-left pointer-events-none shadow-sm">
              <span className="bg-brand-gold text-brand-navy font-black text-[8px] px-1.5 py-0.2 rounded uppercase tracking-wider mb-1 inline-block">
                {place.category}
              </span>
              <h3 className="text-xs font-black text-brand-navy leading-none">
                {place.name}
              </h3>
            </div>
          </div>

          {/* Modal details */}
          <div className="p-5 space-y-4">
            
            {/* Vibe subtitle / short description */}
            <div className="bg-white border border-brand-navy/5 p-3.5 rounded-2xl shadow-3xs text-center">
              <p className="text-[11px] font-bold text-brand-navy leading-relaxed italic">
                "{place.shortDescription}"
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="bg-white border border-brand-navy/5 p-2 rounded-xl flex flex-col items-center justify-center shadow-3xs">
                <Clock className="w-3.5 h-3.5 text-brand-gold mb-1" />
                <span className="text-[8px] text-brand-navy/40 font-bold block">소요 시간</span>
                <span className="text-[10px] font-black text-brand-navy mt-0.5">{place.stayMinutes}분</span>
              </div>
              <div className="bg-white border border-brand-navy/5 p-2 rounded-xl flex flex-col items-center justify-center shadow-3xs">
                <Footprints className="w-3.5 h-3.5 text-brand-gold mb-1" />
                <span className="text-[8px] text-brand-navy/40 font-bold block">걷기 부하</span>
                <span className="text-[10px] font-black text-brand-navy mt-0.5">{place.walkingLoad}</span>
              </div>
              <div className="bg-white border border-brand-navy/5 p-2 rounded-xl flex flex-col items-center justify-center shadow-3xs">
                <Sun className="w-3.5 h-3.5 text-brand-gold mb-1" />
                <span className="text-[8px] text-brand-navy/40 font-bold block">실내외구분</span>
                <span className="text-[10px] font-black text-brand-navy mt-0.5">{place.isIndoor ? "실내" : "야외"}</span>
              </div>
            </div>

            {mode === 'summary' ? (
              <div className="space-y-4">
                {/* Why recommended */}
                <div className="bg-white border border-brand-navy/5 rounded-2xl p-4 space-y-1 shadow-3xs text-left">
                  <h4 className="text-[10px] font-black text-brand-navy/40 flex items-center gap-1 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                    <span>추천 포인트</span>
                  </h4>
                  <p className="text-[11px] text-brand-navy leading-relaxed font-bold">
                    {place.whyRecommended}
                  </p>
                </div>

                {/* Warnings */}
                {place.selectionWarnings && place.selectionWarnings.length > 0 && (
                  <div className="bg-amber-50/50 border border-brand-gold/15 rounded-2xl p-3.5 flex gap-2 text-left">
                    <AlertTriangle className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-900 leading-relaxed font-medium">
                      {place.selectionWarnings[0]}
                    </p>
                  </div>
                )}

                <p className="text-[9.5px] text-center text-brand-navy/40 font-bold animate-pulse">
                  💡 아래 더 깊게 살펴보기 버튼을 누르면 상세 스토리가 열립니다!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Long description */}
                <div className="bg-white border border-brand-navy/5 p-4 rounded-2xl shadow-3xs text-left space-y-2.5">
                  <h4 className="text-[10px] font-black text-brand-navy/40 uppercase tracking-wider block">
                    📜 역사 및 스토리 가이드
                  </h4>
                  <p className="text-[11px] text-brand-navy/80 leading-relaxed font-medium whitespace-pre-line">
                    {place.longDescription}
                  </p>
                </div>

                {/* Waiting Spots */}
                {nearWaitingSpots.length > 0 && (
                  <div className="bg-amber-50/20 p-4 rounded-2xl border border-brand-gold/10 text-left space-y-2">
                    <h4 className="text-[9.5px] font-black text-brand-navy/60 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-brand-gold" />
                      <span>대중교통 대기 쉼터 연계</span>
                    </h4>
                    {nearWaitingSpots.map(spot => (
                      <div key={spot.id} className="bg-white p-2.5 rounded-xl border border-brand-navy/5 shadow-3xs text-[10.5px]">
                        <div className="flex items-center justify-between font-bold text-brand-navy">
                          <span>{spot.name} ({spot.type})</span>
                          <span className="text-[8.5px] text-brand-gold-dark bg-brand-gold/10 px-1.5 py-0.5 rounded font-black">
                            {spot.recommendedWaitMinutes}분 대기 추천
                          </span>
                        </div>
                        <p className="text-[10px] text-brand-navy/50 mt-1 leading-normal font-medium">
                          {spot.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pedestrian / Transit Note */}
                <div className="bg-brand-navy/5 border border-brand-navy/5 rounded-2xl p-4 text-xs text-left space-y-1">
                  <h4 className="font-extrabold text-brand-navy flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" />
                    <span>무차량 뚜벅이 이동 팁</span>
                  </h4>
                  <p className="text-[10.5px] text-brand-navy/80 leading-relaxed font-medium">
                    {place.transportNotes}
                  </p>
                </div>
              </div>
            )}

            {/* Related items */}
            <div className="space-y-2 text-left">
              <h4 className="text-[9.5px] font-black text-brand-navy/40 pl-1 uppercase tracking-wider">
                함께 가기 좋은 인근 코스
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                {place.recommendedWith.map(rec => (
                  <span key={rec} className="flex items-center gap-1 text-[9.5px] bg-white text-brand-navy font-bold px-3 py-1.5 rounded-xl border border-brand-navy/5 shadow-3xs whitespace-nowrap shrink-0">
                    <span>{rec}</span>
                    <ArrowRight className="w-3 h-3 text-brand-gold" />
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-white border-t border-brand-navy/5 flex gap-2">
          <button 
            onClick={onClose}
            className="bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy font-bold py-3 px-4 rounded-xl text-xs cursor-pointer text-center"
          >
            닫기
          </button>
          
          {mode === 'summary' && (
            <button 
              onClick={onSwitchToDeep}
              className="flex-1 bg-brand-navy hover:bg-brand-navy-light text-white font-extrabold py-3 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1 shadow-sm"
            >
              <BookOpen className="w-4 h-4 text-brand-gold" />
              <span>역사 스토리 & 대기 쉼터 보기</span>
            </button>
          )}

          <button 
            onClick={() => {
              onToggleSelect();
              onClose();
            }}
            className={`flex-1 font-extrabold py-3 rounded-xl text-xs cursor-pointer text-center shadow-2xs ${isSelected ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-brand-gold text-brand-navy border border-brand-gold'}`}
          >
            {isSelected ? "제외하기" : "이 명소 담기"}
          </button>
        </div>

      </div>
    </div>
  );
}

// Transport Detail Modal Component
interface TransportDetailModalProps {
  transport: Transport;
  mode: 'summary' | 'deep';
  isSelected: boolean;
  onToggleSelect: () => void;
  onClose: () => void;
  onSwitchToDeep: () => void;
}

function Ge({
  transport,
  mode,
  isSelected,
  onToggleSelect,
  onClose,
  onSwitchToDeep,
}: TransportDetailModalProps) {
  const emoji = {
    walk: "👣",
    bus: "🚌",
    taxi: "🚕",
    citytour: "🚍",
    ferry: "⛵",
    amphibious: "🚍🌊",
    tourism_taxi: "🚖",
    drt: "✨"
  }[transport.id] || "🚌";

  const typeLabels: Record<string, string> = {
    general: "일반 보행",
    localTransit: "지역 대중교통",
    taxi: "택시 이동",
    tourTransport: "관광형 이동",
    fixedCourse: "코스형 투어",
    reservation: "예약형 전세",
    future: "시범 도입 예정"
  };

  const costLabels = {
    낮음: "💳 저렴 (알뜰형)",
    보통: "💳 보통 (합리적)",
    높음: "💳 높음 (프리미엄)"
  };

  const strengths = transport.strength.split(',').map(s => s.trim()).filter(Boolean);
  const cautions = transport.caution.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-brand-cream w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col animate-scale-up border border-brand-navy/10">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/45 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="overflow-y-auto flex-1 no-scrollbar p-5 space-y-5">
          
          {/* Header Card */}
          <div className="text-center py-5 bg-white rounded-3xl border border-brand-navy/5 shadow-3xs space-y-2 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-2 bg-brand-gold" />
            <span className="text-4xl select-none block animate-pulse">{emoji}</span>
            <div className="space-y-0.5">
              <span className="text-[8px] bg-brand-navy/5 text-brand-navy/60 px-2 py-0.5 rounded font-black tracking-wider uppercase">
                {typeLabels[transport.type] || transport.type}
              </span>
              <h2 className="text-base font-black text-brand-navy tracking-tight mt-1">
                {transport.name}
              </h2>
            </div>
          </div>

          {/* Media Header image if any */}
          <div className="relative h-36 rounded-3xl overflow-hidden shadow-3xs border border-brand-navy/5">
            <img src={transport.image} alt={transport.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>

          {mode === 'summary' ? (
            <div className="space-y-4 text-left">
              <div className="bg-white border border-brand-navy/5 p-3 rounded-xl shadow-3xs">
                <p className="text-[11px] font-bold text-brand-navy leading-normal italic text-center">
                  "{transport.whyUseThis}"
                </p>
              </div>

              <div className="bg-white border border-brand-navy/5 p-3.5 rounded-2xl shadow-3xs space-y-1">
                <span className="text-[9px] text-brand-navy/40 font-bold uppercase tracking-wider block">추천 대상</span>
                <p className="text-[11px] font-bold text-brand-navy">🎯 {transport.suitableFor}</p>
              </div>

              {strengths.length > 0 && (
                <div className="bg-white border border-brand-navy/5 p-3.5 rounded-2xl shadow-3xs space-y-1.5">
                  <span className="text-[9px] text-brand-navy/40 font-bold uppercase tracking-wider block">핵심 장점</span>
                  <ul className="space-y-1 text-[10px] text-brand-navy/70 leading-normal">
                    {strengths.slice(0, 2).map((st, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                        <span>{st}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cautions.length > 0 && (
                <div className="bg-amber-50/50 border border-brand-gold/15 p-3.5 rounded-xl flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5" />
                  <p className="text-[9.5px] text-amber-900 leading-normal font-semibold">
                    {cautions[0]}
                  </p>
                </div>
              )}

              <p className="text-[9.5px] text-center text-brand-navy/40 font-bold animate-pulse">
                💡 더 깊게 보기 버튼을 누르면 승하차 지점 및 예약 정보를 확인합니다!
              </p>
            </div>
          ) : (
            <div className="space-y-5 text-left">
              {/* Detailed description */}
              <div className="bg-white border border-brand-navy/5 p-4 rounded-2xl shadow-3xs space-y-2">
                <span className="text-[9px] text-brand-gold-dark font-extrabold uppercase tracking-wide">교통 수단 가이드</span>
                <p className="text-[11px] text-brand-navy/80 leading-relaxed font-semibold">
                  {transport.description}
                </p>
              </div>

              {/* Specs Grid */}
              <div className="bg-white border border-brand-navy/5 rounded-2xl overflow-hidden shadow-3xs">
                <div className="bg-brand-navy/5 px-4 py-2 border-b border-brand-navy/5">
                  <span className="text-[9px] font-black text-brand-navy/55 uppercase tracking-wider">이동 상세 사양</span>
                </div>
                <div className="divide-y divide-brand-navy/5 text-[10.5px]">
                  <div className="flex justify-between items-center p-3">
                    <span className="text-brand-navy/45 font-bold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand-gold" /> 탑승 정원
                    </span>
                    <span className="font-extrabold text-brand-navy">{transport.minPeople}~{transport.maxPeople}인</span>
                  </div>
                  <div className="flex justify-between items-center p-3">
                    <span className="text-brand-navy/45 font-bold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-gold" /> 예약 의무
                    </span>
                    <span className="font-extrabold text-brand-navy">{transport.reservationRequired ? "예약 필수" : "예약 없음"}</span>
                  </div>
                  <div className="flex justify-between items-center p-3">
                    <span className="text-brand-navy/45 font-bold flex items-center gap-1.5">
                      <CloudRain className="w-3.5 h-3.5 text-brand-gold" /> 기상 민감도
                    </span>
                    <span className="font-extrabold text-brand-navy">{transport.weatherSensitive ? "우천 결항 위험" : "연중무휴 작동"}</span>
                  </div>
                  <div className="flex justify-between items-center p-3">
                    <span className="text-brand-navy/45 font-bold flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-brand-gold" /> 비용 레벨
                    </span>
                    <span className="font-extrabold text-brand-navy">{costLabels[transport.costLevel]}</span>
                  </div>
                  <div className="flex justify-between items-center p-3">
                    <span className="text-brand-navy/45 font-bold flex items-center gap-1.5">
                      <Footprints className="w-3.5 h-3.5 text-brand-gold" /> 도보 부하
                    </span>
                    <span className="font-extrabold text-brand-navy">{transport.walkingBurden}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Cautions */}
              {cautions.length > 0 && (
                <div className="bg-amber-50/50 border border-brand-gold/15 rounded-2xl p-4 space-y-2 shadow-3xs">
                  <h4 className="text-[10px] font-black text-amber-900/60 flex items-center gap-1 uppercase tracking-wider">
                    <ShieldAlert className="w-3.5 h-3.5 text-brand-gold" />
                    <span>주의 사항</span>
                  </h4>
                  <ul className="space-y-1.5 text-[10px] leading-relaxed text-amber-900/80">
                    {cautions.map((c, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-brand-navy/5 flex gap-2">
          <button 
            onClick={onClose}
            className="bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy font-bold py-3 px-4 rounded-xl text-xs cursor-pointer text-center"
          >
            닫기
          </button>
          
          {mode === 'summary' && (
            <button 
              onClick={onSwitchToDeep}
              className="flex-1 bg-brand-navy hover:bg-brand-navy-light text-white font-extrabold py-3 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1 shadow-sm"
            >
              <BookOpen className="w-4 h-4 text-brand-gold" />
              <span>상세 이동 노하우 & 사양 보기</span>
            </button>
          )}

          <button 
            onClick={() => {
              onToggleSelect();
              onClose();
            }}
            className={`flex-1 font-extrabold py-3 rounded-xl text-xs cursor-pointer text-center shadow-2xs ${isSelected ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-brand-gold text-brand-navy border border-brand-gold'}`}
          >
            {isSelected ? "제외하기" : "이 이동수단 담기"}
          </button>
        </div>

      </div>
    </div>
  );
}
