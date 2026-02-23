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
import { useUIStore } from '@/stores/uiStore';

// 탭별 콘텐츠 컴포넌트
function ScheduleContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <SchedulePage />
    </div>
  );
}

function ClientsContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <ClientsPage />
    </div>
  );
}

function ItemsContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <ItemsPage />
    </div>
  );
}

function CalendarContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <CalendarPage />
    </div>
  );
}

function AnalyticsContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <AnalyticsPage />
    </div>
  );
}

function SearchContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <SearchPage />
    </div>
  );
}

export default function Home() {
  const { activeTab, setActiveTab, isSidebarOpen, toggleSidebar } = useUIStore();

  // 앱 시작 시 오늘 날짜의 월별 달력으로 초기화
  useEffect(() => {
    setActiveTab('calendar');
  }, []);

  // Android 백버튼 핸들러
  useEffect(() => {
    let listener: { remove: () => void } | null = null;
    
    App.addListener('backButton', ({ canGoBack }) => {
      // 사이드바가 열려있으면 닫기
      if (isSidebarOpen) {
        toggleSidebar();
        return;
      }
      
      // 현재 탭이 calendar가 아니면 calendar로 이동
      if (activeTab !== 'calendar') {
        setActiveTab('calendar');
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
  }, [activeTab, isSidebarOpen, setActiveTab, toggleSidebar]);

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
      default:
        return <ScheduleContent />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
          {/* 탭 콘텐츠 */}
          <div className="mb-6 animate-fade-in">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
