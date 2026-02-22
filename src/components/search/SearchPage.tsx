'use client';

import { useState, useMemo } from 'react';
import { Search, RotateCcw, FileSpreadsheet, Calendar, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchSchedules } from '@/hooks/useSchedules';
import { useDateStore } from '@/stores/dateStore';
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
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '현금',
  card: '카드',
  vat: 'VAT',
};

export function SearchPage() {
  const { setSelectedDate } = useDateStore();
  
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

  // 날짜 클릭 시 해당 날짜로 이동
  const handleDateClick = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    setSelectedDate(new Date(year, month - 1, day));
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
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">기간:</span>
          <input
            type="date"
            className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">유형:</span>
          <select
            className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value)}
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
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          {Object.keys(searchParams).length > 0 && (
            <>
              <span className="text-gray-600">
                검색결과: <span className="font-bold text-primary">{stats.totalCount}건</span>
              </span>
              <span className="text-gray-600">
                완료: <span className="font-bold text-green-600">{stats.doneCount}건</span>
              </span>
              <span className="text-gray-600">
                미결: <span className="font-bold text-red-500">{stats.pendingCount}건</span>
              </span>
              <span className="text-gray-600">
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
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0 z-10">
              <tr className="text-sm font-semibold text-gray-700">
                <th className="px-4 py-3 text-left whitespace-nowrap">날짜</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">시간</th>
                <th className="px-4 py-3 text-left">거래처명</th>
                <th className="px-4 py-3 text-left">동호수</th>
                <th className="px-4 py-3 text-left">내용</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">유형</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">금액</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">결제</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || isFetching ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    검색 중...
                  </td>
                </tr>
              ) : Object.keys(searchParams).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    검색어를 입력하거나 필터를 설정한 후 검색 버튼을 클릭하세요.
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                results.map((schedule: Schedule) => (
                  <tr
                    key={schedule.id}
                    className={cn(
                      'border-b hover:bg-gray-50 cursor-pointer transition-colors',
                      schedule.is_done && 'bg-green-50/50'
                    )}
                    onClick={() => handleDateClick(schedule.date)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-primary font-medium">{schedule.date}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {schedule.time_slot}
                    </td>
                    <td className="px-4 py-3 font-medium">{schedule.title || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{schedule.unit || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{schedule.memo || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {schedule.schedule_type && (
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-bold',
                          schedule.schedule_type === 'sale' && 'bg-green-100 text-green-700',
                          schedule.schedule_type === 'as' && 'bg-orange-100 text-orange-700',
                          schedule.schedule_type === 'agency' && 'bg-indigo-100 text-indigo-700',
                          schedule.schedule_type === 'group' && 'bg-pink-100 text-pink-700',
                        )}>
                          {SCHEDULE_TYPE_LABELS[schedule.schedule_type]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-emerald-600">
                      {schedule.amount ? `${schedule.amount.toLocaleString()}원` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {schedule.payment_method && (
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-bold',
                          schedule.payment_method === 'cash' && 'bg-green-100 text-green-700',
                          schedule.payment_method === 'card' && 'bg-blue-100 text-blue-700',
                          schedule.payment_method === 'vat' && 'bg-orange-100 text-orange-700',
                        )}>
                          {PAYMENT_METHOD_LABELS[schedule.payment_method]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {schedule.is_done ? (
                        <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-bold">완료</span>
                      ) : schedule.title ? (
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-600 text-xs font-bold">미결</span>
                      ) : null}
                      {schedule.is_reserved && (
                        <span className="ml-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-bold">예약</span>
                      )}
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
