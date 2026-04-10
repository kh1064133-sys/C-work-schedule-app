'use client';

import { useState, useMemo } from 'react';
import { Search, RotateCcw, FileSpreadsheet, MessageSquare, X, Copy, Check } from 'lucide-react';
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

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

function getDayOfWeek(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
}

// --- SMS 팝업 (외주설치와 동일 방식) ---
function SmsPopup({ schedules, onClose }: { schedules: Schedule[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => {
    const lines = schedules.map(s => {
      const date = formatDateShort(s.date);
      const day = getDayOfWeek(s.date);
      const title = s.title || '';
      const unit = s.unit || '';
      const parts = [`${date}(${day})`, title, unit].filter(Boolean);
      return parts.join(' / ');
    });
    return lines.join('\n');
  }, [schedules]);

  const handleSend = () => {
    const body = encodeURIComponent(message);
    window.location.href = `sms:?body=${body}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            문자 발송 ({schedules.length}건)
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-xs text-gray-500 mb-2">메시지 내용 (날짜 / 거래처 / 동호수)</div>
          <div className="bg-gray-50 border rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed font-mono">
            {message}
          </div>
        </div>
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? '복사됨' : '복사'}
          </Button>
          <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleSend}>
            <MessageSquare className="h-4 w-4" />
            문자 보내기
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SearchPage() {
  const { setSelectedDate } = useDateStore();
  const { setActiveTab } = useUIStore();
  
  // 검색 조건
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(() => format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [scheduleType, setScheduleType] = useState('');
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  
  // 체크박스 선택
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // SMS 팝업
  const [showSmsPopup, setShowSmsPopup] = useState(false);
  
  // 실제 검색에 사용할 파라미터 (검색 버튼 클릭 시 업데이트)
  const [searchParams, setSearchParams] = useState<{
    query?: string;
    fromDate?: string;
    toDate?: string;
    type?: string;
    unpaidOnly?: boolean;
  }>({});

  // 검색 실행
  const { data: results = [], isLoading, isFetching } = useSearchSchedules(searchParams);

  // 검색 실행
  const handleSearch = () => {
    setCheckedIds(new Set());
    setSearchParams({
      query: searchQuery || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      type: scheduleType || undefined,
      unpaidOnly: unpaidOnly || undefined,
    });
  };

  // 초기화
  const handleReset = () => {
    setSearchQuery('');
    setFromDate(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
    setToDate(format(new Date(), 'yyyy-MM-dd'));
    setScheduleType('');
    setUnpaidOnly(false);
    setCheckedIds(new Set());
    setSearchParams({});
  };

  // 엔터키 검색
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 체크박스 토글
  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === results.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(results.map((s: Schedule) => s.id)));
    }
  };

  // 선택된 스케줄 목록
  const selectedSchedules = useMemo(() =>
    results.filter((s: Schedule) => checkedIds.has(s.id)),
    [results, checkedIds]
  );

  // 통계 계산
  const stats = useMemo(() => {
    const totalAmount = results
      .filter((s: Schedule) => s.is_done)
      .reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0);
    const doneCount = results.filter((s: Schedule) => s.is_done).length;
    const pendingCount = results.filter((s: Schedule) => !s.is_done && s.title).length;
    const unpaidCount = results.filter((s: Schedule) => s.is_done && !s.is_paid).length;
    
    return { totalAmount, doneCount, pendingCount, unpaidCount, totalCount: results.length };
  }, [results]);

  // 엑셀 다운로드
  const handleExcelExport = () => {
    if (results.length === 0) return;

    const headers = ['날짜', '시간', '거래처명', '동호수', '내용', '유형', '금액', '결제방법', '입금', '완료', '예약'];
    const rows = results.map((s: Schedule) => ({
      '날짜': s.date,
      '시간': s.time_slot,
      '거래처명': s.title || '',
      '동호수': s.unit || '',
      '내용': s.memo || '',
      '유형': s.schedule_type ? SCHEDULE_TYPE_LABELS[s.schedule_type] : '',
      '금액': s.amount || 0,
      '결제방법': s.payment_method ? PAYMENT_METHOD_LABELS[s.payment_method] : '',
      '입금': s.is_paid ? 'O' : '',
      '완료': s.is_done ? 'O' : '',
      '예약': s.is_reserved ? 'O' : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '검색결과');
    worksheet['!cols'] = headers.map(() => ({ wch: 15 }));
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

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#4b5563', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={unpaidOnly}
            onChange={(e) => setUnpaidOnly(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#ef4444' }}
          />
          <span style={{ fontWeight: unpaidOnly ? 700 : 400, color: unpaidOnly ? '#dc2626' : '#4b5563' }}>미입금</span>
        </label>

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
                미입금: <span className="font-bold text-orange-500">{stats.unpaidCount}건</span>
              </span>
              <span className="text-gray-600 whitespace-nowrap">
                매출합계: <span className="font-bold text-emerald-600">{stats.totalAmount.toLocaleString()}원</span>
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {checkedIds.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowSmsPopup(true)} className="gap-1 text-blue-700 border-blue-600 hover:bg-blue-50">
              <MessageSquare className="h-4 w-4" />
              문자발송 ({checkedIds.size})
            </Button>
          )}
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcelExport} className="gap-1 text-green-700 border-green-600 hover:bg-green-50">
              <FileSpreadsheet className="h-4 w-4" />
              엑셀
            </Button>
          )}
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div style={{ overflowX: 'auto', maxHeight: '60vh', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 650, borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'clamp(9px, 2vw, 13px)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ width: '4%', minWidth: 28, padding: '4px 2px', textAlign: 'center' }}>
                  <input type="checkbox" checked={results.length > 0 && checkedIds.size === results.length} onChange={toggleAll} style={{ width: 15, height: 15 }} />
                </th>
                <th style={{ width: '10%', minWidth: 50, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>날짜</th>
                <th style={{ width: '8%', minWidth: 38, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>시간</th>
                <th style={{ width: '18%', minWidth: 65, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>거래처명</th>
                <th style={{ width: '10%', minWidth: 45, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>동호수</th>
                <th style={{ width: '13%', minWidth: 50, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>내용</th>
                <th style={{ width: '7%', minWidth: 32, padding: '4px 3px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>유형</th>
                <th style={{ width: '11%', minWidth: 50, padding: '4px 3px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>금액</th>
                <th style={{ width: '6%', minWidth: 28, padding: '4px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>결제</th>
                <th style={{ width: '6%', minWidth: 28, padding: '4px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>입금</th>
                <th style={{ width: '6%', minWidth: 28, padding: '4px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'clamp(9px, 2vw, 13px)' }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || isFetching ? (
                <tr>
                  <td colSpan={11} style={{ padding: '48px 16px', textAlign: 'center', color: '#6b7280' }}>
                    검색 중...
                  </td>
                </tr>
              ) : Object.keys(searchParams).length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '48px 16px', textAlign: 'center', color: '#6b7280' }}>
                    검색어를 입력하거나 필터를 설정한 후 검색 버튼을 클릭하세요.
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '48px 16px', textAlign: 'center', color: '#6b7280' }}>
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
                      backgroundColor: checkedIds.has(schedule.id) ? 'rgba(219,234,254,0.5)' : schedule.is_done ? 'rgba(240,253,244,0.5)' : undefined,
                    }}
                    onClick={() => handleDateClick(schedule.date)}
                  >
                    <td style={{ padding: '4px 2px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checkedIds.has(schedule.id)} onChange={() => toggleCheck(schedule.id)} style={{ width: 15, height: 15 }} />
                    </td>
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
                        schedule.is_paid ? (
                          <span style={{ padding: '1px 4px', borderRadius: 4, backgroundColor: '#dcfce7', color: '#15803d', fontSize: 'clamp(8px, 1.8vw, 12px)', fontWeight: 700 }}>완료</span>
                        ) : (
                          <span style={{ padding: '1px 4px', borderRadius: 4, backgroundColor: '#fef3c7', color: '#d97706', fontSize: 'clamp(8px, 1.8vw, 12px)', fontWeight: 700 }}>미입금</span>
                        )
                      ) : null}
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

      {/* SMS 팝업 */}
      {showSmsPopup && selectedSchedules.length > 0 && (
        <SmsPopup schedules={selectedSchedules} onClose={() => setShowSmsPopup(false)} />
      )}
    </div>
  );
}
