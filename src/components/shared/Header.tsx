'use client';

import { useRef, useState } from 'react';
import { Calendar, ClipboardList, BarChart3, Building2, Package, Search, Menu, Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

const tabs = [
  { id: 'schedule', label: '일별 스케줄', icon: ClipboardList },
  { id: 'calendar', label: '월별 달력', icon: Calendar },
  { id: 'analytics', label: '매출현황표', icon: BarChart3 },
  { id: 'clients', label: '거래처 관리', icon: Building2 },
  { id: 'items', label: '품목 관리', icon: Package },
  { id: 'search', label: '스케줄 검색', icon: Search },
] as const;

export function Header() {
  const { activeTab, setActiveTab, toggleSidebar } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // 데이터 내보내기
  const handleExport = async () => {
    setIsExporting(true);
    setSaveStatus('저장 중...');
    
    try {
      const supabase = createClient();
      
      // 모든 데이터 가져오기
      const [schedulesRes, clientsRes, itemsRes] = await Promise.all([
        supabase.from('schedules').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('items').select('*'),
      ]);

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        schedules: schedulesRes.data || [],
        clients: clientsRes.data || [],
        items: itemsRes.data || [],
      };

      // JSON 파일 다운로드
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `일정관리_백업_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
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

      if (!data.schedules || !data.clients || !data.items) {
        throw new Error('Invalid backup file format');
      }

      const supabase = createClient();

      // 기존 데이터 삭제 여부 확인
      const confirmReplace = window.confirm(
        `백업 파일 정보:\n` +
        `- 스케줄: ${data.schedules.length}건\n` +
        `- 거래처: ${data.clients.length}건\n` +
        `- 품목: ${data.items.length}건\n\n` +
        `기존 데이터를 모두 삭제하고 가져올까요?\n` +
        `(취소하면 기존 데이터에 추가됩니다)`
      );

      if (confirmReplace) {
        // 기존 데이터 삭제
        await Promise.all([
          supabase.from('schedules').delete().neq('id', ''),
          supabase.from('clients').delete().neq('id', ''),
          supabase.from('items').delete().neq('id', ''),
        ]);
      }

      // 새 데이터 삽입
      const insertPromises = [];
      
      if (data.schedules.length > 0) {
        insertPromises.push(supabase.from('schedules').upsert(data.schedules));
      }
      if (data.clients.length > 0) {
        insertPromises.push(supabase.from('clients').upsert(data.clients));
      }
      if (data.items.length > 0) {
        insertPromises.push(supabase.from('items').upsert(data.items));
      }

      await Promise.all(insertPromises);

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
      <div className="flex h-16 items-center px-4 gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-white hover:bg-white/20 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <h1 className="text-lg font-bold">일정 및 매출 관리</h1>
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
              onClick={() => setActiveTab(tab.id)}
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
            className="sm:hidden flex items-center justify-center rounded-full bg-white/20 active:bg-white/30"
            style={{ width: 34, height: 34 }}
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
            className="sm:hidden flex items-center justify-center rounded-full bg-white/25 active:bg-white/35"
            style={{ width: 34, height: 34 }}
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
