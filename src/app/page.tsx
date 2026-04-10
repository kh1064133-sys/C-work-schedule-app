'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Header } from '@/components/shared/Header';
import { Sidebar } from '@/components/shared/Sidebar';
import { SchedulePage } from '@/components/schedule';
import { ClientsPage } from '@/components/clients';
import { ItemsPage } from '@/components/items';
import { CalendarPage } from '@/components/calendar';
import { AnalyticsPage } from '@/components/analytics';
import { SearchPage } from '@/components/search';
import { EstimateForm } from '@/components/estimate';
import { GroupBuyPage } from '@/components/groupbuy';
import { InstallPage } from '@/components/install';
import { VehiclePage } from '@/components/vehicle';
import { useUIStore } from '@/stores/uiStore';

// 탭별 콘텐츠 컴포넌트
function ScheduleContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-4">
      <SchedulePage />
    </div>
  );
}

function ClientsContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <ClientsPage />
    </div>
  );
}

function ItemsContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <ItemsPage />
    </div>
  );
}

function CalendarContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <CalendarPage />
    </div>
  );
}

function AnalyticsContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <AnalyticsPage />
    </div>
  );
}

function SearchContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <SearchPage />
    </div>
  );
}

function EstimateContent() {
  return (
    <div style={{ width: "100%" }}>
      <EstimateForm />
    </div>
  );
}

function GroupBuyContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <GroupBuyPage />
    </div>
  );
}

function InstallContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <InstallPage />
    </div>
  );
}

function VehicleContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <VehiclePage />
    </div>
  );
}

export default function Home() {
  const { activeTab, setActiveTab, isSidebarOpen, toggleSidebar } = useUIStore();

  // 앱 시작 시 오늘 날짜의 월별 달력으로 초기화
  useEffect(() => {
    setActiveTab('calendar');
    // PC(768px 이상)에서는 사이드바 열린 상태로 시작
    if (window.innerWidth >= 768 && !isSidebarOpen) {
      toggleSidebar();
    }
  }, []);

  // ── 뒤로가기 통합 핸들러 (Android 백버튼 + 키보드 Backspace + 브라우저 뒤로가기) ──
  useEffect(() => {
    // 공통 뒤로가기 로직
    const handleBack = () => {
      const store = useUIStore.getState();

      // 사이드바가 열려있으면 닫기
      if (store.isSidebarOpen) {
        store.toggleSidebar();
        return;
      }

      // calendar가 아닌 탭이면 calendar로 이동
      if (store.activeTab !== 'calendar') {
        store._forceSetActiveTab('calendar');
        return;
      }

      // calendar 탭에서 백버튼 → 앱 종료 확인
      if (confirm('앱을 종료하시겠습니까?')) {
        App.exitApp();
      }
    };

    // ★ 1) 키보드 Backspace — 가장 먼저 등록 (Capacitor 무관하게 항상 동작)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if ((document.activeElement as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // ★ 2) 환경 감지 후 뒤로가기 분기
    let capListener: { remove: () => void } | null = null;
    let popstateHandler: (() => void) | null = null;

    let isNative = false;
    try { isNative = Capacitor.isNativePlatform(); } catch { /* web */ }

    if (isNative) {
      // Android 하드웨어 백버튼 (Capacitor 네이티브)
      try {
        App.addListener('backButton', () => handleBack())
          .then(h => { capListener = h; });
      } catch { /* 플러그인 초기화 실패 무시 */ }
    } else {
      // 웹 브라우저: popstate로 뒤로가기 처리
      window.history.pushState({ app: true }, '');
      popstateHandler = () => {
        handleBack();
        window.history.pushState({ app: true }, '');
      };
      window.addEventListener('popstate', popstateHandler);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      capListener?.remove();
      if (popstateHandler) window.removeEventListener('popstate', popstateHandler);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'schedule':
        return <ScheduleContent />;
      case 'calendar':
        return <CalendarContent />;
      case 'analytics':
        return <AnalyticsContent />;
      case 'clients':
        return <ClientsContent />;
      case 'items':
        return <ItemsContent />;
      case 'search':
        return <SearchContent />;
      case 'estimate':
        return <EstimateContent />;
      case 'groupbuy':
        return <GroupBuyContent />;
      case 'install':
        return <InstallContent />;
      case 'vehicle':
        return <VehicleContent />;
      default:
        return <ScheduleContent />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="no-print">
        <Header />
      </div>
      
      <div className="flex">
        <div className="no-print">
          <Sidebar />
        </div>
        
        <main className="flex-1 p-1 md:p-6 max-w-7xl mx-auto w-full print-area">
          {/* 탭 콘텐츠 */}
          <div className="mb-6 animate-fade-in print-area">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
