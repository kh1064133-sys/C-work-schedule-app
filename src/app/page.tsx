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
import { useDateStore } from '@/stores/dateStore';
import { formatDateKorean } from '@/lib/utils/date';
import { useSchedulesByDate } from '@/hooks/useSchedules';
import type { Schedule } from '@/types';

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

// 일 매출 전용 컨테이너
function DailySalesContainer() {
  const { selectedDate } = useDateStore();
  const { data: schedules = [] } = useSchedulesByDate(selectedDate);
  
  // 완료된 스케줄만 필터
  const doneSchedules = schedules.filter((s: Schedule) => s.is_done);
  
  // 유형별 매출 계산
  const salesByType = {
    sale: doneSchedules.filter((s: Schedule) => s.schedule_type === 'sale').reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0),
    as: doneSchedules.filter((s: Schedule) => s.schedule_type === 'as').reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0),
    agency: doneSchedules.filter((s: Schedule) => s.schedule_type === 'agency').reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0),
  };
  
  // 결제방법별 매출 계산
  const salesByPayment = {
    cash: doneSchedules.filter((s: Schedule) => s.payment_method === 'cash').reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0),
    card: doneSchedules.filter((s: Schedule) => s.payment_method === 'card').reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0),
    vat: doneSchedules.filter((s: Schedule) => s.payment_method === 'vat').reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0),
  };
  
  const total = doneSchedules.reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0);
  
  // 미결 건수/금액
  const pendingSchedules = schedules.filter((s: Schedule) => s.title && !s.is_done);
  const pendingCount = pendingSchedules.length;
  const pendingAmount = pendingSchedules.reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0);
  
  return (
    <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl p-4 shadow-lg">
      <h2 className="text-lg font-bold mb-3">💰 {formatDateKorean(selectedDate)} 매출 현황</h2>
      
      <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm">
        <div className="space-y-2 text-sm">
          {/* 유형별 매출 */}
          <div className="flex justify-between items-center">
            <span className="bg-white/90 text-green-600 px-2 py-0.5 rounded-full text-xs font-bold">판매</span>
            <span className="font-semibold">{salesByType.sale.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="bg-white/90 text-orange-500 px-2 py-0.5 rounded-full text-xs font-bold">AS</span>
            <span className="font-semibold">{salesByType.as.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="bg-white/90 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold">대리점</span>
            <span className="font-semibold">{salesByType.agency.toLocaleString()}원</span>
          </div>
          
          <div className="border-t border-white/20 my-2" />
          
          <div className="flex justify-between items-center font-bold">
            <span>합계</span>
            <span className="text-lg">{total.toLocaleString()}원</span>
          </div>
          
          <div className="border-t border-white/20 my-2" />
          
          {/* 결제방법별 */}
          <div className="flex justify-between items-center">
            <span className="bg-white/90 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">현금</span>
            <span className="text-green-200">{salesByPayment.cash.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="bg-white/90 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">카드</span>
            <span className="text-blue-200">{salesByPayment.card.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="bg-white/90 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">VAT</span>
            <span className="text-orange-200">{salesByPayment.vat.toLocaleString()}원</span>
          </div>
          
          {/* 미결 */}
          {pendingCount > 0 && (
            <>
              <div className="border-t border-white/20 my-2" />
              <div className="flex justify-between items-center bg-red-500/20 rounded-lg px-2 py-1">
                <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">⚠ 미결</span>
                <div className="flex items-center gap-2">
                  <span className="text-red-200 font-bold">{pendingCount}건</span>
                  <span className="text-white/50">/</span>
                  <span className="text-red-100">{pendingAmount.toLocaleString()}원</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { activeTab, setActiveTab, isSidebarOpen, toggleSidebar } = useUIStore();
  const { goToToday } = useDateStore();

  // 앱 시작 시 오늘 날짜의 월별 달력으로 초기화
  useEffect(() => {
    goToToday();
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

          {/* 일매출 현황 (일별 스케줄 탭에서만 표시) */}
          {activeTab === 'schedule' && <DailySalesContainer />}
        </main>
      </div>
    </div>
  );
}
