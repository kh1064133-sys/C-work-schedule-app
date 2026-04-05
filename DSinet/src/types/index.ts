// ===== 스케줄 관련 타입 =====
export interface Schedule {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  time_slot: string; // "09:00", "14:30" 등
  title: string | null;
  unit: string | null; // 동호수
  memo: string | null;
  schedule_type: ScheduleType | null;
  amount: number;
  payment_method: PaymentMethod | null;
  is_done: boolean;
  is_reserved: boolean;
  is_paid: boolean;
  event_icon: EventIcon | null;
  install_type: ScheduleType | null;
  install_amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ScheduleType = 'sale' | 'as' | 'agency' | 'group' | 'install';
export type PaymentMethod = 'cash' | 'card' | 'vat' | 'free';
export type EventIcon = 'golf' | 'birthday' | 'meeting' | 'install';

export interface ScheduleInput {
  date: string;
  time_slot: string;
  title?: string | null;
  unit?: string | null;
  memo?: string | null;
  schedule_type?: ScheduleType | null;
  amount?: number;
  payment_method?: PaymentMethod | null;
  is_done?: boolean;
  is_reserved?: boolean;
  is_paid?: boolean;
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
}

// ===== 매출 통계 타입 =====
export interface SalesStats {
  sale: number;
  as: number;
  agency: number;
  total: number;
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
  agency: '대리점',
  group: '공동구매',
  install: '외주설치',
};

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
