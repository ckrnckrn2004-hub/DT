export interface Region {
  id: string;
  name: string;
  province: string;
  shortDescription: string;
  vibeTitle: string;
  heroImage: string;
  characterName: string;
  characterEmoji: string;
  characterImage?: string;
  characterCatchphrase: string;
  characterDescriptionShort: string;
  characterDescription: string;
  themes: string[];
  hashtags: string[];
  isMvpAvailable: boolean;
  imageStyle: string;
  colorTheme: string;
  characterImageStyle: string;
  characterToyDescription: string;
  characterTone: string;
  regionVisualKeyword: string;
  regionIcon: string;
  regionHashtags: string[];
}

export interface Place {
  id: string;
  name: string;
  category: string;
  themes: string[];
  weatherFit: string[];
  recommendedWeather: string;
  rainFitScore: number;
  stayMinutes: number;
  walkingLoad: '적음' | '보통' | '많음';
  budgetLevel: string;
  crowdLevel: string;
  image: string;
  shortDescription: string;
  longDescription: string;
  whyRecommended: string;
  recommendedWith: string[];
  transportNotes: string;
  cautions?: string;
  isIndoor: boolean;
  selectionWarnings?: string[];
  gallery?: string[];
  fallbackImage?: string;
  fallbackGallery?: string[];
  // Geographic coordinates for Leaflet map mapping
  coords: [number, number];
  busCoords: [number, number];
  drtCoords: [number, number];
  waitingPlace?: string;
}

export interface Transport {
  id: string;
  name: string;
  type: string;
  image: string;
  suitableFor: string;
  minPeople: number;
  maxPeople: number;
  reservationRequired: boolean;
  costLevel: '낮음' | '보통' | '높음';
  reliability: string;
  weatherSensitive: boolean;
  walkingBurden: '적음' | '보통' | '많음';
  description: string;
  strength: string;
  caution: string;
  whyUseThis: string;
  selectionWarnings?: string[];
}

export interface WaitingSpot {
  id: string;
  name: string;
  type: string;
  goodForRain: boolean;
  goodForNight: boolean;
  recommendedWaitMinutes: number;
  description: string;
  nearPlaceId: string;
}

export interface PlaceFilters {
  weather: string[];
  themes: string[];
  walking: string[];
  stay: string[];
  indoor: '상관없음' | '실내' | '야외';
}

export interface TransitFilters {
  people: string[];
  budget: string[];
  reservation: '상관없음' | '예약필요없음' | '예약가능';
  type: string[];
  walking: string[];
  weather: '상관없음' | '비가능' | '야외영향';
}
