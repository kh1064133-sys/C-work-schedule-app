import { create } from 'zustand';
import type { EventIcon, PaymentMethod, ScheduleType } from '@/types';

type Tab = 'schedule' | 'calendar' | 'analytics' | 'clients' | 'items' | 'search' | 'estimate' | 'groupbuy' | 'install' | 'vehicle';

export interface CopiedScheduleData {
  title: string | null;
  unit: string | null;
  memo: string | null;
  schedule_type: ScheduleType | null;
  amount: number;
  payment_method: PaymentMethod | null;
  event_icon?: EventIcon | null;
  is_done?: boolean;
  is_reserved?: boolean;
  is_paid?: boolean;
}

interface UIState {
  activeTab: Tab;
  isSidebarOpen: boolean;
  isAddressModalOpen: boolean;
  isPhotoModalOpen: boolean;
  photoModalSrc: string | null;

  // 복사/붙여넣기 (탭 전환 시에도 유지)
  copiedSchedule: CopiedScheduleData | null;
  setCopiedSchedule: (data: CopiedScheduleData | null) => void;

  // 토글 섹션 상태 (페이지 이동 후에도 유지)
  showSelectedDate: boolean;
  showPrevPending: boolean;
  showReserved: boolean;
  showMonthlySales: boolean;
  showSalesSummary: boolean;
  showYearlySales: boolean;

  // 외주설치 페이지 대상 날짜 (설치 뱃지 클릭 시 설정)
  installTargetDate: string | null;
  setInstallTargetDate: (date: string | null) => void;

  // 탭 전환 가드 (스케줄 페이지 변경사항 감지)
  _tabChangeGuard: ((tab: Tab) => boolean) | null;
  setTabChangeGuard: (guard: ((tab: Tab) => boolean) | null) => void;
  _forceSetActiveTab: (tab: Tab) => void;

  // 탭 히스토리 (뒤로가기 지원)
  _tabHistory: Tab[];
  goBack: () => boolean;
  
  setActiveTab: (tab: Tab) => void;
  toggleSidebar: () => void;
  openAddressModal: () => void;
  closeAddressModal: () => void;
  openPhotoModal: (src: string) => void;
  closePhotoModal: () => void;
  toggleSection: (key: 'showSelectedDate' | 'showPrevPending' | 'showReserved' | 'showMonthlySales' | 'showSalesSummary' | 'showYearlySales') => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTab: 'calendar',
  isSidebarOpen: false,
  isAddressModalOpen: false,
  isPhotoModalOpen: false,
  photoModalSrc: null,

  copiedSchedule: null,
  setCopiedSchedule: (data) => set({ copiedSchedule: data }),

  showSelectedDate: true,
  showPrevPending: false,
  showReserved: false,
  showMonthlySales: false,
  showSalesSummary: false,
  showYearlySales: false,

  installTargetDate: null,
  setInstallTargetDate: (date) => set({ installTargetDate: date }),

  _tabChangeGuard: null,
  setTabChangeGuard: (guard) => set({ _tabChangeGuard: guard }),
  _forceSetActiveTab: (tab) => {
    const current = get().activeTab;
    if (current === tab) return;
    const history = [...get()._tabHistory, current];
    set({ activeTab: tab, _tabHistory: history.slice(-20) });
  },

  _tabHistory: [],
  goBack: () => {
    const history = [...get()._tabHistory];
    if (history.length === 0) return false;
    const prev = history.pop()!;
    set({ activeTab: prev, _tabHistory: history });
    return true;
  },
  
  setActiveTab: (tab) => {
    const guard = get()._tabChangeGuard;
    if (guard && !guard(tab)) return;
    const current = get().activeTab;
    if (current === tab) return;
    const history = [...get()._tabHistory, current];
    set({ activeTab: tab, _tabHistory: history.slice(-20) });
  },
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  openAddressModal: () => set({ isAddressModalOpen: true }),
  closeAddressModal: () => set({ isAddressModalOpen: false }),
  openPhotoModal: (src) => set({ isPhotoModalOpen: true, photoModalSrc: src }),
  closePhotoModal: () => set({ isPhotoModalOpen: false, photoModalSrc: null }),
  toggleSection: (key) => set((state) => ({ [key]: !state[key] })),
}));
