'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimeSlotRow } from './TimeSlotRow';
import { useDateStore } from '@/stores/dateStore';
import { useSchedulesByDate, useUpsertSchedule, useDeleteSchedule, useSwapSchedules } from '@/hooks/useSchedules';
import { useClients } from '@/hooks/useClients';
import { useItems } from '@/hooks/useItems';
import { formatDateKorean, formatDate, getHolidayName, isSunday, isSaturday } from '@/lib/utils/date';
import { cn } from '@/lib/utils';
import type { Schedule } from '@/types';

// 요일 가져오기
function getDayOfWeek(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
}

// 날짜 정보 가져오기
function getDayInfo(date: Date) {
  return {
    dayOfWeek: getDayOfWeek(date),
    isHoliday: isHoliday(date) || isSunday(date),
    holidayName: getHolidayName(date),
  };
}

// 공휴일 여부 확인
function isHoliday(date: Date): boolean {
  return getHolidayName(date) !== null;
}

// 시간 슬롯 생성 (기본 시간대)
const DEFAULT_TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
];

export function SchedulePage() {
  const { selectedDate, moveDay, goToToday } = useDateStore();
  const dateStr = formatDate(selectedDate);
  
  // 데이터 조회
  const { data: schedules = [], isLoading: schedulesLoading } = useSchedulesByDate(selectedDate);
  const { data: clients = [] } = useClients();
  const { data: items = [] } = useItems();
  
  // 뮤테이션
  const upsertSchedule = useUpsertSchedule();
  const deleteSchedule = useDeleteSchedule();
  const swapSchedules = useSwapSchedules();

  // 드래그 상태
  const [dragSourceSlot, setDragSourceSlot] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // 시간 추가 상태
  const [showAddTime, setShowAddTime] = useState(false);
  const [newHour, setNewHour] = useState('09');
  const [newMinute, setNewMinute] = useState('00');

  // 날짜 정보
  const dayInfo = getDayInfo(selectedDate);

  // 스케줄을 시간 슬롯별로 매핑
  const scheduleMap = useMemo(() => {
    const map: Record<string, Schedule> = {};
    schedules.forEach((schedule: Schedule) => {
      const timeSlot = schedule.time_slot || '09:00';
      // 해당 시간대에 스케줄이 없으면 추가
      map[timeSlot] = schedule;
    });
    return map;
  }, [schedules]);

  // 사용 중인 시간 슬롯 + 기본 시간 슬롯 합치기
  const allTimeSlots = useMemo(() => {
    const scheduleSlots = schedules.map((s: Schedule) => s.time_slot || '09:00');
    const combined = new Set([...DEFAULT_TIME_SLOTS, ...scheduleSlots]);
    return Array.from(combined).sort();
  }, [schedules]);

  // 일정 생성/업데이트
  const handleUpdate = async (timeSlot: string, data: Partial<Schedule>) => {
    const existing = scheduleMap[timeSlot];
    
    if (existing) {
      // 기존 스케줄 업데이트
      await upsertSchedule.mutateAsync({
        id: existing.id,
        date: dateStr,
        time_slot: timeSlot,
        title: data.title ?? undefined,
        memo: data.memo ?? undefined,
        unit: data.unit ?? undefined,
        amount: data.amount,
        schedule_type: data.schedule_type ?? undefined,
        payment_method: data.payment_method ?? undefined,
        is_done: data.is_done,
        is_reserved: data.is_reserved,
      });
    } else if (data.title || data.memo || data.amount) {
      // 새 스케줄 생성 (내용이 있을 때만)
      await upsertSchedule.mutateAsync({
        date: dateStr,
        time_slot: timeSlot,
        title: data.title || '',
        memo: data.memo || '',
        unit: data.unit || '',
        amount: data.amount || 0,
        schedule_type: data.schedule_type ?? undefined,
        payment_method: data.payment_method ?? undefined,
        is_done: data.is_done || false,
        is_reserved: data.is_reserved || false,
        sort_order: allTimeSlots.indexOf(timeSlot),
      });
    }
  };

  // 완료 토글
  const handleToggleDone = async (timeSlot: string) => {
    const existing = scheduleMap[timeSlot];
    if (existing) {
      await upsertSchedule.mutateAsync({
        id: existing.id,
        date: dateStr,
        time_slot: timeSlot,
        is_done: !existing.is_done,
      });
    }
  };

  // 예약 토글
  const handleToggleReserved = async (timeSlot: string) => {
    const existing = scheduleMap[timeSlot];
    if (existing) {
      await upsertSchedule.mutateAsync({
        id: existing.id,
        date: dateStr,
        time_slot: timeSlot,
        is_reserved: !existing.is_reserved,
      });
    }
  };

  // 드래그 시작
  const handleDragStart = useCallback((timeSlot: string) => {
    setDragSourceSlot(timeSlot);
  }, []);

  // 드래그 오버
  const handleDragOver = useCallback((timeSlot: string) => {
    setDragOverSlot(timeSlot);
  }, []);

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setDragSourceSlot(null);
    setDragOverSlot(null);
  }, []);

  // 드롭 - 스케줄 스왑
  const handleDrop = useCallback(async (targetSlot: string) => {
    if (!dragSourceSlot || dragSourceSlot === targetSlot) {
      handleDragEnd();
      return;
    }

    const sourceSchedule = scheduleMap[dragSourceSlot];
    const targetSchedule = scheduleMap[targetSlot];

    // 둘 다 데이터가 있으면 스왑
    if (sourceSchedule && targetSchedule) {
      await swapSchedules.mutateAsync({
        schedule1: sourceSchedule,
        schedule2: targetSchedule,
        date: dateStr,
      });
    } else if (sourceSchedule && !targetSchedule) {
      // 소스만 있으면 타겟 시간대로 이동
      await upsertSchedule.mutateAsync({
        id: sourceSchedule.id,
        date: dateStr,
        time_slot: targetSlot,
      });
    }

    handleDragEnd();
  }, [dragSourceSlot, scheduleMap, dateStr, swapSchedules, upsertSchedule, handleDragEnd]);

  // 시간 추가
  const handleAddTime = useCallback(() => {
    const newTimeSlot = `${newHour.padStart(2, '0')}:${newMinute}`;
    if (!allTimeSlots.includes(newTimeSlot)) {
      // 빈 스케줄 생성으로 시간대 추가
      upsertSchedule.mutateAsync({
        date: dateStr,
        time_slot: newTimeSlot,
        title: '',
        memo: '',
        unit: '',
        amount: 0,
        is_done: false,
        is_reserved: false,
        sort_order: 999,
      });
    }
    setShowAddTime(false);
    setNewHour('09');
    setNewMinute('00');
  }, [newHour, newMinute, allTimeSlots, dateStr, upsertSchedule]);

  // 금일 매출 계산
  const todaySales = useMemo(() => {
    return schedules
      .filter((s: Schedule) => s.is_done)
      .reduce((sum: number, s: Schedule) => sum + (s.amount || 0), 0);
  }, [schedules]);

  // 미완료 건수
  const pendingCount = useMemo(() => {
    return schedules.filter((s: Schedule) => !s.is_done && s.title).length;
  }, [schedules]);

  // 예약 건수
  const reservedCount = useMemo(() => {
    return schedules.filter((s: Schedule) => s.is_reserved).length;
  }, [schedules]);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더: 날짜 네비게이션 */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => moveDay(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-3">
            <h2 className={cn(
              'text-2xl font-bold',
              dayInfo.isHoliday && 'text-red-500',
              dayInfo.dayOfWeek === '일' && 'text-red-500',
              dayInfo.dayOfWeek === '토' && 'text-blue-500'
            )}>
              {formatDateKorean(selectedDate)} ({dayInfo.dayOfWeek})
            </h2>
            {dayInfo.holidayName && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                {dayInfo.holidayName}
              </span>
            )}
          </div>

          <Button variant="outline" size="icon" onClick={() => moveDay(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" onClick={goToToday} className="ml-2">
            <RotateCcw className="h-3 w-3 mr-1" />
            오늘
          </Button>
        </div>

        {/* 요약 정보 */}
        <div className="flex items-center gap-4 text-sm">
          <div className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-medium">
            금일 매출: <span className="font-bold">{todaySales.toLocaleString()}원</span>
          </div>
          {pendingCount > 0 && (
            <div className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-medium">
              미완료: <span className="font-bold">{pendingCount}건</span>
            </div>
          )}
          {reservedCount > 0 && (
            <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium">
              예약: <span className="font-bold">{reservedCount}건</span>
            </div>
          )}
        </div>
      </div>

      {/* 테이블 헤더 */}
      <div className="bg-gray-100 border rounded-t-lg">
        <div className="grid grid-cols-[28px_80px_1fr_100px_1fr_100px_120px_100px_60px_70px] gap-2 px-3 py-2 text-sm font-semibold text-gray-700">
          <div></div>
          <div>시간</div>
          <div>거래처명</div>
          <div>동호수</div>
          <div>내용</div>
          <div>유형</div>
          <div className="text-right">금액</div>
          <div>결제방법</div>
          <div className="text-center">예약</div>
          <div className="text-center">완료</div>
        </div>
      </div>

      {/* 스케줄 목록 */}
      <div className="flex-1 overflow-y-auto border border-t-0 bg-white">
        {schedulesLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-500">
            <div className="animate-spin mr-2">⏳</div>
            로딩 중...
          </div>
        ) : (
          allTimeSlots.map((timeSlot) => (
            <TimeSlotRow
              key={timeSlot}
              timeSlot={timeSlot}
              schedule={scheduleMap[timeSlot] || null}
              clients={clients}
              items={items}
              onUpdate={(data) => handleUpdate(timeSlot, data)}
              onToggleDone={() => handleToggleDone(timeSlot)}
              onToggleReserved={() => handleToggleReserved(timeSlot)}
              isDragging={dragSourceSlot === timeSlot}
              isDragOver={dragOverSlot === timeSlot}
              onDragStart={() => handleDragStart(timeSlot)}
              onDragOver={() => handleDragOver(timeSlot)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(timeSlot)}
            />
          ))
        )}
      </div>

      {/* 시간 추가 */}
      <div className="border border-t-0 rounded-b-lg bg-gray-50 p-2">
        {showAddTime ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <input
              type="number"
              min="0"
              max="23"
              className="w-14 px-2 py-1 border rounded text-center font-bold"
              value={newHour}
              onChange={(e) => setNewHour(e.target.value.slice(0, 2))}
            />
            <span className="font-bold text-primary">:</span>
            <select
              className="px-2 py-1 border rounded font-bold"
              value={newMinute}
              onChange={(e) => setNewMinute(e.target.value)}
            >
              <option value="00">00</option>
              <option value="30">30</option>
            </select>
            <Button size="sm" onClick={handleAddTime}>추가</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddTime(false)}>취소</Button>
          </div>
        ) : (
          <button
            className="w-full py-2 text-sm text-primary font-medium border-2 border-dashed border-primary/40 rounded-lg hover:bg-primary/5 flex items-center justify-center gap-2"
            onClick={() => setShowAddTime(true)}
          >
            <Plus className="h-4 w-4" />
            시간 추가
          </button>
        )}
      </div>

      {/* 하단 안내 */}
      <div className="mt-3 px-2 text-xs text-gray-500">
        💡 거래처명과 내용 필드에서 🔍 아이콘을 클릭하면 등록된 데이터를 검색할 수 있습니다. ⠿ 아이콘을 드래그하면 순서를 변경할 수 있습니다.
      </div>
    </div>
  );
}
