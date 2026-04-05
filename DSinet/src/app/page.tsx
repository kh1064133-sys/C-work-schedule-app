'use client';

import { useEffect } from 'react';
import { Header } from '@/components/shared/Header';
import { Sidebar } from '@/components/shared/Sidebar';
import { SchedulePage } from '@/components/schedule';
import { ClientsPage } from '@/components/clients';
import { ItemsPage } from '@/components/items';
import { CalendarPage } from '@/components/calendar';
import { AnalyticsPage } from '@/components/analytics';
import { SearchPage } from '@/components/search';
import { EstimateForm } from '@/components/estimate';
import { PhotoDocPage } from '@/components/photodoc';
import { DesignEstimatePage } from '@/components/design-estimate';
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

function PhotoDocContent() {
  return (
    <div style={{ width: "100%" }}>
      <PhotoDocPage />
    </div>
  );
}

function DesignEstimateContent() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-1 md:p-6">
      <DesignEstimatePage />
    </div>
  );
}

export default function Home() {
  const { activeTab, setActiveTab, isSidebarOpen, toggleSidebar } = useUIStore();

  useEffect(() => {
    setActiveTab('calendar');
    if (window.innerWidth >= 768 && !isSidebarOpen) {
      toggleSidebar();
    }
  }, []);

  useEffect(() => {
    // PC only - no Android back button needed
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
      case 'photodoc':
        return <PhotoDocContent />;
      case 'design-estimate':
        return <DesignEstimateContent />;
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
