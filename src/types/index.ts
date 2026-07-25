// ===== 스케줄 관련 타입 =====
export interface Schedule {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  time_slot: string; // "09:00", "14:30" 등
  title: string | null;
  unit: string | null; // 동호수
  memo: string | null; // 내용: 단일 텍스트 또는 JSON 문자열 배열
  schedule_type: ScheduleType | null;
  amount: number;
  payment_method: PaymentMethod | null;
  is_done: boolean;
  is_reserved: boolean;
  is_paid: boolean;
  install_paid: boolean;
  event_icon: EventIcon | null;
  install_type: ScheduleType | null;
  install_amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ScheduleType = 'sale' | 'as' | 'wholesale' | 'agency' | 'group' | 'install' | 'purchase' | 'daily';
export type PaymentMethod = 'cash' | 'card' | 'vat' | 'free';
export type EventIcon = 'golf' | 'birthday' | 'meeting' | 'install';

export interface ScheduleInput {
  date: string;
  time_slot: string;
  title?: string | null;
  unit?: string | null;
  memo?: string | null; // 내용: 단일 텍스트 또는 JSON 문자열 배열
  schedule_type?: ScheduleType | null;
  amount?: number;
  payment_method?: PaymentMethod | null;
  is_done?: boolean;
  is_reserved?: boolean;
  is_paid?: boolean;
  install_paid?: boolean;
  event_icon?: EventIcon | null;
  install_type?: ScheduleType | null;
  install_amount?: number;
  sort_order?: number;
}

// ===== 거래처 관련 타입 =====
export interface Client {
  id: string;
  user_id: string;
  name: string;
  type: ClientType | null;
  address: string | null;
  bunji: string | null;
  households: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientType = 'apt' | 'villa' | 'officetel' | 'house' | 'etc';

export interface ClientInput {
  name: string;
  type?: ClientType;
  address?: string;
  bunji?: string;
  households?: string;
  memo?: string;
}

// ===== 완료 확인서 관련 타입 =====
export interface CompletionRecord {
  id: string;
  schedule_id: string;
  user_id: string;
  apartment_name: string | null;
  unit_number: string | null;
  customer_name: string | null;
  phone: string | null;
  content: string | null;
  amount: number;
  signature_data: string | null;
  photo_urls: string[] | null;
  record_type: 'completion' | 'deposit';
  payment_method: string | null;
  memo: string | null;
  created_at: string;
}

export interface CompletionRecordInput {
  schedule_id: string;
  apartment_name?: string;
  unit_number?: string;
  customer_name?: string;
  phone?: string;
  content?: string;
  amount?: number;
  signature_data?: string;
  photo_urls?: string[];
  record_type?: 'completion' | 'deposit';
  payment_method?: string;
  memo?: string;
}

// ===== 품목 관련 타입 =====
export interface Item {
  id: string;
  user_id: string;
  name: string;
  price: number;
  category: ItemCategory | null;
  memo: string | null;
  photo_url: string | null;
  manual_url: string | null;
  spec_url: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export type ItemCategory = 'product' | 'part' | 'service' | 'etc';

export interface ItemInput {
  name: string;
  price?: number;
  category?: ItemCategory;
  memo?: string;
  photo_url?: string;
  manual_url?: string;
  spec_url?: string;
  sort_order?: number;
}

// ===== 매출 통계 타입 =====
export interface SalesStats {
  sale: number;
  as: number;
  wholesale: number;
  agency: number;
  group: number;
  install: number;
  purchase: number;
  total: number;
  grossSales?: number;
  netProfit?: number;
}

export interface PaymentStats {
  cash: number;
  card: number;
  vat: number;
  free: number;
}

export interface PendingStats {
  count: number;
  amount: number;
}

export interface DailySummary {
  sales: SalesStats;
  payment: PaymentStats;
  pending: PendingStats;
  scheduleCount: number;
  reservationCount: number;
}

// ===== UI 관련 타입 =====
export interface TabItem {
  id: string;
  label: string;
  icon: string;
}

// ===== 상수 =====
export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  sale: '판매',
  as: 'AS',
  wholesale: '총판',
  agency: '대리점',
  group: '공동구매',
  install: '외주설치',
  purchase: '외주매입',
  daily: '일당',
};

export const SCHEDULE_TYPE_OPTIONS: Array<{ value: ScheduleType; label: string }> = [
  { value: 'sale', label: '판매' },
  { value: 'as', label: 'AS' },
  { value: 'wholesale', label: '총판' },
  { value: 'agency', label: '대리점' },
  { value: 'group', label: '공동구매' },
  { value: 'install', label: '외주설치' },
  { value: 'purchase', label: '외주매입' },
];

export const SCHEDULE_TYPE_COLORS: Record<ScheduleType, {
  background: string;
  border: string;
  text: string;
  badgeBackground: string;
  badgeText: string;
  bar: string;
}> = {
  sale: {
    background: '#EFF6FF',
    border: '#93C5FD',
    text: '#1D4ED8',
    badgeBackground: '#DBEAFE',
    badgeText: '#1D4ED8',
    bar: '#3B82F6',
  },
  as: {
    background: '#F0FDF4',
    border: '#86EFAC',
    text: '#15803D',
    badgeBackground: '#DCFCE7',
    badgeText: '#15803D',
    bar: '#22C55E',
  },
  wholesale: {
    background: '#F0FDFA',
    border: '#5EEAD4',
    text: '#0F766E',
    badgeBackground: '#CCFBF1',
    badgeText: '#0F766E',
    bar: '#14B8A6',
  },
  agency: {
    background: '#F5F3FF',
    border: '#C4B5FD',
    text: '#6D28D9',
    badgeBackground: '#EDE9FE',
    badgeText: '#6D28D9',
    bar: '#8B5CF6',
  },
  group: {
    background: '#FEFCE8',
    border: '#FDE68A',
    text: '#A16207',
    badgeBackground: '#FEF3C7',
    badgeText: '#A16207',
    bar: '#EAB308',
  },
  install: {
    background: '#F9FAFB',
    border: '#D1D5DB',
    text: '#4B5563',
    badgeBackground: '#F3F4F6',
    badgeText: '#4B5563',
    bar: '#6B7280',
  },
  purchase: {
    background: '#FFF7ED',
    border: '#FDBA74',
    text: '#C2410C',
    badgeBackground: '#FFEDD5',
    badgeText: '#C2410C',
    bar: '#F97316',
  },
  daily: {
    background: '#F8FAFC',
    border: '#CBD5E1',
    text: '#475569',
    badgeBackground: '#E2E8F0',
    badgeText: '#475569',
    bar: '#64748B',
  },
};

export const REVENUE_SCHEDULE_TYPES: ScheduleType[] = ['sale', 'as', 'wholesale', 'agency', 'group', 'install', 'daily'];
export const EXPENSE_SCHEDULE_TYPES: ScheduleType[] = ['purchase'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '현금',
  card: '카드',
  vat: 'VAT',
  free: '무상',
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  apt: '아파트',
  villa: '빌라',
  officetel: '오피스텔',
  house: '단독주택',
  etc: '기타',
};

export const CLIENT_TYPE_ICONS: Record<ClientType, string> = {
  apt: '🏢',
  villa: '🏘️',
  officetel: '🏬',
  house: '🏠',
  etc: '📍',
};

// ===== 차량유지관리 관련 타입 =====
export type MaintenanceCategory = 'engine_oil' | 'tire' | 'brake' | 'battery' | 'etc';

export interface VehicleMaintenance {
  id: string;
  user_id: string;
  date: string;
  category: MaintenanceCategory;
  shop: string | null;
  cost: number;
  mileage: number | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleMaintenanceInput {
  date: string;
  category: MaintenanceCategory;
  shop?: string | null;
  cost?: number;
  mileage?: number | null;
  memo?: string | null;
}

export interface FuelRecord {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  cost: number;
  mileage: number | null;
  created_at: string;
  updated_at: string;
}

export interface FuelRecordInput {
  date: string;
  amount?: number;
  cost?: number;
  mileage?: number | null;
}

export const MAINTENANCE_CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  engine_oil: '엔진오일',
  tire: '타이어',
  brake: '브레이크',
  battery: '배터리',
  etc: '기타',
};

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  product: '제품',
  part: '부품/소모품',
  service: '서비스',
  etc: '기타',
};

export const DEFAULT_TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00'
];
