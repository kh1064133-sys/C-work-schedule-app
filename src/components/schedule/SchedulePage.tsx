'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimeSlotRow } from './TimeSlotRow';
import { useDateStore } from '@/stores/dateStore';
import { useUIStore, type CopiedScheduleData } from '@/stores/uiStore';
import { useClients } from '@/hooks/useClients';
import { useItems } from '@/hooks/useItems';
import { useMoveSchedule, useSchedulesByDate, useSwapSchedules, useUpsertSchedule } from '@/hooks/useSchedules';
import { formatDate, formatDateKorean, getHolidayName, isSunday } from '@/lib/utils/date';
import { getScheduleAmountWithTax } from '@/lib/utils/scheduleAmount';
import { cn } from '@/lib/utils';
import type { PaymentMethod, Schedule, ScheduleInput, ScheduleType } from '@/types';

function getDayOfWeek(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
}

function isHoliday(date: Date): boolean {
  return getHolidayName(date) !== null;
}

function getDayInfo(date: Date) {
  const dayOfWeek = getDayOfWeek(date);
  return {
    dayOfWeek,
    isHoliday: isHoliday(date) || isSunday(date),
    holidayName: getHolidayName(date),
  };
}

const DEFAULT_TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
];

export function SchedulePage() {
  const { selectedDate, moveDay, goToToday } = useDateStore();
  const { copiedSchedule, setCopiedSchedule, setInstallTargetDate, showSalesSummary, toggleSection } = useUIStore();
  const dateStr = formatDate(selectedDate);

  const { data: schedules = [], isLoading: schedulesLoading } = useSchedulesByDate(selectedDate);
  const { data: clients = [] } = useClients();
  const { data: items = [] } = useItems();

  const upsertSchedule = useUpsertSchedule();
  const swapSchedules = useSwapSchedules();
  const moveSchedule = useMoveSchedule();

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [dragSourceSlot, setDragSourceSlot] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const [mobileDragSource, setMobileDragSource] = useState<string | null>(null);
  const [mobileDragOver, setMobileDragOver] = useState<string | null>(null);
  const [mobileDragY, setMobileDragY] = useState(0);
  const [mobileDragLabel, setMobileDragLabel] = useState('');

  const [showAddTime, setShowAddTime] = useState(false);
  const [newHour, setNewHour] = useState('09');
  const [newMinute, setNewMinute] = useState('00');

  const selectedSlotRef = useRef<string | null>(null);
  const copiedScheduleRef = useRef<CopiedScheduleData | null>(null);
  const scheduleMapRef = useRef<Record<string, Schedule>>({});
  const handleUpdateRef = useRef<((timeSlot: string, data: Partial<Schedule>) => Promise<void>) | null>(null);

  const mobileDragSourceRef = useRef<string | null>(null);
  const mobileDragOverRef = useRef<string | null>(null);
  const mobileDragActive = useRef(false);
  const mobileLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileTouchStartY = useRef(0);
  const dragScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduleListRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  useEffect(() => {
    copiedScheduleRef.current = copiedSchedule;
  }, [copiedSchedule]);

  const scheduleMap = useMemo(() => {
    const map: Record<string, Schedule> = {};
    schedules.forEach((schedule) => {
      map[schedule.time_slot || '09:00'] = schedule;
    });
    return map;
  }, [schedules]);

  useEffect(() => {
    scheduleMapRef.current = scheduleMap;
  }, [scheduleMap]);

  const allTimeSlots = useMemo(() => {
    const usedSlots = schedules.map((schedule) => schedule.time_slot || '09:00');
    return Array.from(new Set([...DEFAULT_TIME_SLOTS, ...usedSlots])).sort();
  }, [schedules]);

  const dayInfo = getDayInfo(selectedDate);

  const normalizeScheduleType = (value: Schedule['schedule_type'] | '' | undefined) =>
    value === '' ? null : value ?? undefined;

  const normalizePaymentMethod = (value: Schedule['payment_method'] | '' | undefined) =>
    value === '' ? null : value ?? undefined;

  const handleUpdate = useCallback(async (timeSlot: string, data: Partial<Schedule>) => {
    try {
      const existing = scheduleMapRef.current[timeSlot];
      const scheduleType = normalizeScheduleType(data.schedule_type);
      const paymentMethod = normalizePaymentMethod(data.payment_method);

      if (data.event_icon === 'install') {
        setInstallTargetDate(dateStr);
      }

      if (existing) {
        const updateData: ScheduleInput & { id: string; user_id?: string } = {
          id: existing.id,
          date: dateStr,
          time_slot: timeSlot,
        };

        if ('title' in data) updateData.title = data.title ?? '';
        if ('memo' in data) updateData.memo = data.memo ?? '';
        if ('unit' in data) updateData.unit = data.unit ?? '';
        if ('amount' in data) updateData.amount = data.amount ?? 0;
        if ('is_done' in data) updateData.is_done = data.is_done ?? false;
        if ('is_reserved' in data) updateData.is_reserved = data.is_reserved ?? false;
        if ('is_paid' in data) updateData.is_paid = data.is_paid ?? false;
        if ('schedule_type' in data) updateData.schedule_type = scheduleType as ScheduleType | null | undefined;
        if ('payment_method' in data) updateData.payment_method = paymentMethod as PaymentMethod | null | undefined;
        if ('event_icon' in data) updateData.event_icon = data.event_icon ?? null;

        await upsertSchedule.mutateAsync(updateData);
        return;
      }

      if (data.title || data.memo || data.amount || data.event_icon) {
        await upsertSchedule.mutateAsync({
          date: dateStr,
          time_slot: timeSlot,
          title: data.title ?? '',
          memo: data.memo ?? '',
          unit: data.unit ?? '',
          amount: data.amount ?? 0,
          schedule_type: 'schedule_type' in data ? (scheduleType as ScheduleType | null | undefined) : undefined,
          payment_method: 'payment_method' in data ? (paymentMethod as PaymentMethod | null | undefined) : undefined,
          event_icon: 'event_icon' in data ? data.event_icon ?? null : undefined,
          is_done: data.is_done ?? false,
          is_reserved: data.is_reserved ?? false,
          is_paid: data.is_paid ?? false,
          sort_order: allTimeSlots.indexOf(timeSlot),
        });
      }
    } catch (error) {
      console.error('일정 저장 실패:', error);
      alert('일정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [allTimeSlots, dateStr, setInstallTargetDate, upsertSchedule]);

  useEffect(() => {
    handleUpdateRef.current = handleUpdate;
  }, [handleUpdate]);

  const showCopyToast = useCallback((message: string) => {
    setCopyFeedback(message);
    window.setTimeout(() => setCopyFeedback(null), 1500);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        const slot = selectedSlotRef.current;
        if (!slot) return;

        const schedule = scheduleMapRef.current[slot];
        if (!schedule?.title) return;

        setCopiedSchedule({
          title: schedule.title,
          unit: schedule.unit,
          memo: schedule.memo,
          schedule_type: schedule.schedule_type,
          amount: schedule.amount,
          payment_method: schedule.payment_method,
          event_icon: schedule.event_icon ?? null,
          is_done: schedule.is_done ?? false,
          is_reserved: schedule.is_reserved ?? false,
          is_paid: schedule.is_paid ?? false,
        });

        const lines = [
          `일정 ${formatDate(useDateStore.getState().selectedDate)} ${slot}`,
          `거래처 ${schedule.title}`,
          schedule.unit ? `동호수 ${schedule.unit}` : '',
          schedule.memo ? `내용 ${schedule.memo}` : '',
          getScheduleAmountWithTax(schedule) ? `금액 ${getScheduleAmountWithTax(schedule).toLocaleString()}원` : '',
        ].filter(Boolean);

        navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
        showCopyToast('복사 완료');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        const slot = selectedSlotRef.current;
        const copied = copiedScheduleRef.current;
        if (!slot || !copied) return;

        event.preventDefault();
        handleUpdateRef.current?.(slot, {
          title: copied.title,
          unit: copied.unit,
          memo: copied.memo,
          schedule_type: copied.schedule_type,
          amount: copied.amount,
          payment_method: copied.payment_method,
          event_icon: copied.event_icon ?? null,
          is_done: copied.is_done ?? false,
          is_reserved: copied.is_reserved ?? false,
          is_paid: copied.is_paid ?? false,
        });
        setSelectedSlot(null);
        showCopyToast('붙여넣기 완료');
      }

      if (event.key === 'Escape') {
        setSelectedSlot(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCopiedSchedule, showCopyToast]);

  const handleCopySchedule = useCallback((timeSlot: string) => {
    const schedule = scheduleMapRef.current[timeSlot];
    if (!schedule?.title) return;

    setCopiedSchedule({
      title: schedule.title,
      unit: schedule.unit,
      memo: schedule.memo,
      schedule_type: schedule.schedule_type,
      amount: schedule.amount,
      payment_method: schedule.payment_method,
      event_icon: schedule.event_icon ?? null,
      is_done: schedule.is_done ?? false,
      is_reserved: schedule.is_reserved ?? false,
      is_paid: schedule.is_paid ?? false,
    });

    navigator.clipboard?.writeText([
      `일정 ${dateStr} ${timeSlot}`,
      `거래처 ${schedule.title}`,
      schedule.unit ? `동호수 ${schedule.unit}` : '',
      schedule.memo ? `내용 ${schedule.memo}` : '',
      getScheduleAmountWithTax(schedule) ? `금액 ${getScheduleAmountWithTax(schedule).toLocaleString()}원` : '',
    ].filter(Boolean).join('\n')).catch(() => {});

    showCopyToast('복사 완료');
  }, [dateStr, setCopiedSchedule, showCopyToast]);

  const handlePasteSchedule = useCallback((timeSlot: string) => {
    const copied = copiedScheduleRef.current;
    if (!copied) return;

    handleUpdateRef.current?.(timeSlot, {
      title: copied.title,
      unit: copied.unit,
      memo: copied.memo,
      schedule_type: copied.schedule_type,
      amount: copied.amount,
      payment_method: copied.payment_method,
      event_icon: copied.event_icon ?? null,
      is_done: copied.is_done ?? false,
      is_reserved: copied.is_reserved ?? false,
      is_paid: copied.is_paid ?? false,
    });
    showCopyToast('붙여넣기 완료');
  }, [showCopyToast]);

  const handleToggleReserved = useCallback(async (timeSlot: string) => {
    const schedule = scheduleMapRef.current[timeSlot];
    if (!schedule) return;

    await upsertSchedule.mutateAsync({
      id: schedule.id,
      date: dateStr,
      time_slot: timeSlot,
      is_reserved: !schedule.is_reserved,
    });
  }, [dateStr, upsertSchedule]);

  const handleDragStart = useCallback((timeSlot: string) => {
    setDragSourceSlot(timeSlot);
  }, []);

  const handleDragOver = useCallback((timeSlot: string) => {
    setDragOverSlot(timeSlot);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragSourceSlot(null);
    setDragOverSlot(null);
  }, []);

  const handleDrop = useCallback(async (targetSlot: string) => {
    if (!dragSourceSlot || dragSourceSlot === targetSlot) {
      handleDragEnd();
      return;
    }

    const sourceSchedule = scheduleMapRef.current[dragSourceSlot];
    const targetSchedule = scheduleMapRef.current[targetSlot];

    if (sourceSchedule && targetSchedule) {
      await swapSchedules.mutateAsync({
        schedule1: sourceSchedule,
        schedule2: targetSchedule,
        date: dateStr,
      });
    } else if (sourceSchedule) {
      await moveSchedule.mutateAsync({
        id: sourceSchedule.id,
        time_slot: targetSlot,
        date: dateStr,
      });
    }

    handleDragEnd();
  }, [dateStr, dragSourceSlot, handleDragEnd, moveSchedule, swapSchedules]);

  const setMobileDragSourceTracked = useCallback((value: string | null) => {
    mobileDragSourceRef.current = value;
    setMobileDragSource(value);
  }, []);

  const setMobileDragOverTracked = useCallback((value: string | null) => {
    mobileDragOverRef.current = value;
    setMobileDragOver(value);
  }, []);

  const findSlotAtY = useCallback((y: number): string | null => {
    const container = scheduleListRef.current;
    if (!container) return null;

    const rows = container.querySelectorAll<HTMLElement>('[data-timeslot]');
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.height > 0 && y >= rect.top && y <= rect.bottom) {
        return row.getAttribute('data-timeslot');
      }
    }

    return null;
  }, []);

  const handleMobileDragTouchStart = useCallback((timeSlot: string, y: number, immediate?: boolean) => {
    mobileTouchStartY.current = y;

    const startDrag = () => {
      mobileDragActive.current = true;
      setMobileDragSourceTracked(timeSlot);
      setMobileDragY(y);
      setMobileDragLabel(timeSlot);
      if (navigator.vibrate) navigator.vibrate(30);
    };

    if (immediate) {
      startDrag();
      return;
    }

    mobileLongPressTimer.current = setTimeout(startDrag, 250);
  }, [setMobileDragSourceTracked]);

  const handleMobileDragTouchMove = useCallback((y: number) => {
    if (!mobileDragActive.current) {
      if (Math.abs(y - mobileTouchStartY.current) > 10 && mobileLongPressTimer.current) {
        clearTimeout(mobileLongPressTimer.current);
        mobileLongPressTimer.current = null;
      }
      return;
    }

    setMobileDragY(y);
    setMobileDragOverTracked(findSlotAtY(y));

    const container = scheduleListRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const edge = 40;
    const speed = 8;

    if (dragScrollRef.current) {
      clearInterval(dragScrollRef.current);
      dragScrollRef.current = null;
    }

    if (y < rect.top + edge && container.scrollTop > 0) {
      dragScrollRef.current = setInterval(() => {
        container.scrollTop -= speed;
      }, 16);
    } else if (y > rect.bottom - edge && container.scrollTop < container.scrollHeight - container.clientHeight) {
      dragScrollRef.current = setInterval(() => {
        container.scrollTop += speed;
      }, 16);
    }
  }, [findSlotAtY, setMobileDragOverTracked]);

  const handleMobileDragTouchEnd = useCallback(async () => {
    if (mobileLongPressTimer.current) {
      clearTimeout(mobileLongPressTimer.current);
      mobileLongPressTimer.current = null;
    }

    if (!mobileDragActive.current || !mobileDragSourceRef.current) {
      mobileDragActive.current = false;
      setMobileDragSourceTracked(null);
      setMobileDragOverTracked(null);
      return;
    }

    mobileDragActive.current = false;

    const sourceSlot = mobileDragSourceRef.current;
    const targetSlot = mobileDragOverRef.current;

    setMobileDragSourceTracked(null);
    setMobileDragOverTracked(null);
    setMobileDragLabel('');

    if (!targetSlot || targetSlot === sourceSlot) return;

    const sourceSchedule = scheduleMapRef.current[sourceSlot];
    const targetSchedule = scheduleMapRef.current[targetSlot];

    if (sourceSchedule && targetSchedule) {
      await swapSchedules.mutateAsync({
        schedule1: sourceSchedule,
        schedule2: targetSchedule,
        date: dateStr,
      });
    } else if (sourceSchedule) {
      await moveSchedule.mutateAsync({
        id: sourceSchedule.id,
        time_slot: targetSlot,
        date: dateStr,
      });
    }
  }, [dateStr, moveSchedule, setMobileDragOverTracked, setMobileDragSourceTracked, swapSchedules]);

  useEffect(() => {
    if (!mobileDragSource) {
      if (dragScrollRef.current) {
        clearInterval(dragScrollRef.current);
        dragScrollRef.current = null;
      }
      return;
    }

    const prevent = (event: globalThis.TouchEvent) => event.preventDefault();
    document.addEventListener('touchmove', prevent, { passive: false });

    return () => {
      document.removeEventListener('touchmove', prevent);
      if (dragScrollRef.current) {
        clearInterval(dragScrollRef.current);
        dragScrollRef.current = null;
      }
    };
  }, [mobileDragSource]);

  // 네이티브 터치 리스너로 스와이프 감지 (버튼/인풋 위에서도 동작)
  useEffect(() => {
    const el = scheduleListRef.current;
    if (!el) return;

    let startX = 0, startY = 0;
    let tracking = false;
    let swiping = false;

    const onStart = (e: globalThis.TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="dialog"], .fixed, [data-grip]')) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      swiping = false;
    };

    const onMove = (e: globalThis.TouchEvent) => {
      if (!tracking) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (!swiping && dy > 10 && dy > dx * 1.5) {
        tracking = false; // 세로 스크롤 → 포기
        return;
      }
      if (dx > 10 && dx > dy * 1.5) {
        swiping = true;
        if (e.cancelable) e.preventDefault(); // 세로스크롤·클릭 이벤트 차단
      }
    };

    const onEnd = (e: globalThis.TouchEvent) => {
      if (!tracking || !swiping) { tracking = false; swiping = false; return; }
      tracking = false;
      swiping = false;
      const diffX = startX - e.changedTouches[0].clientX;
      const diffY = startY - e.changedTouches[0].clientY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
        moveDay(diffX > 0 ? 1 : -1);
      }
    };

    const onCancel = () => { tracking = false; swiping = false; };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [moveDay]);

  const handleAddTime = useCallback(() => {
    const timeSlot = `${newHour.padStart(2, '0')}:${newMinute}`;
    if (!allTimeSlots.includes(timeSlot)) {
      void upsertSchedule.mutateAsync({
        date: dateStr,
        time_slot: timeSlot,
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
  }, [allTimeSlots, dateStr, newHour, newMinute, upsertSchedule]);

  const todaySales = useMemo(
    () => schedules.filter((schedule) => schedule.is_done).reduce((sum, schedule) => sum + getScheduleAmountWithTax(schedule), 0),
    [schedules],
  );

  const salesByType = useMemo(() => {
    const doneSchedules = schedules.filter((schedule) => schedule.is_done);
    return {
      sale: doneSchedules.filter((schedule) => schedule.schedule_type === 'sale').reduce((sum, schedule) => sum + getScheduleAmountWithTax(schedule), 0),
      as: doneSchedules.filter((schedule) => schedule.schedule_type === 'as').reduce((sum, schedule) => sum + getScheduleAmountWithTax(schedule), 0),
      agency: doneSchedules.filter((schedule) => schedule.schedule_type === 'agency').reduce((sum, schedule) => sum + getScheduleAmountWithTax(schedule), 0),
    };
  }, [schedules]);

  const salesByPayment = useMemo(() => {
    const doneSchedules = schedules.filter((schedule) => schedule.is_done);
    return {
      cash: doneSchedules.filter((schedule) => schedule.payment_method === 'cash').reduce((sum, schedule) => sum + getScheduleAmountWithTax(schedule), 0),
      card: doneSchedules.filter((schedule) => schedule.payment_method === 'card').reduce((sum, schedule) => sum + getScheduleAmountWithTax(schedule), 0),
      vat: doneSchedules.filter((schedule) => schedule.payment_method === 'vat').reduce((sum, schedule) => sum + getScheduleAmountWithTax(schedule), 0),
    };
  }, [schedules]);

  const pendingCount = useMemo(
    () => schedules.filter((schedule) => !schedule.is_done && Boolean(schedule.title)).length,
    [schedules],
  );

  const reservedCount = useMemo(
    () => schedules.filter((schedule) => schedule.is_reserved).length,
    [schedules],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-col gap-3 px-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => moveDay(-1)} onTouchStart={(event) => event.stopPropagation()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                'text-lg font-bold lg:text-2xl',
                dayInfo.isHoliday && 'text-red-500',
                dayInfo.dayOfWeek === '토' && 'text-blue-500',
              )}
            >
              {formatDateKorean(selectedDate)} ({dayInfo.dayOfWeek})
            </h2>
            {dayInfo.holidayName && (
              <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                {dayInfo.holidayName}
              </span>
            )}
          </div>

          <Button variant="outline" size="icon" onClick={() => moveDay(1)} onTouchStart={(event) => event.stopPropagation()}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            onTouchStart={(event) => event.stopPropagation()}
            className="ml-2"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            오늘
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs lg:gap-4 lg:text-sm">
          <div className="rounded-lg bg-green-100 px-2 py-1 font-medium text-green-700 lg:px-3 lg:py-1.5">
            매출: <span className="font-bold">{todaySales.toLocaleString()}원</span>
          </div>
          {pendingCount > 0 && (
            <div className="rounded-lg bg-red-100 px-2 py-1 font-medium text-red-700 lg:px-3 lg:py-1.5">
              미완료: <span className="font-bold">{pendingCount}건</span>
            </div>
          )}
          {reservedCount > 0 && (
            <div className="rounded-lg bg-blue-100 px-2 py-1 font-medium text-blue-700 lg:px-3 lg:py-1.5">
              예약: <span className="font-bold">{reservedCount}건</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-t-lg border bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 lg:hidden">
        일정 목록
      </div>

      <div
        ref={scheduleListRef}
        className="flex-1 overflow-y-auto border border-t-0 bg-white lg:rounded-t-lg lg:border-t"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="sticky top-0 z-10 hidden rounded-t-lg border-b bg-gray-100 lg:block">
          <div className="grid grid-cols-[28px_80px_1fr_100px_1fr_100px_120px_100px_40px_60px_70px_60px] gap-2 border-l-4 border-l-transparent px-3 py-2 text-sm font-semibold text-gray-700">
            <div />
            <div className="text-center">시간</div>
            <div className="text-center">거래처명</div>
            <div className="text-center">동호수</div>
            <div className="text-center">내용</div>
            <div className="text-center">유형</div>
            <div className="text-center">금액</div>
            <div className="text-center">결제방법</div>
            <div className="text-center">이벤트</div>
            <div className="text-center">예약</div>
            <div className="text-center">완료</div>
            <div className="text-center">입금</div>
          </div>
        </div>

        {schedulesLoading ? (
          <div className="flex h-40 items-center justify-center text-gray-500">
            <div className="mr-2 animate-spin">◌</div>
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
              onToggleReserved={() => handleToggleReserved(timeSlot)}
              isDragging={dragSourceSlot === timeSlot}
              isDragOver={dragOverSlot === timeSlot}
              onDragStart={() => handleDragStart(timeSlot)}
              onDragOver={() => handleDragOver(timeSlot)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(timeSlot)}
              isSelected={selectedSlot === timeSlot}
              onSelect={() => setSelectedSlot(timeSlot)}
              copiedScheduleExists={Boolean(copiedSchedule)}
              onCopySchedule={() => handleCopySchedule(timeSlot)}
              onPasteSchedule={() => handlePasteSchedule(timeSlot)}
              isMobileDragging={mobileDragSource === timeSlot}
              isMobileDragOver={mobileDragOver === timeSlot}
              onMobileDragTouchStart={(y, immediate) => handleMobileDragTouchStart(timeSlot, y, immediate)}
              onMobileDragTouchMove={handleMobileDragTouchMove}
              onMobileDragTouchEnd={handleMobileDragTouchEnd}
            />
          ))
        )}

        {mobileDragSource && (
          <div
            style={{
              position: 'fixed',
              left: '50%',
              top: mobileDragY - 20,
              transform: 'translateX(-50%)',
              background: 'rgba(26, 35, 126, 0.9)',
              color: 'white',
              padding: '6px 18px',
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 700,
              zIndex: 9999,
              pointerEvents: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}
          >
            {mobileDragLabel} 이동 중...
          </div>
        )}
      </div>

      <div className="rounded-b-lg border border-t-0 bg-gray-50 p-2">
        {showAddTime ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <input
              type="number"
              min="0"
              max="23"
              className="w-14 rounded border px-2 py-1 text-center font-bold"
              value={newHour}
              onChange={(event) => setNewHour(event.target.value.slice(0, 2))}
            />
            <span className="font-bold text-primary">:</span>
            <select
              className="rounded border px-2 py-1 font-bold"
              value={newMinute}
              onChange={(event) => setNewMinute(event.target.value)}
            >
              <option value="00">00</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="40">40</option>
              <option value="50">50</option>
            </select>
            <Button size="sm" onClick={handleAddTime}>추가</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddTime(false)}>취소</Button>
          </div>
        ) : (
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            onClick={() => setShowAddTime(true)}
          >
            <Plus className="h-4 w-4" />
            시간 추가
          </button>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-lg">
        <button
          onClick={() => toggleSection('showSalesSummary')}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <span className="text-sm font-bold">오늘 매출 요약</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{todaySales.toLocaleString()}원</span>
            {showSalesSummary ? <ChevronUp className="h-4 w-4 text-white/80" /> : <ChevronDown className="h-4 w-4 text-white/80" />}
          </div>
        </button>
        {showSalesSummary && (
          <div className="mx-3 mb-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm">
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-green-600">판매</span>
                <span className="font-semibold">{salesByType.sale.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-orange-500">AS</span>
                <span className="font-semibold">{salesByType.as.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-indigo-600">대리점</span>
                <span className="font-semibold">{salesByType.agency.toLocaleString()}원</span>
              </div>
              <div className="my-1 border-t border-white/20" />
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-green-700">현금</span>
                <span className="text-green-200">{salesByPayment.cash.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-blue-600">카드</span>
                <span className="text-blue-200">{salesByPayment.card.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-orange-600">VAT</span>
                <span className="text-orange-200">{salesByPayment.vat.toLocaleString()}원</span>
              </div>
              {pendingCount > 0 && (
                <>
                  <div className="my-1 border-t border-white/20" />
                  <div className="flex items-center justify-between rounded-lg bg-red-500/20 px-2 py-1">
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">미완료</span>
                    <span className="font-bold text-red-200">{pendingCount}건</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 hidden px-2 text-xs text-gray-500 lg:block">
        거래처명과 내용 필드에서 검색 아이콘을 누르면 등록된 데이터를 찾을 수 있습니다. 핸들을 드래그하면 순서를 바꿀 수 있고, 선택 후 Ctrl+C/V로 일정 복사와 붙여넣기도 가능합니다.
      </div>

      {copyFeedback && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(26, 35, 126, 0.9)',
            color: 'white',
            padding: '8px 20px',
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 99999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }}
        >
          {copyFeedback}
        </div>
      )}
    </div>
  );
}
