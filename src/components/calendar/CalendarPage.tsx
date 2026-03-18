'use client';

import { useMemo, useState, useRef, useCallback, TouchEvent, MouseEvent } from 'react';
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDateStore } from '@/stores/dateStore';
import { useUIStore } from '@/stores/uiStore';
import { useSchedulesByMonth, useUpsertSchedule, useAllPendingSchedules } from '@/hooks/useSchedules';
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
import type { Schedule, ScheduleType, PaymentMethod, EventIcon } from '@/types';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const EVENT_ICON_EMOJI: Record<EventIcon, string> = {
  golf: '⛳',
  birthday: '🎂',
  meeting: '🤝',
};

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
  free: '무상',
};

// 미결/예약 테이블 렌더 헬퍼
function PendingTable({
  items,
  onMarkDone,
  onRowDoubleClick,
  amountColor,
  buttonVariant = 'orange',
}: {
  items: Schedule[];
  onMarkDone: (s: Schedule) => void;
  onRowDoubleClick?: (s: Schedule) => void;
  amountColor?: string;
  buttonVariant?: 'gray' | 'orange';
}) {
  const lastTapRef = useRef<{ time: number; id: string }>({ time: 0, id: '' });

  const handleRowTap = useCallback((s: Schedule) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (now - last.time < 350 && last.id === s.id) {
      onRowDoubleClick?.(s);
      lastTapRef.current = { time: 0, id: '' };
    } else {
      lastTapRef.current = { time: now, id: s.id };
    }
  }, [onRowDoubleClick]);

  if (items.length === 0) return null;

  const clampFont = 'clamp(9px, 2vw, 13px)';

  const thStyle = (width: string, textAlign?: string): React.CSSProperties => ({
    padding: '2px 3px',
    whiteSpace: 'nowrap',
    width,
    textAlign: (textAlign as any) || 'left',
    borderBottom: '1px solid #e5e7eb',
    fontSize: clampFont,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxSizing: 'border-box',
  });

  const tdStyle = (width: string, textAlign?: string): React.CSSProperties => ({
    padding: '2px 3px',
    whiteSpace: 'nowrap',
    width,
    textAlign: (textAlign as any) || 'left',
    borderBottom: '1px solid #f3f4f6',
    fontSize: clampFont,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxSizing: 'border-box',
  });

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={thStyle('10%')}>날짜</th>
            <th style={thStyle('10%')}>시간</th>
            <th style={thStyle('25%')}>거래처</th>
            <th style={thStyle('13%')}>동호수</th>
            <th style={thStyle('10%')}>유형</th>
            <th style={thStyle('18%', 'right')}>금액</th>
            <th style={thStyle('7%', 'center')}>완료</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr
              key={s.id}
              onClick={() => handleRowTap(s)}
              onDoubleClick={() => onRowDoubleClick?.(s)}
              style={{ cursor: 'pointer' }}
              title="더블탭하면 해당일 스케줄로 이동"
            >
              <td style={tdStyle('10%')}>{s.date.slice(5)}</td>
              <td style={tdStyle('10%')}>{s.time_slot}</td>
              <td style={{ ...tdStyle('25%'), fontWeight: 500 }}>{s.title || '-'}</td>
              <td style={tdStyle('13%')}>{s.unit || '-'}</td>
              <td style={tdStyle('10%')}>{s.schedule_type ? SCHEDULE_TYPE_LABELS[s.schedule_type] : '-'}</td>
              <td style={{ ...tdStyle('18%', 'right'), color: amountColor || undefined }}>{(s.amount || 0).toLocaleString()}</td>
              <td style={tdStyle('7%', 'center')}>
                {s.is_done ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: buttonVariant === 'gray' ? '#9CA3AF' : '#F97316',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}>✓</span>
                ) : (
                  <button
                    onClick={() => onMarkDone(s)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: buttonVariant === 'gray' ? '1px solid #D1D5DB' : '1px solid #FDBA74',
                      background: buttonVariant === 'gray' ? 'transparent' : '#FFF7ED',
                      color: buttonVariant === 'gray' ? '#6B7280' : '#FB923C',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    title="완료 처리"
                  >✓</button>
                )}
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

  const { setActiveTab, showSelectedDate, showPrevPending, showReserved, showMonthlySales, toggleSection } = useUIStore();
  const { selectedDate, calendarDate, setSelectedDate, moveMonth } = useDateStore();
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const today = startOfDay(new Date());

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

  // 오늘 이전 모든 미결 데이터 (전체 기간)
  const todayStr = format(today, 'yyyy-MM-dd');
  const { data: allPrevPending = [] } = useAllPendingSchedules(todayStr);

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

  // 날짜별 이벤트 아이콘 목록
  const getEventIconsForDate = useCallback((date: Date): EventIcon[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const daySchedules = schedulesByDate[dateKey] || [];
    const icons = new Set<EventIcon>();
    daySchedules.forEach((s: Schedule) => {
      if (s.event_icon) icons.add(s.event_icon);
    });
    return Array.from(icons);
  }, [schedulesByDate]);

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

  // 미결 스케줄 (제목이 있고 완료되지 않은 것) - 현재 월 데이터 기준 (예약 분리용)
  const pendingSchedules = useMemo(() => {
    return schedules.filter((s: Schedule) => s.title && !s.is_done);
  }, [schedules]);

  // 이전 미결: 전체 기간 데이터 사용 / 예약: 현재 월 데이터에서 분리
  const { prevPending, reservedSchedules } = useMemo(() => {
    // 예약: 현재 월 데이터에서 오늘 이후 미완료
    const reserved: Schedule[] = [];
    pendingSchedules.forEach((s: Schedule) => {
      const scheduleDate = new Date(s.date);
      if (!isBefore(scheduleDate, today)) {
        reserved.push(s);
      }
    });
    reserved.sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot));
    // 이전 미결: 전체 기간 데이터 (이미 정렬됨)
    return { prevPending: allPrevPending, reservedSchedules: reserved };
  }, [pendingSchedules, allPrevPending, today]);

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
      free: doneSchedules.filter(s => s.payment_method === 'free').reduce((sum, s) => sum + (s.amount || 0), 0),
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
                style={{
                  position: 'relative',
                  padding: 3,
                  minHeight: '5.5rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 0,
                  transition: 'background-color 0.15s, border-color 0.15s',
                  backgroundColor: !isCurrentMonth ? '#f9fafb' : isToday ? '#FFFEF5' : (isSelected ? 'rgba(224,231,255,0.4)' : '#fff'),
                  opacity: !isCurrentMonth ? 0.4 : 1,
                  borderColor: isToday ? '#ef4444' : (isSelected && !isToday ? '#818cf8' : '#e5e7eb'),
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
                onClick={() => handleDateTap(date)}
                onDoubleClick={() => handleDateDoubleClick(date)}
              >
                {/* 날짜 숫자 + 공휴일/음력 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 500,
                    lineHeight: 1,
                    color: isToday ? '#dc2626' : (holiday || isSun) ? '#ef4444' : isSat ? '#3b82f6' : undefined,
                  }}>{date.getDate()}</span>
                  {holiday && (
                    <span style={{ fontSize: 8, color: '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1 }}>{holiday}</span>
                  )}
                  {!holiday && lunar && (
                    <span style={{ fontSize: 8, color: '#9ca3af', lineHeight: 1 }}>{lunar}</span>
                  )}
                </div>
                {/* 매출 금액 (녹색) */}
                {sales > 0 && (
                  <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, lineHeight: 1.2, flexShrink: 0 }}>
                    {sales >= 10000 ? `${Math.floor(sales / 10000)}만` : sales.toLocaleString()}
                  </span>
                )}
                {/* 건수 (회색) */}
                {scheduleCount > 0 && (
                  <span style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.2, flexShrink: 0 }}>{scheduleCount}건</span>
                )}
                {/* 이벤트 아이콘 */}
                {(() => {
                  const eventIcons = getEventIconsForDate(date);
                  return eventIcons.length > 0 ? (
                    <div style={{ display: 'flex', gap: 1, flexShrink: 0, lineHeight: 1 }}>
                      {eventIcons.map(icon => (
                        <span key={icon} style={{ fontSize: 11 }}>{EVENT_ICON_EMOJI[icon]}</span>
                      ))}
                    </div>
                  ) : null;
                })()}
                {/* 뱃지 영역 - 남은 공간 꽉 채움 */}
                {(pending.overdue.count > 0 || pending.reserved.count > 0) && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    width: '100%',
                    marginTop: 2,
                    minHeight: 0,
                  }}>
                    {/* 미결 빨간 박스 */}
                    {pending.overdue.count > 0 && (
                      <div style={{
                        flex: 1,
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#FEE2E2',
                        border: '1px solid #FCA5A5',
                        borderRadius: 3,
                        padding: '2px 0',
                        lineHeight: 1.3,
                        boxSizing: 'border-box',
                        minHeight: 26,
                      }}>
                        <span style={{ fontSize: 'clamp(8px, 1.8vw, 11px)', color: '#DC2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          미결 {pending.overdue.count}
                        </span>
                        <span style={{ fontSize: 'clamp(8px, 1.8vw, 11px)', color: '#DC2626', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {pending.overdue.amount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {/* 예약 파란 박스 */}
                    {pending.reserved.count > 0 && (
                      <div style={{
                        flex: 1,
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#DBEAFE',
                        border: '1px solid #93C5FD',
                        borderRadius: 3,
                        padding: '2px 0',
                        lineHeight: 1.3,
                        boxSizing: 'border-box',
                        minHeight: 26,
                      }}>
                        <span style={{ fontSize: 'clamp(8px, 1.8vw, 11px)', color: '#2563EB', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          예약 {pending.reserved.count}
                        </span>
                        <span style={{ fontSize: 'clamp(8px, 1.8vw, 11px)', color: '#2563EB', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {pending.reserved.amount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 2. 선택 날짜 섹션 ===== */}
      <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
        <button
          onClick={() => toggleSection('showSelectedDate')}
          className="w-full flex items-center justify-between px-4 py-3 font-bold text-base"
          style={{ background: '#f8fafc' }}
        >
          <span className="flex items-center gap-2">
            📋 {selectedDateFormatted}
            {selectedDateSchedules.length > 0 && (
              <span style={{ backgroundColor: '#6366f1', color: '#fff', borderRadius: 9999, padding: '1px 8px', fontSize: 12, fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap' }}>{selectedDateSchedules.length}건</span>
            )}
          </span>
          {showSelectedDate ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </button>
        {showSelectedDate && (selectedDateSchedules.length === 0 ? (
          <div className="px-4 pb-3">
            <p style={{ fontSize: 'clamp(9px, 2vw, 13px)', color: '#9ca3af' }}>등록된 일정이 없습니다.</p>
          </div>
        ) : (
          <div className="p-1 md:p-3" style={{ width: '100%', overflowX: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '12%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>시간</th>
                  <th style={{ width: '28%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>거래처</th>
                  <th style={{ width: '15%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>동호수</th>
                  <th style={{ width: '20%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>금액</th>
                  <th style={{ width: '25%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {selectedDateSchedules.map((s) => (
                  <tr key={s.id}>
                    <td style={{ width: '12%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', textAlign: 'left', borderBottom: '1px solid #f3f4f6' }}>{s.time_slot}</td>
                    <td style={{ width: '28%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', fontWeight: 500, textAlign: 'left', borderBottom: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title || '-'}</td>
                    <td style={{ width: '15%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', textAlign: 'left', borderBottom: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', color: '#9ca3af' }}>{s.unit || '-'}</td>
                    <td style={{ width: '20%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: s.is_done ? '#16a34a' : '#f97316' }}>{(s.amount || 0).toLocaleString()}</td>
                    <td style={{ width: '25%', padding: '2px 3px', whiteSpace: 'nowrap', fontSize: 'clamp(9px, 2vw, 13px)', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                      {s.is_done ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', border: '2px solid #16a34a', backgroundColor: 'transparent', color: '#16a34a', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>
                      ) : isBefore(startOfDay(new Date(s.date)), today) ? (
                        <span style={{ backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #EF4444', padding: '1px 6px', borderRadius: 9999, fontSize: 'clamp(8px, 1.8vw, 11px)', fontWeight: 700, whiteSpace: 'nowrap' }}>⚠ 미결</span>
                      ) : (
                        <span style={{ backgroundColor: '#DBEAFE', color: '#2563EB', border: '1px solid #3B82F6', padding: '1px 6px', borderRadius: 9999, fontSize: 'clamp(8px, 1.8vw, 11px)', fontWeight: 700, whiteSpace: 'nowrap' }}>📅 예약</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* ===== 3. 이전 미결 섹션 ===== */}
      {prevPending.length > 0 && (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <button
            onClick={() => toggleSection('showPrevPending')}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-100 text-red-700 font-semibold text-sm"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>⚠️ 이전 미결 <span style={{ backgroundColor: '#DC2626', color: '#fff', borderRadius: 9999, padding: '1px 8px', fontSize: 12, fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap' }}>{prevPending.length}건</span> / {prevPendingAmount.toLocaleString()}</span>
            {showPrevPending ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showPrevPending && (
            <div className="bg-white p-1 md:p-3">
              <PendingTable items={prevPending} onMarkDone={handleMarkDone} amountColor="#DC2626" onRowDoubleClick={(s) => { setSelectedDate(new Date(s.date + 'T00:00:00')); setActiveTab('schedule'); }} />
            </div>
          )}
        </div>
      )}

      {/* ===== 4. 예약 섹션 ===== */}
      {reservedSchedules.length > 0 && (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <button
            onClick={() => toggleSection('showReserved')}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-100 text-blue-700 font-semibold text-sm"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>📅 예약 <span style={{ backgroundColor: '#2563EB', color: '#fff', borderRadius: 9999, padding: '1px 8px', fontSize: 12, fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap' }}>{reservedSchedules.length}건</span> / {reservedAmount.toLocaleString()}</span>
            {showReserved ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showReserved && (
            <div className="bg-white p-1 md:p-3">
              <PendingTable items={reservedSchedules} onMarkDone={handleMarkDone} buttonVariant="gray" onRowDoubleClick={(s) => { setSelectedDate(new Date(s.date + 'T00:00:00')); setActiveTab('schedule'); }} />
            </div>
          )}
        </div>
      )}

      {/* ===== 5. 월 매출현황 섹션 ===== */}
      <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl overflow-hidden shadow-lg">
        <button
          onClick={() => toggleSection('showMonthlySales')}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <h2 className="text-lg font-bold">💰 {formatMonthKorean(calendarDate)} 매출 현황</h2>
          {showMonthlySales ? <ChevronUp className="h-5 w-5 text-white/80" /> : <ChevronDown className="h-5 w-5 text-white/80" />}
        </button>

        {showMonthlySales && (
        <div className="bg-white/15 rounded-xl mx-1 md:mx-4 mb-4 p-2 md:p-4 backdrop-blur-sm">
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
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-purple-600 px-2 py-0.5 rounded-full text-xs font-bold">무상</span>
              <span className="text-purple-200">{monthlySalesStats.byPayment.free.toLocaleString()}원</span>
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
        )}
      </div>
    </div>
  );
}