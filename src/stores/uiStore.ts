import { create } from 'zustand';

type Tab = 'schedule' | 'calendar' | 'analytics' | 'clients' | 'items' | 'search';

interface UIState {
  activeTab: Tab;
  isSidebarOpen: boolean;
  isAddressModalOpen: boolean;
  isPhotoModalOpen: boolean;
  photoModalSrc: string | null;
  
  setActiveTab: (tab: Tab) => void;
  toggleSidebar: () => void;
  openAddressModal: () => void;
  closeAddressModal: () => void;
  openPhotoModal: (src: string) => void;
  closePhotoModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'calendar',
  isSidebarOpen: true,
  isAddressModalOpen: false,
  isPhotoModalOpen: false,
  photoModalSrc: null,
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  openAddressModal: () => set({ isAddressModalOpen: true }),
  closeAddressModal: () => set({ isAddressModalOpen: false }),
  openPhotoModal: (src) => set({ isPhotoModalOpen: true, photoModalSrc: src }),
  closePhotoModal: () => set({ isPhotoModalOpen: false, photoModalSrc: null }),
}));
