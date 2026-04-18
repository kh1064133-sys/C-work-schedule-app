'use client';

import { useRef, useState } from 'react';
import { Calendar, ClipboardList, BarChart3, Building2, Package, Search, Menu, Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { useDateStore } from '@/stores/dateStore';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const tabs = [
  { id: 'schedule', label: '일별 스케줄', icon: ClipboardList },
  { id: 'calendar', label: '월별 달력', icon: Calendar },
  { id: 'analytics', label: '매출현황표', icon: BarChart3 },
  { id: 'clients', label: '거래처 관리', icon: Building2 },
  { id: 'items', label: '품목 관리', icon: Package },
  { id: 'search', label: '스케줄 검색', icon: Search },
] as const;

const isMobile = () => Capacitor.isNativePlatform();

export function Header() {
  const { activeTab, setActiveTab, toggleSidebar } = useUIStore();
  const { setSelectedDate, setCalendarDate } = useDateStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [showFileList, setShowFileList] = useState(false);

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

      const fileName = `일정관리_백업_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
      const jsonString = JSON.stringify(exportData, null, 2);

      if (isMobile()) {
        // 모바일: Capacitor Filesystem으로 Documents에 저장
        await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        alert(`저장 완료!\n\n📁 Documents/${fileName}\n\n스케줄: ${exportData.schedules.length}건\n거래처: ${exportData.clients.length}건\n품목: ${exportData.items.length}건`);
        setSaveStatus('저장 완료!');
      } else {
        // 웹: 브라우저 다운로드
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        setSaveStatus('저장 완료!');
      }

      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setSaveStatus('저장 실패');
      alert('저장에 실패했습니다.\n' + (error instanceof Error ? error.message : ''));
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  // 백업 데이터 복원 처리 (공통)
  const restoreFromJson = async (text: string, sourceName: string) => {
    const data = JSON.parse(text);

    if (!data.schedules || !data.clients || !data.items) {
      throw new Error('올바른 백업 파일이 아닙니다');
    }

    const supabase = createClient();

    const confirmReplace = window.confirm(
      `백업 파일: ${sourceName}\n\n` +
      `- 스케줄: ${data.schedules.length}건\n` +
      `- 거래처: ${data.clients.length}건\n` +
      `- 품목: ${data.items.length}건\n\n` +
      `기존 데이터를 모두 삭제하고 가져올까요?\n` +
      `(취소하면 기존 데이터에 추가됩니다)`
    );

    if (confirmReplace) {
      await Promise.all([
        supabase.from('schedules').delete().neq('id', ''),
        supabase.from('clients').delete().neq('id', ''),
        supabase.from('items').delete().neq('id', ''),
      ]);
    }

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
  };

  // 모바일: Documents에서 백업 파일 검색 후 목록 표시
  const handleMobileImport = async () => {
    setIsImporting(true);
    setSaveStatus('파일 검색 중...');

    try {
      const result = await Filesystem.readdir({
        path: '',
        directory: Directory.Documents,
      });

      const jsonFiles = result.files
        .filter(f => f.name.startsWith('일정관리_백업_') && f.name.endsWith('.json'))
        .map(f => f.name)
        .sort()
        .reverse(); // 최신순

      if (jsonFiles.length === 0) {
        alert('Documents 폴더에 백업 파일이 없습니다.\n\n먼저 "저장" 버튼으로 백업을 생성해주세요.');
        setSaveStatus('');
        setIsImporting(false);
        return;
      }

      if (jsonFiles.length === 1) {
        // 파일 1개면 바로 복원
        await loadMobileBackup(jsonFiles[0]);
      } else {
        // 여러 개면 목록 표시
        setBackupFiles(jsonFiles);
        setShowFileList(true);
        setSaveStatus('');
        setIsImporting(false);
      }
    } catch (error) {
      console.error('File search failed:', error);
      alert('파일 검색에 실패했습니다.\n' + (error instanceof Error ? error.message : ''));
      setSaveStatus('');
      setIsImporting(false);
    }
  };

  // 모바일: 선택한 백업 파일 로드
  const loadMobileBackup = async (fileName: string) => {
    setIsImporting(true);
    setShowFileList(false);
    setSaveStatus('불러오는 중...');

    try {
      const fileData = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });

      await restoreFromJson(fileData.data as string, fileName);

      setSaveStatus('불러오기 완료!');
      setTimeout(() => {
        setSaveStatus('');
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Import failed:', error);
      setSaveStatus('불러오기 실패');
      alert('불러오기에 실패했습니다.\n' + (error instanceof Error ? error.message : ''));
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setIsImporting(false);
    }
  };

  // 웹: 파일 선택 다이얼로그로 가져오기
  const handleWebImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setSaveStatus('불러오는 중...');

    try {
      const text = await file.text();
      await restoreFromJson(text, file.name);

      setSaveStatus('불러오기 완료!');
      setTimeout(() => {
        setSaveStatus('');
        window.location.reload();
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

  // 불러오기 버튼 클릭 핸들러
  const handleImportClick = () => {
    if (isMobile()) {
      handleMobileImport();
    } else {
      fileInputRef.current?.click();
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
            <h1 className="text-base sm:text-lg font-bold truncate">일정 및 매출 관리</h1>
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
            onClick={handleImportClick}
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
            onClick={handleImportClick}
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
            onChange={handleWebImport}
          />
        </div>
      </div>

      {/* 모바일 백업 파일 선택 모달 */}
      {showFileList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowFileList(false)}>
          <div className="bg-white rounded-xl shadow-2xl mx-4 max-w-sm w-full max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white">
              <h3 className="font-bold text-base">백업 파일 선택</h3>
              <p className="text-xs text-white/80">Documents 폴더에서 {backupFiles.length}개 발견</p>
            </div>
            <div className="overflow-y-auto max-h-[50vh] divide-y">
              {backupFiles.map((file, idx) => (
                <button
                  key={file}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 flex items-center gap-3 text-gray-800"
                  onClick={() => loadMobileBackup(file)}
                >
                  <span className="text-sm font-bold text-blue-600 shrink-0">{idx + 1}</span>
                  <span className="text-sm truncate">{file}</span>
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t">
              <button
                className="w-full py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
                onClick={() => setShowFileList(false)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
