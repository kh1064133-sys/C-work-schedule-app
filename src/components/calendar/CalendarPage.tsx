'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDateStore } from '@/stores/dateStore';
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

export function CalendarPage() {
  const { selectedDate, calendarDate, setSelectedDate, moveMonth } = useDateStore();
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  // 미결 섹션 상태
  const [showPrevPending, setShowPrevPending] = useState(true);
  const [showCurrentPending, setShowCurrentPending] = useState(true);

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

  // 날짜별 일정 수
  const getScheduleCountForDate = (date: Date): number => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return (schedulesByDate[dateKey] || []).length;
  };

  // 날짜 클릭
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  // 미결 스케줄 (제목이 있고 완료되지 않은 것)
  const pendingSchedules = useMemo(() => {
    return schedules.filter((s: Schedule) => s.title && !s.is_done);
  }, [schedules]);

  // 오늘 이전 미결 / 이번달 미결 분리
  const today = startOfDay(new Date());
  const { prevPending, currentPending } = useMemo(() => {
    const prev: Schedule[] = [];
    const current: Schedule[] = [];
    
    pendingSchedules.forEach((s: Schedule) => {
      const scheduleDate = new Date(s.date);
      if (isBefore(scheduleDate, today)) {
        prev.push(s);
      } else {
        current.push(s);
      }
    });
    
    // 날짜순 정렬
    prev.sort((a, b) => a.date.localeCompare(b.date));
    current.sort((a, b) => a.date.localeCompare(b.date));
    
    return { prevPending: prev, currentPending: current };
  }, [pendingSchedules, today]);

  // 미결 금액 계산
  const prevPendingAmount = prevPending.reduce((sum, s) => sum + (s.amount || 0), 0);
  const currentPendingAmount = currentPending.reduce((sum, s) => sum + (s.amount || 0), 0);

  // 완료 처리
  const handleMarkDone = async (schedule: Schedule) => {
    await upsertSchedule.mutateAsync({
      id: schedule.id,
      date: schedule.date,
      time_slot: schedule.time_slot,
      is_done: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          📆 월별 달력
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => moveMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[140px] text-center">
            {formatMonthKorean(calendarDate)}
          </span>
          <Button variant="outline" size="icon" onClick={() => moveMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 달력 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DAY_NAMES.map((day, i) => (
            <div
              key={day}
              className={cn(
                'py-3 text-center text-sm font-semibold',
                i === 0 && 'text-red-500',
                i === 6 && 'text-blue-500'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, index) => {
            const isCurrentMonth = isSameMonth(date, calendarDate);
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const holidayName = getHolidayName(date);
            const lunarInfo = getLunarInfo(date);
            const isSunday = date.getDay() === 0;
            const isSaturday = date.getDay() === 6;
            const sales = getSalesForDate(date);
            const scheduleCount = getScheduleCountForDate(date);

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[100px] border-b border-r p-1.5 cursor-pointer transition-colors',
                  !isCurrentMonth && 'bg-gray-50',
                  isSelected && 'bg-blue-50 ring-2 ring-inset ring-blue-400',
                  !isSelected && 'hover:bg-gray-100'
                )}
                onClick={() => handleDateClick(date)}
              >
                <div className="flex flex-col h-full">
                  {/* 날짜 숫자 */}
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        'text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                        !isCurrentMonth && 'text-gray-300',
                        isCurrentMonth && isSunday && 'text-red-500',
                        isCurrentMonth && isSaturday && 'text-blue-500',
                        isCurrentMonth && holidayName && 'text-red-500',
                        isToday && 'bg-primary text-white'
                      )}
                    >
                      {format(date, 'd')}
                    </span>
                    {lunarInfo && isCurrentMonth && (
                      <span className="text-[10px] text-gray-400">{lunarInfo}</span>
                    )}
                  </div>

                  {/* 공휴일 이름 */}
                  {holidayName && isCurrentMonth && (
                    <div className="text-[10px] text-red-500 truncate">{holidayName}</div>
                  )}

                  {/* 매출 및 일정 수 */}
                  {isCurrentMonth && (
                    <div className="mt-auto space-y-0.5">
                      {scheduleCount > 0 && (
                        <div className="text-[10px] text-gray-500">
                          일정 {scheduleCount}건
                        </div>
                      )}
                      {sales > 0 && (
                        <div className="text-xs font-medium text-green-600">
                          {sales.toLocaleString()}원
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 정보 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-800 mb-2">
          {format(selectedDate, 'yyyy년 M월 d일')} ({DAY_NAMES[selectedDate.getDay()]})
          {getHolidayName(selectedDate) && (
            <span className="ml-2 text-red-500 text-sm">
              - {getHolidayName(selectedDate)}
            </span>
          )}
        </h3>
        <div className="text-sm text-gray-600">
          {(() => {
            const dateKey = format(selectedDate, 'yyyy-MM-dd');
            const daySchedules = schedulesByDate[dateKey] || [];
            if (daySchedules.length === 0) {
              return <p>등록된 일정이 없습니다.</p>;
            }
            return (
              <div className="space-y-1">
                {daySchedules.map((schedule: Schedule) => (
                  <div
                    key={schedule.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded',
                      schedule.is_done ? 'bg-green-50' : 'bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{schedule.time_slot}</span>
                      <span className="font-medium">{schedule.title || '(제목 없음)'}</span>
                      {schedule.is_done && <span className="text-green-600">✓</span>}
                    </div>
                    {schedule.amount > 0 && (
                      <span className="text-green-600 font-medium">
                        {schedule.amount.toLocaleString()}원
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 월 매출 요약 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-800 mb-2">
          {formatMonthKorean(calendarDate)} 매출 현황
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">전체 일정</div>
            <div className="text-xl font-bold text-blue-600">{schedules.length}건</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600">완료</div>
            <div className="text-xl font-bold text-green-600">
              {schedules.filter((s: Schedule) => s.is_done).length}건
            </div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg">
            <div className="text-sm text-gray-600">월 매출</div>
            <div className="text-xl font-bold text-emerald-600">
              {schedules
                .filter((s: Schedule) => s.is_done)
                .reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0)
                .toLocaleString()}원
            </div>
          </div>
        </div>
      </div>

      {/* 미결 현황 */}
      {(prevPending.length > 0 || currentPending.length > 0) && (
        <div className="space-y-3">
          {/* 이전 미결 (오늘 이전) */}
          {prevPending.length > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 transition-colors"
                onClick={() => setShowPrevPending(!showPrevPending)}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="font-bold text-red-700">⚠️ 이전 미결</span>
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {prevPending.length}건
                  </span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-300">
                    {prevPendingAmount.toLocaleString()}원
                  </span>
                </div>
                {showPrevPending ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
              </button>
              
              {showPrevPending && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">날짜</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">시간</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">거래처</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">동호수</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">유형</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">금액</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-600">완료</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prevPending.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-red-50/50">
                          <td className="px-4 py-2 text-primary font-medium whitespace-nowrap">{s.date}</td>
                          <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{s.time_slot}</td>
                          <td className="px-4 py-2 font-medium">{s.title}</td>
                          <td className="px-4 py-2 text-gray-600">{s.unit || '-'}</td>
                          <td className="px-4 py-2">
                            {s.schedule_type && (
                              <span className={cn(
                                'px-2 py-0.5 rounded text-xs font-bold',
                                s.schedule_type === 'sale' && 'bg-green-100 text-green-700',
                                s.schedule_type === 'as' && 'bg-orange-100 text-orange-700',
                                s.schedule_type === 'agency' && 'bg-indigo-100 text-indigo-700',
                              )}>
                                {SCHEDULE_TYPE_LABELS[s.schedule_type]}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-red-600 whitespace-nowrap">
                            {s.amount ? `${s.amount.toLocaleString()}원` : '-'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all flex items-center justify-center mx-auto"
                              onClick={() => handleMarkDone(s)}
                              title="완료 처리"
                            >
                              <Check className="h-4 w-4 text-gray-400 hover:text-green-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 이번달 미결 */}
          {currentPending.length > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 transition-colors"
                onClick={() => setShowCurrentPending(!showCurrentPending)}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span className="font-bold text-orange-700">📋 이번달 미결</span>
                  <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                    {currentPending.length}건
                  </span>
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-300">
                    {currentPendingAmount.toLocaleString()}원
                  </span>
                </div>
                {showCurrentPending ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
              </button>
              
              {showCurrentPending && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">날짜</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">시간</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">거래처</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">동호수</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">유형</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">금액</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-600">완료</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPending.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-orange-50/50">
                          <td className="px-4 py-2 text-primary font-medium whitespace-nowrap">{s.date}</td>
                          <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{s.time_slot}</td>
                          <td className="px-4 py-2 font-medium">{s.title}</td>
                          <td className="px-4 py-2 text-gray-600">{s.unit || '-'}</td>
                          <td className="px-4 py-2">
                            {s.schedule_type && (
                              <span className={cn(
                                'px-2 py-0.5 rounded text-xs font-bold',
                                s.schedule_type === 'sale' && 'bg-green-100 text-green-700',
                                s.schedule_type === 'as' && 'bg-orange-100 text-orange-700',
                                s.schedule_type === 'agency' && 'bg-indigo-100 text-indigo-700',
                              )}>
                                {SCHEDULE_TYPE_LABELS[s.schedule_type]}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-orange-600 whitespace-nowrap">
                            {s.amount ? `${s.amount.toLocaleString()}원` : '-'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all flex items-center justify-center mx-auto"
                              onClick={() => handleMarkDone(s)}
                              title="완료 처리"
                            >
                              <Check className="h-4 w-4 text-gray-400 hover:text-green-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
