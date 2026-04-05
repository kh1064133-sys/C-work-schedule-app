'use client';

import { Calendar, ClipboardList, BarChart3, Building2, Package, Search, FileText, Camera, Calculator, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { useDateStore } from '@/stores/dateStore';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'schedule', label: '일별 스케줄', icon: ClipboardList },
  { id: 'calendar', label: '월별 달력', icon: Calendar },
  { id: 'analytics', label: '매출현황표', icon: BarChart3 },
  { id: 'clients', label: '거래처 관리', icon: Building2 },
  { id: 'items', label: '품목 관리', icon: Package },
  { id: 'search', label: '스케줄 검색', icon: Search },
  { id: 'estimate', label: '견적서', icon: FileText },
  { id: 'photodoc', label: '공사 사진대지', icon: Camera },
  { id: 'design-estimate', label: '설계내역서', icon: Calculator },
] as const;

export function Sidebar() {
  const { activeTab, setActiveTab, isSidebarOpen, toggleSidebar } = useUIStore();
  const { setSelectedDate, setCalendarDate } = useDateStore();

  const handleTabClick = (tabId: string) => {
    if (tabId === 'schedule' || tabId === 'calendar') {
      const today = new Date();
      setSelectedDate(today);
      setCalendarDate(today);
    }
    setActiveTab(tabId as any);
    if (window.innerWidth < 768) toggleSidebar();
  };

  return (
    <>
      {/* 모바일 오버레이 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={cn(
          'fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-card border-r z-50 transition-transform duration-200 md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:z-0'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b md:hidden">
          <span className="font-semibold">메뉴</span>
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="p-2 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
