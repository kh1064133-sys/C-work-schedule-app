'use client';

import { useEffect } from 'react';
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

  // Android 백버튼 핸들러
  useEffect(() => {
    let listener: { remove: () => void } | null = null;
    
    App.addListener('backButton', ({ canGoBack }) => {
      // 최신 상태를 직접 참조 (클로저 문제 방지)
      const store = useUIStore.getState();
      
      // 사이드바가 열려있으면 닫기
      if (store.isSidebarOpen) {
        store.toggleSidebar();
        return;
      }
      
      // 현재 탭이 calendar가 아니면 calendar로 이동 (guard 거침)
      if (store.activeTab !== 'calendar') {
        store.setActiveTab('calendar');
        return;
      }
      
      // calendar 탭에서 백버튼 누르면 앱 종료 확인
      if (confirm('앱을 종료하시겠습니까?')) {
        App.exitApp();
      }
    }).then(handle => {
      listener = handle;
    });

    return () => {
      listener?.remove();
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
