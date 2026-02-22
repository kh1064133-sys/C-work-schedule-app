'use client';

import { useMemo, useState, useRef, useCallback, TouchEvent } from 'react';
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDateStore } from '@/stores/dateStore';
import { useUIStore } from '@/stores/uiStore';
import { useSchedulesByMonth, useUpsertSchedule } from '@/hooks/useSchedules';
import { formatMonthKorean, getHolidayName, getLunarInfo } from '@/lib/utils/date';
import { cn } from '@/lib/utils';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  isBefore,
  startOfDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Schedule, ScheduleType, PaymentMethod } from '@/types';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

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

// 미결/예약 테이블 렌더 헬퍼
function PendingTable({
  items,
  onMarkDone,
}: {
  items: Schedule[];
  onMarkDone: (s: Schedule) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1 px-1">날짜</th>
            <th className="py-1 px-1">시간</th>
            <th className="py-1 px-1">거래처</th>
            <th className="py-1 px-1">동호수</th>
            <th className="py-1 px-1">유형</th>
            <th className="py-1 px-1 text-right">금액</th>
            <th className="py-1 px-1 text-center">완료</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-b last:border-b-0 hover:bg-gray-50">
              <td className="py-1 px-1 whitespace-nowrap">{s.date.slice(5)}</td>
              <td className="py-1 px-1">{s.time_slot}</td>
              <td className="py-1 px-1 font-medium truncate max-w-[100px]">{s.title || '-'}</td>
              <td className="py-1 px-1">{s.unit || '-'}</td>
              <td className="py-1 px-1">{s.schedule_type ? SCHEDULE_TYPE_LABELS[s.schedule_type] : '-'}</td>
              <td className="py-1 px-1 text-right whitespace-nowrap">₩{(s.amount || 0).toLocaleString()}</td>
              <td className="py-1 px-1 text-center">
                <button
                  onClick={() => onMarkDone(s)}
                  className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                  title="완료 처리"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CalendarPage() {
  // 스와이프 처리 후 상태 초기화 함수
  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const diffX = touchStartX.current - touchEndX.current;
      const diffY = (touchStartY.current || 0) - (touchEndY.current || 0);
      const threshold = 50;
      if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
          moveMonth(1);
        } else {
          moveMonth(-1);
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchEndY.current = null;
  };

  useEffect(() => {
    const handler = () => {};
    document.addEventListener('touchmove', handler as any, { passive: false });
    return () => {
      document.removeEventListener('touchmove', handler as any);
    };
  }, []);

  const { setActiveTab } = useUIStore();
  const { selectedDate, calendarDate, setSelectedDate, moveMonth } = useDateStore();
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const today = startOfDay(new Date());

  // 섹션 접기/펼치기 상태
  const [showPrevPending, setShowPrevPending] = useState(true);
  const [showReserved, setShowReserved] = useState(true);

  // 스와이프 처리
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = null;
    touchEndY.current = null;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  // 해당 월의 스케줄 데이터
  const { data: schedules = [], isLoading } = useSchedulesByMonth(year, month);

  // 완료 처리 mutation
  const upsertSchedule = useUpsertSchedule();

  // 달력 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(calendarDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarDate]);

  // 날짜별 스케줄 매핑
  const schedulesByDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    schedules.forEach((schedule: Schedule) => {
      const dateKey = schedule.date;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(schedule);
    });
    return map;
  }, [schedules]);

  // 날짜별 매출 계산
  const getSalesForDate = (date: Date): number => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const daySchedules = schedulesByDate[dateKey] || [];
    return daySchedules
      .filter((s: Schedule) => s.is_done)
      .reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0);
  };

  // 날짜별 일정 수 (제목이 있는 일정만 카운트)
  const getScheduleCountForDate = (date: Date): number => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return (schedulesByDate[dateKey] || []).filter((s: Schedule) => s.title && s.title.trim() !== '').length;
  };

  // 날짜별 미결/예약 정보 (오늘 기준으로 구분)
  const getPendingForDate = useCallback((date: Date): {
    overdue: { count: number; amount: number };
    reserved: { count: number; amount: number };
  } => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const daySchedules = schedulesByDate[dateKey] || [];
    const pending = daySchedules.filter((s: Schedule) => s.title && !s.is_done);
    const scheduleDate = startOfDay(date);
    const isOverdue = isBefore(scheduleDate, today);
    const count = pending.length;
    const amount = pending.reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0);
    return {
      overdue: isOverdue ? { count, amount } : { count: 0, amount: 0 },
      reserved: !isOverdue ? { count, amount } : { count: 0, amount: 0 },
    };
  }, [schedulesByDate, today]);

  // 더블탭 감지를 위한 ref
  const lastTapRef = useRef<{ time: number; dateKey: string }>({ time: 0, dateKey: '' });

  // 날짜 클릭/탭 핸들러 (모바일 더블탭 지원)
  const handleDateTap = useCallback((date: Date) => {
    const now = Date.now();
    const dateKey = format(date, 'yyyy-MM-dd');
    const lastTap = lastTapRef.current;
    if (now - lastTap.time < 300 && lastTap.dateKey === dateKey) {
      setSelectedDate(date);
      setActiveTab('schedule');
      lastTapRef.current = { time: 0, dateKey: '' };
    } else {
      setSelectedDate(date);
      lastTapRef.current = { time: now, dateKey };
    }
  }, [setSelectedDate, setActiveTab]);

  // 날짜 더블클릭 - 일별 스케줄 탭으로 이동 (데스크탑용)
  const handleDateDoubleClick = (date: Date) => {
    setSelectedDate(date);
    setActiveTab('schedule');
  };

  // 미결 스케줄 (제목이 있고 완료되지 않은 것)
  const pendingSchedules = useMemo(() => {
    return schedules.filter((s: Schedule) => s.title && !s.is_done);
  }, [schedules]);

  // 오늘 이전 미결 / 예약(오늘 이후) 분리
  const { prevPending, reservedSchedules } = useMemo(() => {
    const prev: Schedule[] = [];
    const reserved: Schedule[] = [];
    pendingSchedules.forEach((s: Schedule) => {
      const scheduleDate = new Date(s.date);
      if (isBefore(scheduleDate, today)) {
        prev.push(s);
      } else {
        reserved.push(s);
      }
    });
    prev.sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot));
    reserved.sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot));
    return { prevPending: prev, reservedSchedules: reserved };
  }, [pendingSchedules, today]);

  const prevPendingAmount = prevPending.reduce((sum, s) => sum + (s.amount || 0), 0);
  const reservedAmount = reservedSchedules.reduce((sum, s) => sum + (s.amount || 0), 0);

  // 완료 처리
  const handleMarkDone = async (schedule: Schedule) => {
    await upsertSchedule.mutateAsync({
      id: schedule.id,
      date: schedule.date,
      time_slot: schedule.time_slot,
      is_done: true,
    });
  };

  // 선택된 날짜의 일정 목록
  const selectedDateSchedules = useMemo(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return (schedulesByDate[dateKey] || [])
      .filter((s: Schedule) => s.title && s.title.trim() !== '')
      .sort((a, b) => a.time_slot.localeCompare(b.time_slot));
  }, [selectedDate, schedulesByDate]);

  // ===== 월 매출현황 계산 =====
  const monthlySalesStats = useMemo(() => {
    const doneSchedules = schedules.filter((s: Schedule) => s.is_done);
    const byType = {
      sale: doneSchedules.filter(s => s.schedule_type === 'sale').reduce((sum, s) => sum + (s.amount || 0), 0),
      as: doneSchedules.filter(s => s.schedule_type === 'as').reduce((sum, s) => sum + (s.amount || 0), 0),
      agency: doneSchedules.filter(s => s.schedule_type === 'agency').reduce((sum, s) => sum + (s.amount || 0), 0),
      total: doneSchedules.reduce((sum, s) => sum + (s.amount || 0), 0),
    };
    const byPayment = {
      cash: doneSchedules.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + (s.amount || 0), 0),
      card: doneSchedules.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + (s.amount || 0), 0),
      vat: doneSchedules.filter(s => s.payment_method === 'vat').reduce((sum, s) => sum + (s.amount || 0), 0),
    };
    const allPending = schedules.filter((s: Schedule) => s.title && !s.is_done);
    const pendingCount = allPending.length;
    const pendingAmount = allPending.reduce((sum, s) => sum + (s.amount || 0), 0);
    return { byType, byPayment, pendingCount, pendingAmount };
  }, [schedules]);

  // 선택 날짜 포맷
  const selectedDateFormatted = format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko });

  return (
    <div
      className="space-y-4 max-w-5xl mx-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ===== 1. 월별 달력 ===== */}
      <div>
        {/* 월별 달력 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <Button size="icon" variant="ghost" onClick={() => moveMonth(-1)}>
            <ChevronLeft />
          </Button>
          <span className="font-bold text-lg">
            {formatMonthKorean(calendarDate)}
          </span>
          <Button size="icon" variant="ghost" onClick={() => moveMonth(1)}>
            <ChevronRight />
          </Button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold mb-1">
          {DAY_NAMES.map((name, i) => (
            <div key={name} className={cn(
              i === 0 && 'text-red-400',
              i === 6 && 'text-blue-400',
              i > 0 && i < 6 && 'text-gray-500'
            )}>{name}</div>
          ))}
        </div>

        {/* 달력 날짜 렌더링 */}
        <div className="grid grid-cols-7 gap-[2px]">
          {calendarDays.map((date) => {
            const isCurrentMonth = isSameMonth(date, calendarDate);
            const isToday = isSameDay(date, today);
            const isSelected = isSameDay(date, selectedDate);
            const scheduleCount = getScheduleCountForDate(date);
            const sales = getSalesForDate(date);
            const pending = getPendingForDate(date);
            const holiday = getHolidayName(date);
            const lunar = getLunarInfo(date);
            const isSun = date.getDay() === 0;
            const isSat = date.getDay() === 6;

            return (
              <div
                key={format(date, 'yyyy-MM-dd')}
                className={cn(
                  'relative p-1 min-h-[5.5rem] border rounded cursor-pointer flex flex-col items-start gap-[1px] transition-colors',
                  !isCurrentMonth && 'bg-gray-50 opacity-40',
                  isCurrentMonth && 'bg-white',
                  isToday && 'border-blue-500 bg-blue-50/60',
                  isSelected && !isToday && 'border-indigo-400 bg-indigo-50/40',
                )}
                onClick={() => handleDateTap(date)}
                onDoubleClick={() => handleDateDoubleClick(date)}
              >
                {/* 날짜 숫자 + 공휴일/음력 */}
                <div className="flex items-center gap-1 w-full">
                  <span className={cn(
                    'text-sm font-medium leading-none',
                    isToday && 'font-bold text-blue-600',
                    !isToday && (holiday || isSun) && 'text-red-500',
                    !isToday && !holiday && isSat && 'text-blue-500',
                  )}>{date.getDate()}</span>
                  {holiday && (
                    <span className="text-[9px] text-red-400 truncate leading-none">{holiday}</span>
                  )}
                  {!holiday && lunar && (
                    <span className="text-[9px] text-gray-400 leading-none">{lunar}</span>
                  )}
                </div>
                {/* 매출 금액 (녹색) */}
                {sales > 0 && (
                  <span className="text-[10px] text-green-600 font-bold leading-tight">
                    {sales >= 10000 ? `${Math.floor(sales / 10000)}만` : `₩${sales.toLocaleString()}`}
                  </span>
                )}
                {/* 건수 (회색) */}
                {scheduleCount > 0 && (
                  <span className="text-[10px] text-gray-400 leading-tight">{scheduleCount}건</span>
                )}
                {/* 미결 빨간 박스 */}
                {pending.overdue.count > 0 && (
                  <span className="text-[9px] bg-red-100 text-red-600 rounded px-0.5 leading-tight">
                    미결{pending.overdue.count}
                  </span>
                )}
                {/* 예약 파란 박스 */}
                {pending.reserved.count > 0 && (
                  <span className="text-[9px] bg-blue-100 text-blue-600 rounded px-0.5 leading-tight">
                    예약{pending.reserved.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 2. 선택 날짜 섹션 ===== */}
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          📋 {selectedDateFormatted}
        </h3>
        {selectedDateSchedules.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 일정이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {selectedDateSchedules.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-b-0 last:pb-0">
                <span className="text-gray-500 font-mono w-12 shrink-0">{s.time_slot}</span>
                <span className="font-semibold flex-1 truncate">{s.title}</span>
                {s.unit && <span className="text-gray-400 text-xs">{s.unit}</span>}
                <span className={cn(
                  'text-xs font-bold whitespace-nowrap',
                  s.is_done ? 'text-green-600' : 'text-orange-500',
                )}>
                  ₩{(s.amount || 0).toLocaleString()}
                </span>
                {s.is_done && <span className="text-green-500 text-xs">✓</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===== 3. 이전 미결 섹션 ===== */}
      {prevPending.length > 0 && (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <button
            onClick={() => setShowPrevPending(!showPrevPending)}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-100 text-red-700 font-semibold text-sm"
          >
            <span>⚠️ 이전 미결 {prevPending.length}건 / ₩{prevPendingAmount.toLocaleString()}</span>
            {showPrevPending ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showPrevPending && (
            <div className="bg-white p-3">
              <PendingTable items={prevPending} onMarkDone={handleMarkDone} />
            </div>
          )}
        </div>
      )}

      {/* ===== 4. 예약 섹션 ===== */}
      {reservedSchedules.length > 0 && (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <button
            onClick={() => setShowReserved(!showReserved)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-100 text-blue-700 font-semibold text-sm"
          >
            <span>📅 예약 {reservedSchedules.length}건 / ₩{reservedAmount.toLocaleString()}</span>
            {showReserved ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showReserved && (
            <div className="bg-white p-3">
              <PendingTable items={reservedSchedules} onMarkDone={handleMarkDone} />
            </div>
          )}
        </div>
      )}

      {/* ===== 5. 월 매출현황 섹션 ===== */}
      <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl p-4 shadow-lg">
        <h2 className="text-lg font-bold mb-3">💰 {formatMonthKorean(calendarDate)} 매출 현황</h2>

        <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm">
          <div className="space-y-2 text-sm">
            {/* 유형별 매출 */}
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-green-600 px-2 py-0.5 rounded-full text-xs font-bold">판매</span>
              <span className="font-semibold">{monthlySalesStats.byType.sale.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-orange-500 px-2 py-0.5 rounded-full text-xs font-bold">AS</span>
              <span className="font-semibold">{monthlySalesStats.byType.as.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold">대리점</span>
              <span className="font-semibold">{monthlySalesStats.byType.agency.toLocaleString()}원</span>
            </div>

            <div className="border-t border-white/20 my-2" />

            <div className="flex justify-between items-center font-bold">
              <span>합계</span>
              <span className="text-lg">{monthlySalesStats.byType.total.toLocaleString()}원</span>
            </div>

            <div className="border-t border-white/20 my-2" />

            {/* 결제방법별 */}
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">현금</span>
              <span className="text-green-200">{monthlySalesStats.byPayment.cash.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">카드</span>
              <span className="text-blue-200">{monthlySalesStats.byPayment.card.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">VAT</span>
              <span className="text-orange-200">{monthlySalesStats.byPayment.vat.toLocaleString()}원</span>
            </div>

            {/* 미결 */}
            {monthlySalesStats.pendingCount > 0 && (
              <>
                <div className="border-t border-white/20 my-2" />
                <div className="flex justify-between items-center bg-red-500/20 rounded-lg px-2 py-1">
                  <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">⚠ 미결</span>
                  <div className="flex items-center gap-2">
                    <span className="text-red-200 font-bold">{monthlySalesStats.pendingCount}건</span>
                    <span className="text-white/50">/</span>
                    <span className="text-red-100">{monthlySalesStats.pendingAmount.toLocaleString()}원</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}