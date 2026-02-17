'use client';

import { Header } from '@/components/shared/Header';
import { Sidebar } from '@/components/shared/Sidebar';
import { SalesSummary, emptySalesData } from '@/components/shared/SalesSummary';
import { SchedulePage } from '@/components/schedule';
import { ClientsPage } from '@/components/clients';
import { ItemsPage } from '@/components/items';
import { CalendarPage } from '@/components/calendar';
import { AnalyticsPage } from '@/components/analytics';
import { SearchPage } from '@/components/search';
import { useUIStore } from '@/stores/uiStore';
import { useDateStore } from '@/stores/dateStore';
import { formatDateKorean } from '@/lib/utils/date';

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
  const { activeTab } = useUIStore();

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

          {/* 매출 요약 (항상 표시) */}
          <SalesSummary 
            daily={emptySalesData}
            monthly={emptySalesData}
            yearly={emptySalesData}
          />
        </main>
      </div>
    </div>
  );
}
