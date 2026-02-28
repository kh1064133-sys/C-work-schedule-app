import { create } from 'zustand';

type Tab = 'schedule' | 'calendar' | 'analytics' | 'clients' | 'items' | 'search' | 'estimate';

export interface CopiedScheduleData {
  title: string | null;
  unit: string | null;
  memo: string | null;
  schedule_type: string | null;
  amount: number;
  payment_method: string | null;
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
  
  setActiveTab: (tab: Tab) => void;
  toggleSidebar: () => void;
  openAddressModal: () => void;
  closeAddressModal: () => void;
  openPhotoModal: (src: string) => void;
  closePhotoModal: () => void;
  toggleSection: (key: 'showSelectedDate' | 'showPrevPending' | 'showReserved' | 'showMonthlySales' | 'showSalesSummary' | 'showYearlySales') => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'calendar',
  isSidebarOpen: true,
  isAddressModalOpen: false,
  isPhotoModalOpen: false,
  photoModalSrc: null,

  copiedSchedule: null,
  setCopiedSchedule: (data) => set({ copiedSchedule: data }),

  showSelectedDate: true,
  showPrevPending: true,
  showReserved: true,
  showMonthlySales: true,
  showSalesSummary: true,
  showYearlySales: true,
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  openAddressModal: () => set({ isAddressModalOpen: true }),
  closeAddressModal: () => set({ isAddressModalOpen: false }),
  openPhotoModal: (src) => set({ isPhotoModalOpen: true, photoModalSrc: src }),
  closePhotoModal: () => set({ isPhotoModalOpen: false, photoModalSrc: null }),
  toggleSection: (key) => set((state) => ({ [key]: !state[key] })),
}));
