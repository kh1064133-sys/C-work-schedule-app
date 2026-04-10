'use client';

import { useState, useMemo } from 'react';
import { Search, RotateCcw, FileSpreadsheet, Calendar, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchSchedules } from '@/hooks/useSchedules';
import { useDateStore } from '@/stores/dateStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { format, subMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Schedule, ScheduleType, PaymentMethod } from '@/types';

const SCHEDULE_TYPES = [
  { value: '', label: '전체' },
  { value: 'sale', label: '판매' },
  { value: 'as', label: 'AS' },
  { value: 'agency', label: '대리점' },
  { value: 'group', label: '공동구매' },
];

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  sale: '판매',
  as: 'AS',
  agency: '대리점',
  group: '공동구매',
  install: '외주설치',
  daily: '일당',
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '현금',
  card: '카드',
  vat: 'VAT',
  free: '무상',
};

export function SearchPage() {
  const { setSelectedDate } = useDateStore();
  const { setActiveTab } = useUIStore();
  
  // 검색 조건
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(() => format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [scheduleType, setScheduleType] = useState('');
  
  // 실제 검색에 사용할 파라미터 (검색 버튼 클릭 시 업데이트)
  const [searchParams, setSearchParams] = useState<{
    query?: string;
    fromDate?: string;
    toDate?: string;
    type?: string;
  }>({});

  // 검색 실행
  const { data: results = [], isLoading, isFetching } = useSearchSchedules(searchParams);

  // 검색 실행
  const handleSearch = () => {
    setSearchParams({
      query: searchQuery || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      type: scheduleType || undefined,
    });
  };

  // 초기화
  const handleReset = () => {
    setSearchQuery('');
    setFromDate(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
    setToDate(format(new Date(), 'yyyy-MM-dd'));
    setScheduleType('');
    setSearchParams({});
  };

  // 엔터키 검색
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 통계 계산
  const stats = useMemo(() => {
    const totalAmount = results
      .filter((s: Schedule) => s.is_done)
      .reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0);
    const doneCount = results.filter((s: Schedule) => s.is_done).length;
    const pendingCount = results.filter((s: Schedule) => !s.is_done && s.title).length;
    
    return { totalAmount, doneCount, pendingCount, totalCount: results.length };
  }, [results]);

  // 엑셀 다운로드
  const handleExcelExport = () => {
    if (results.length === 0) return;

    // 데이터 준비
    const headers = ['날짜', '시간', '거래처명', '동호수', '내용', '유형', '금액', '결제방법', '완료', '예약'];
    const rows = results.map((s: Schedule) => ({
      '날짜': s.date,
      '시간': s.time_slot,
      '거래처명': s.title || '',
      '동호수': s.unit || '',
      '내용': s.memo || '',
      '유형': s.schedule_type ? SCHEDULE_TYPE_LABELS[s.schedule_type] : '',
      '금액': s.amount || 0,
      '결제방법': s.payment_method ? PAYMENT_METHOD_LABELS[s.payment_method] : '',
      '완료': s.is_done ? 'O' : '',
      '예약': s.is_reserved ? 'O' : '',
    }));

    // xlsx 파일 생성
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '검색결과');
    
    // 열 너비 자동 조정
    worksheet['!cols'] = headers.map(() => ({ wch: 15 }));
    
    // 다운로드
    XLSX.writeFile(workbook, `스케줄_검색결과_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  // 날짜 클릭 시 해당 일별 스케줄로 이동
  const handleDateClick = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    setSelectedDate(new Date(year, month - 1, day));
    setActiveTab('schedule');
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Search className="h-5 w-5" />
          스케줄 검색
        </h2>
      </div>

      {/* 검색 바 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="거래처명, 동호수, 내용 검색..."
            className="w-full pl-10 pr-4 py-3 border-2 border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-base"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </div>
        <Button onClick={handleSearch} className="px-6">
          검색
        </Button>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%', flexWrap: 'nowrap', overflow: 'hidden' }}>
          <span style={{ fontSize: 13, color: '#4b5563', flexShrink: 0, whiteSpace: 'nowrap' }}>기간:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              maxWidth: '40%',
              height: 34,
              fontSize: 13,
              paddingLeft: 6,
              paddingRight: 6,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              boxSizing: 'border-box',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              outline: 'none',
              backgroundColor: '#fff',
            }}
          />
          <span style={{ color: '#9ca3af', flexShrink: 0 }}>~</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              maxWidth: '40%',
              height: 34,
              fontSize: 13,
              paddingLeft: 6,
              paddingRight: 6,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              boxSizing: 'border-box',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              outline: 'none',
              backgroundColor: '#fff',
            }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#4b5563', flexShrink: 0 }}>유형:</span>
          <select
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value)}
            style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, backgroundColor: '#fff', outline: 'none' }}
          >
            {SCHEDULE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
          <RotateCcw className="h-3 w-3" />
          초기화
        </Button>
      </div>

      {/* 결과 정보 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          {Object.keys(searchParams).length > 0 && (
            <>
              <span className="text-gray-600 whitespace-nowrap">
                검색결과: <span className="font-bold text-primary">{stats.totalCount}건</span>
              </span>
              <span className="text-gray-600 whitespace-nowrap">
                완료: <span className="font-bold text-green-600">{stats.doneCount}건</span>
              </span>
              <span className="text-gray-600 whitespace-nowrap">
                미결: <span className="font-bold text-red-500">{stats.pendingCount}건</span>
              </span>
              <span className="text-gray-600 whitespace-nowrap">
                매출합계: <span className="font-bold text-emerald-600">{stats.totalAmount.toLocaleString()}원</span>
              </span>
            </>
          )}
        </div>
        
        {results.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExcelExport} className="gap-1 text-green-700 border-green-600 hover:bg-green-50">
            <FileSpreadsheet className="h-4 w-4" />
            엑셀 다운로드
          </Button>
        )}
      </div>

      {/* 결과 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div style={{ overflowX: 'auto', maxHeight: '60vh', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'clamp(9px, 2vw, 13px)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ width: '11%', minWidth: 55, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>날짜</th>
                <th style={{ width: '9%', minWidth: 42, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>시간</th>
                <th style={{ width: '20%', minWidth: 70, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>거래처명</th>
                <th style={{ width: '11%', minWidth: 50, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>동호수</th>
                <th style={{ width: '15%', minWidth: 55, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>내용</th>
                <th style={{ width: '8%', minWidth: 35, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>유형</th>
                <th style={{ width: '13%', minWidth: 55, padding: '4px 3px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>금액</th>
                <th style={{ width: '7%', minWidth: 30, padding: '4px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>결제</th>
                <th style={{ width: '6%', minWidth: 28, padding: '4px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || isFetching ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: '#6b7280' }}>
                    검색 중...
                  </td>
                </tr>
              ) : Object.keys(searchParams).length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: '#6b7280' }}>
                    검색어를 입력하거나 필터를 설정한 후 검색 버튼을 클릭하세요.
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: '#6b7280' }}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                results.map((schedule: Schedule) => (
                  <tr
                    key={schedule.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      backgroundColor: schedule.is_done ? 'rgba(240,253,244,0.5)' : undefined,
                    }}
                    onClick={() => handleDateClick(schedule.date)}
                  >
                    <td style={{ padding: '4px 3px', whiteSpace: 'nowrap', color: '#4f46e5', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {schedule.date.slice(5)}
                    </td>
                    <td style={{ padding: '4px 3px', whiteSpace: 'nowrap', color: '#6b7280' }}>
                      {schedule.time_slot}
                    </td>
                    <td style={{ padding: '4px 3px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schedule.title || '-'}</td>
                    <td style={{ padding: '4px 3px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schedule.unit || '-'}</td>
                    <td style={{ padding: '4px 3px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schedule.memo || '-'}</td>
                    <td style={{ padding: '4px 3px', whiteSpace: 'nowrap' }}>
                      {schedule.schedule_type && (
                        <span className={cn(
                          'px-1 py-0.5 rounded-full font-bold',
                          schedule.schedule_type === 'sale' && 'bg-green-100 text-green-700',
                          schedule.schedule_type === 'as' && 'bg-orange-100 text-orange-700',
                          schedule.schedule_type === 'agency' && 'bg-indigo-100 text-indigo-700',
                          schedule.schedule_type === 'group' && 'bg-pink-100 text-pink-700',
                        )} style={{ fontSize: 'clamp(8px, 1.8vw, 12px)' }}>
                          {SCHEDULE_TYPE_LABELS[schedule.schedule_type]}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: '#059669' }}>
                      {schedule.amount ? schedule.amount.toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '4px 3px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {schedule.payment_method && (
                        <span className={cn(
                          'px-1 py-0.5 rounded font-bold',
                          schedule.payment_method === 'cash' && 'bg-green-100 text-green-700',
                          schedule.payment_method === 'card' && 'bg-blue-100 text-blue-700',
                          schedule.payment_method === 'vat' && 'bg-orange-100 text-orange-700',
                        )} style={{ fontSize: 'clamp(8px, 1.8vw, 12px)' }}>
                          {PAYMENT_METHOD_LABELS[schedule.payment_method]}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '4px 3px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {schedule.is_done ? (
                        <span style={{ padding: '1px 4px', borderRadius: 4, backgroundColor: '#dcfce7', color: '#15803d', fontSize: 'clamp(8px, 1.8vw, 12px)', fontWeight: 700 }}>완료</span>
                      ) : schedule.title ? (
                        <span style={{ padding: '1px 4px', borderRadius: 4, backgroundColor: '#fee2e2', color: '#dc2626', fontSize: 'clamp(8px, 1.8vw, 12px)', fontWeight: 700 }}>미결</span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
