'use client';

import { useRef, useState } from 'react';
import { Calendar, ClipboardList, BarChart3, Building2, Package, Search, Menu, Download, Upload, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { useDateStore } from '@/stores/dateStore';
import { getAllStoredData, setAllStoredData } from '@/lib/storage';
import { format } from 'date-fns';

const tabs = [
  { id: 'schedule', label: '일별 스케줄', icon: ClipboardList },
  { id: 'calendar', label: '월별 달력', icon: Calendar },
  { id: 'analytics', label: '매출현황표', icon: BarChart3 },
  { id: 'clients', label: '거래처 관리', icon: Building2 },
  { id: 'items', label: '품목 관리', icon: Package },
  { id: 'work-types', label: '작업종별', icon: Wrench },
  { id: 'search', label: '스케줄 검색', icon: Search },
] as const;

export function Header() {
  const { activeTab, setActiveTab, toggleSidebar } = useUIStore();
  const { setSelectedDate, setCalendarDate } = useDateStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // 데이터 내보내기
  const handleExport = async () => {
    setIsExporting(true);
    setSaveStatus('저장 중...');
    
    try {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        ...getAllStoredData(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DSinet_백업_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setSaveStatus('저장 완료!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setSaveStatus('저장 실패');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  // 데이터 가져오기
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setSaveStatus('불러오는 중...');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version) {
        throw new Error('Invalid backup file format');
      }

      const confirmReplace = window.confirm(
        `백업 파일을 불러옵니다.\n\n` +
        `기존 데이터를 모두 삭제하고 가져올까요?\n` +
        `(취소하면 중단됩니다)`
      );

      if (!confirmReplace) return;

      // dsinet_ 접두사가 있는 localStorage 항목 모두 삭제
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('dsinet_')) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // 새 데이터 삽입
      const { version, exportedAt, ...rest } = data;
      setAllStoredData(rest);

      setSaveStatus('불러오기 완료!');
      setTimeout(() => {
        setSaveStatus('');
        window.location.reload(); // 페이지 새로고침으로 데이터 반영
      }, 1500);
    } catch (error) {
      console.error('Import failed:', error);
      setSaveStatus('불러오기 실패');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-lg">
      <div className="flex h-16 items-center px-2 gap-2 sm:px-4 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-white hover:bg-white/20 md:hidden shrink-0"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-xl sm:text-2xl shrink-0">📅</span>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">DSinet</h1>
            <p className="text-xs text-white/80 hidden sm:block">스케줄 관리 · 매출 추적 · 거래처 관리</p>
          </div>
        </div>

        {/* 데스크탑 탭 네비게이션 */}
        <nav className="hidden md:flex items-center gap-1 ml-8">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => {
                if (tab.id === 'schedule' || tab.id === 'calendar') {
                  const today = new Date();
                  setSelectedDate(today);
                  setCalendarDate(today);
                }
                setActiveTab(tab.id);
              }}
              className={`text-white hover:bg-white/20 ${
                activeTab === tab.id ? 'bg-white/25' : ''
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs text-white/90 font-medium">{saveStatus}</span>
          )}
          {/* 모바일: 아이콘 뱃지 */}
          <button
            className="sm:hidden flex items-center justify-center rounded-full bg-white/20 active:bg-white/30 shrink-0"
            style={{ width: 32, height: 32 }}
            onClick={handleExport}
            disabled={isExporting}
            title="데이터 저장"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 text-white animate-spin" />
            ) : (
              <Download className="h-4 w-4 text-white" />
            )}
          </button>
          <button
            className="sm:hidden flex items-center justify-center rounded-full bg-white/25 active:bg-white/35 shrink-0"
            style={{ width: 32, height: 32 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="데이터 불러오기"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 text-white animate-spin" />
            ) : (
              <Upload className="h-4 w-4 text-white" />
            )}
          </button>
          {/* 데스크탑: 텍스트 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 hidden sm:flex"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            저장
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="hidden sm:flex"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            불러오기
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>
    </header>
  );
}
