'use client';

import { useState, useMemo, useCallback, useRef, useEffect, TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimeSlotRow } from './TimeSlotRow';
import { useDateStore } from '@/stores/dateStore';
import { useUIStore, type CopiedScheduleData } from '@/stores/uiStore';
import { useSchedulesByDate, useUpsertSchedule, useDeleteSchedule, useSwapSchedules, useMoveSchedule } from '@/hooks/useSchedules';
import { useClients } from '@/hooks/useClients';
import { useItems } from '@/hooks/useItems';
import { formatDateKorean, formatDate, getHolidayName, isSunday, isSaturday } from '@/lib/utils/date';
import { cn } from '@/lib/utils';
import type { Schedule, ScheduleType, PaymentMethod, ScheduleInput } from '@/types';

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

// 시간 슬롯 생성 (기본 시간대 - 1시간 단위)
const DEFAULT_TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
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
  const moveSchedule = useMoveSchedule();

  // 선택/복사 상태
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const { copiedSchedule, setCopiedSchedule } = useUIStore();

  const { _forceSetActiveTab, setInstallTargetDate } = useUIStore();

  // 드래그 상태
  const [dragSourceSlot, setDragSourceSlot] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // 모바일 터치 드래그 상태
  const [mobileDragSource, setMobileDragSource] = useState<string | null>(null);
  const [mobileDragOver, setMobileDragOver] = useState<string | null>(null);
  const [mobileDragY, setMobileDragY] = useState<number>(0);
  const [mobileDragLabel, setMobileDragLabel] = useState<string>('');
  const mobileDragActive = useRef(false);
  const mobileLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileTouchStartY = useRef(0);
  const dragScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduleListRef = useRef<HTMLDivElement>(null);
  // stale closure 방지용 ref
  const mobileDragSourceRef = useRef<string | null>(null);
  const mobileDragOverRef = useRef<string | null>(null);

  // 드래그 hit-test: data-timeslot 속성으로 DOM에서 보이는 요소 검색
  const findSlotAtY = useCallback((y: number): string | null => {
    const container = scheduleListRef.current;
    if (!container) return null;
    const rows = container.querySelectorAll<HTMLElement>('[data-timeslot]');
    for (const el of rows) {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && y >= rect.top && y <= rect.bottom) {
        return el.getAttribute('data-timeslot');
      }
    }
    return null;
  }, []);

  // state 변경 시 ref 동기화
  const setMobileDragSourceTracked = useCallback((v: string | null) => {
    mobileDragSourceRef.current = v;
    setMobileDragSource(v);
  }, []);
  const setMobileDragOverTracked = useCallback((v: string | null) => {
    mobileDragOverRef.current = v;
    setMobileDragOver(v);
  }, []);

  // 모바일 드래그: 길게 누르기 시작
  const handleMobileDragTouchStart = useCallback((timeSlot: string, y: number, immediate?: boolean) => {
    mobileTouchStartY.current = y;
    if (immediate) {
      // 그립 핸들 터치: 즉시 드래그 활성화
      mobileDragActive.current = true;
      setMobileDragSourceTracked(timeSlot);
      setMobileDragY(y);
      setMobileDragLabel(timeSlot);
      if (navigator.vibrate) navigator.vibrate(30);
      return;
    }
    mobileLongPressTimer.current = setTimeout(() => {
      mobileDragActive.current = true;
      setMobileDragSourceTracked(timeSlot);
      setMobileDragY(y);
      setMobileDragLabel(timeSlot);
      // 햅틱 피드백 (지원 시)
      if (navigator.vibrate) navigator.vibrate(30);
    }, 250);
  }, [setMobileDragSourceTracked]);

  // 터치 드래그: 움직이기
  const handleMobileDragTouchMove = useCallback((y: number) => {
    // 길게 누르기 전에 10px 이상 움직이면 타이머 취소 (일반 스크롤)
    if (!mobileDragActive.current) {
      if (Math.abs(y - mobileTouchStartY.current) > 10 && mobileLongPressTimer.current) {
        clearTimeout(mobileLongPressTimer.current);
        mobileLongPressTimer.current = null;
      }
      return;
    }
    setMobileDragY(y);
    // DOM 기반 hit-test (보이는 요소만 자동 검색)
    const foundSlot = findSlotAtY(y);
    setMobileDragOverTracked(foundSlot);

    // 자동 스크롤: 컨테이너 상하 40px 영역에서 스크롤
    const container = scheduleListRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const EDGE = 40;
      const SPEED = 8;
      if (dragScrollRef.current) { clearInterval(dragScrollRef.current); dragScrollRef.current = null; }
      if (y < rect.top + EDGE && container.scrollTop > 0) {
        dragScrollRef.current = setInterval(() => { container.scrollTop -= SPEED; }, 16);
      } else if (y > rect.bottom - EDGE && container.scrollTop < container.scrollHeight - container.clientHeight) {
        dragScrollRef.current = setInterval(() => { container.scrollTop += SPEED; }, 16);
      }
    }
  }, [findSlotAtY, setMobileDragOverTracked]);

  // 드래그 중일 때 body 스크롤 방지 + 자동스크롤 정리
  useEffect(() => {
    if (!mobileDragSource) {
      if (dragScrollRef.current) { clearInterval(dragScrollRef.current); dragScrollRef.current = null; }
      return;
    }
    const prevent = (e: globalThis.TouchEvent) => { e.preventDefault(); };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      document.removeEventListener('touchmove', prevent);
      if (dragScrollRef.current) { clearInterval(dragScrollRef.current); dragScrollRef.current = null; }
    };
  }, [mobileDragSource]);

  // 복사/붙여넣기를 위한 ref (키보드 이벤트 리스너에서 최신 값 참조)
  const selectedSlotRef = useRef<string | null>(null);
  selectedSlotRef.current = selectedSlot;
  const copiedScheduleRef = useRef<CopiedScheduleData | null>(null);
  copiedScheduleRef.current = copiedSchedule;
  const scheduleMapRef = useRef<Record<string, Schedule>>({});

  // 시간 추가 상태
  const [showAddTime, setShowAddTime] = useState(false);
  const [newHour, setNewHour] = useState('09');
  const [newMinute, setNewMinute] = useState('00');

  // 스와이프 처리
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const isVerticalScrolling = useRef(false);
  
  const swipeValid = useRef(false);

  const handleTouchStart = (e: TouchEvent) => {
    // 팝업, 캔버스, 모달 내부 터치는 스와이프 무시
    const target = e.target as HTMLElement;
    if (target.closest('canvas, [role="dialog"], .fixed')) {
      swipeValid.current = false;
      return;
    }
    swipeValid.current = true;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    isVerticalScrolling.current = false;
  };
  
  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    // 세로 이동이 가로보다 크면 스크롤로 판단 → 스와이프 차단
    const dx = Math.abs(touchEndX.current - touchStartX.current);
    const dy = Math.abs(touchEndY.current - touchStartY.current);
    if (dy > dx && dy > 10) {
      isVerticalScrolling.current = true;
    }
  };
  
  const handleTouchEnd = () => {
    // 유효하지 않은 스와이프(팝업/캔버스 내부)면 무시
    if (!swipeValid.current) return;
    swipeValid.current = false;

    // 세로 스크롤 중이었으면 스와이프 무시
    if (isVerticalScrolling.current) {
      touchStartX.current = 0;
      touchStartY.current = 0;
      touchEndX.current = 0;
      touchEndY.current = 0;
      isVerticalScrolling.current = false;
      return;
    }

    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;
    const threshold = 50; // 최소 스와이프 거리
    
    // 수평 이동이 수직 이동의 2배 이상일 때만 스와이프
    if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY) * 2) {
      if (diffX > 0) {
        // 왼쪽으로 밀기 -> 다음 일
        moveDay(1);
      } else {
        // 오른쪽으로 밀기 -> 이전 일
        moveDay(-1);
      }
    }
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
    isVerticalScrolling.current = false;
  };

  // 스케줄 목록 컨테이너 (세로 스크롤 시 스와이프 차단)
  const listTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = scheduleListRef.current;
    if (!el) return;
    const onTouchStart = (e: globalThis.TouchEvent) => {
      listTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchMove = (e: globalThis.TouchEvent) => {
      // 드래그 중이면 전파 차단 안함 (React onTouchMove가 root까지 버블링되어야 동작)
      if (mobileDragActive.current) return;
      if (!listTouchStartRef.current) return;
      const dx = Math.abs(e.touches[0].clientX - listTouchStartRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - listTouchStartRef.current.y);
      // 세로 이동이 가로보다 클 때만 부모 전파 차단 (세로 스크롤 보호)
      // 가로 이동이 더 크면 전파 허용 → 부모의 좌우 스와이프 동작
      if (dy > dx) {
        e.stopPropagation();
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

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

  // scheduleMap ref 업데이트
  scheduleMapRef.current = scheduleMap;

  // handleUpdate ref (키보드 이벤트에서 사용)
  const handleUpdateRef = useRef<((timeSlot: string, data: Partial<Schedule>) => Promise<void>) | undefined>(undefined);

  // PC 키보드 Ctrl+C/V 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+C: 선택된 슬롯의 스케줄 복사
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const slot = selectedSlotRef.current;
        if (slot) {
          const s = scheduleMapRef.current[slot];
          if (s?.title) {
            setCopiedSchedule({
              title: s.title,
              unit: s.unit,
              memo: s.memo,
              schedule_type: s.schedule_type,
              amount: s.amount,
              payment_method: s.payment_method,
            });
            // 시스템 클립보드에도 텍스트 복사
            const lines: string[] = [];
            lines.push(`📅 ${formatDate(useDateStore.getState().selectedDate)} ${slot}`);
            lines.push(`거래처: ${s.title}`);
            if (s.unit) lines.push(`동호수: ${s.unit}`);
            if (s.memo) lines.push(`내용: ${s.memo}`);
            if (s.amount) lines.push(`금액: ${s.amount.toLocaleString()}원`);
            navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
            setCopyFeedback('📋 복사됨 (클립보드)');
            setTimeout(() => setCopyFeedback(null), 1500);
          }
        }
        // 브라우저 기본 복사(텍스트)도 동작하도록 preventDefault 안함
      }

      // Ctrl+V: 선택된 슬롯에 붙여넣기
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const slot = selectedSlotRef.current;
        const copied = copiedScheduleRef.current;
        if (slot && copied) {
          e.preventDefault();
          handleUpdateRef.current?.(slot, {
            title: copied.title,
            unit: copied.unit,
            memo: copied.memo,
            schedule_type: copied.schedule_type as any,
            amount: copied.amount,
            payment_method: copied.payment_method as any,
          });
          setCopyFeedback('📌 붙여넣기 완료');
          setTimeout(() => setCopyFeedback(null), 1500);
          setSelectedSlot(null);
        }
      }

      // Escape: 선택 해제
      if (e.key === 'Escape') {
        setSelectedSlot(null);
      }

      // Backspace: input 포커스 아닐 때 뒤로가기
      if (e.key === 'Backspace') {
        const el = document.activeElement;
        const isInput = el && (
          el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          (el as HTMLElement).isContentEditable
        );
        if (!isInput) {
          e.preventDefault();
          useUIStore.getState()._forceSetActiveTab('calendar');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCopiedSchedule]);

  // ── 브라우저 뒤로가기 감지 (popstate) ──
  useEffect(() => {
    window.history.pushState({ schedulePage: true }, '');

    const handlePopState = () => {
      _forceSetActiveTab('calendar');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [_forceSetActiveTab]);

  const handleGoToToday = useCallback(() => {
    goToToday();
  }, [goToToday]);

  // 사용 중인 시간 슬롯 + 기본 시간 슬롯 합치기
  const allTimeSlots = useMemo(() => {
    const scheduleSlots = schedules.map((s: Schedule) => s.time_slot || '09:00');
    const combined = new Set([...DEFAULT_TIME_SLOTS, ...scheduleSlots]);
    return Array.from(combined).sort();
  }, [schedules]);

  // 모바일 드래그: 떼기 (scheduleMap 선언 이후에 위치해야 함)
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

    const sourceSchedule = scheduleMap[sourceSlot];
    const targetSchedule = scheduleMap[targetSlot];

    if (sourceSchedule && targetSchedule) {
      await swapSchedules.mutateAsync({
        schedule1: sourceSchedule,
        schedule2: targetSchedule,
        date: dateStr,
      });
    } else if (sourceSchedule && !targetSchedule) {
      await moveSchedule.mutateAsync({
        id: sourceSchedule.id,
        time_slot: targetSlot,
        date: dateStr,
      });
    }
  }, [scheduleMap, dateStr, swapSchedules, moveSchedule, setMobileDragSourceTracked, setMobileDragOverTracked]);

  // 일정 생성/업데이트
  const handleUpdate = async (timeSlot: string, data: Partial<Schedule>) => {
    const existing = scheduleMap[timeSlot];
    
    // 빈 문자열을 null로 변환 (DB 체크 제약 조건 위반 방지)
    // null을 받으면 그대로 null 유지
    const scheduleType = data.schedule_type === null ? null : 
                         (data.schedule_type as string) === '' ? null : data.schedule_type;
    const paymentMethod = data.payment_method === null ? null :
                          (data.payment_method as string) === '' ? null : data.payment_method;
    
    if (existing) {
      // 기존 스케줄 업데이트 — 변경된 필드만 전송
      const updateData: Record<string, unknown> = {
        id: existing.id,
        date: dateStr,
        time_slot: timeSlot,
      };
      
      if ('title' in data) updateData.title = data.title;
      if ('memo' in data) updateData.memo = data.memo;
      if ('unit' in data) updateData.unit = data.unit;
      if ('amount' in data) updateData.amount = data.amount;
      if ('is_done' in data) updateData.is_done = data.is_done;
      if ('is_reserved' in data) updateData.is_reserved = data.is_reserved;
      if ('is_paid' in data) updateData.is_paid = data.is_paid;
      if ('schedule_type' in data) updateData.schedule_type = scheduleType;
      if ('payment_method' in data) updateData.payment_method = paymentMethod;
      if ('event_icon' in data) updateData.event_icon = data.event_icon;
      
      // 설치 뱃지 설정 시 외주설치 페이지 대상 날짜 업데이트
      if (data.event_icon === 'install') {
        setInstallTargetDate(dateStr);
      }
      
      await upsertSchedule.mutateAsync(updateData as unknown as ScheduleInput & { id?: string });
    } else if (data.title || data.memo || data.amount || data.event_icon) {
      // 새 스케줄 생성 (내용 또는 이벤트가 있을 때)
      // 설치 뱃지 설정 시 외주설치 페이지 대상 날짜 업데이트
      if (data.event_icon === 'install') {
        setInstallTargetDate(dateStr);
      }
      await upsertSchedule.mutateAsync({
        date: dateStr,
        time_slot: timeSlot,
        title: data.title || '',
        memo: data.memo || '',
        unit: data.unit || '',
        amount: data.amount || 0,
        schedule_type: 'schedule_type' in data ? (scheduleType as ScheduleType | undefined) : undefined,
        payment_method: 'payment_method' in data ? (paymentMethod as PaymentMethod | undefined) : undefined,
        event_icon: 'event_icon' in data ? data.event_icon : undefined,
        is_done: data.is_done || false,
        is_reserved: data.is_reserved || false,
        sort_order: allTimeSlots.indexOf(timeSlot),
      });
    }
  };

  // handleUpdate ref 업데이트 (키보드 핸들러에서 참조)
  handleUpdateRef.current = handleUpdate;

  // 모바일 복사 콜백
  const handleCopySchedule = useCallback((timeSlot: string) => {
    const s = scheduleMapRef.current[timeSlot];
    if (s?.title) {
      // 앱 내부 복사 (붙여넣기용)
      setCopiedSchedule({
        title: s.title,
        unit: s.unit,
        memo: s.memo,
        schedule_type: s.schedule_type,
        amount: s.amount,
        payment_method: s.payment_method,
      });

      // 시스템 클립보드에 텍스트 복사 (카톡/문자용)
      const lines: string[] = [];
      lines.push(`📅 ${dateStr} ${timeSlot}`);
      lines.push(`거래처: ${s.title}`);
      if (s.unit) lines.push(`동호수: ${s.unit}`);
      if (s.memo) lines.push(`내용: ${s.memo}`);
      if (s.amount) lines.push(`금액: ${s.amount.toLocaleString()}원`);
      const text = lines.join('\n');
      navigator.clipboard?.writeText(text).catch(() => {});

      setCopyFeedback('📋 복사됨 (클립보드)');
      setTimeout(() => setCopyFeedback(null), 1500);
    }
  }, [setCopiedSchedule, dateStr]);

  // 모바일 붙여넣기 콜백
  const handlePasteSchedule = useCallback((timeSlot: string) => {
    const copied = copiedScheduleRef.current;
    if (copied) {
      handleUpdateRef.current?.(timeSlot, {
        title: copied.title,
        unit: copied.unit,
        memo: copied.memo,
        schedule_type: copied.schedule_type as any,
        amount: copied.amount,
        payment_method: copied.payment_method as any,
      });
      setCopyFeedback('📌 붙여넣기 완료');
      setTimeout(() => setCopyFeedback(null), 1500);
    }
  }, []);

  // 완료/입금 확인 팝업 상태
  const [confirmDoneTarget, setConfirmDoneTarget] = useState<{ timeSlot: string; schedule: Schedule } | null>(null);
  const [confirmPaidTarget, setConfirmPaidTarget] = useState<{ timeSlot: string; schedule: Schedule } | null>(null);

  // 완료 토글 → 팝업 열기
  const handleToggleDone = (timeSlot: string) => {
    const existing = scheduleMap[timeSlot];
    if (existing) {
      setConfirmDoneTarget({ timeSlot, schedule: existing });
    }
  };

  // 완료 팝업 확인
  const handleConfirmDone = async () => {
    if (!confirmDoneTarget) return;
    const { schedule } = confirmDoneTarget;
    await upsertSchedule.mutateAsync({
      id: schedule.id,
      date: dateStr,
      time_slot: schedule.time_slot,
      is_done: !schedule.is_done,
    });
    setConfirmDoneTarget(null);
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

  // 입금 토글 → 팝업 열기
  const handleTogglePaid = (timeSlot: string) => {
    const existing = scheduleMap[timeSlot];
    if (existing) {
      setConfirmPaidTarget({ timeSlot, schedule: existing });
    }
  };

  // 입금 팝업 확인
  const handleConfirmPaid = async () => {
    if (!confirmPaidTarget) return;
    const { schedule } = confirmPaidTarget;
    await upsertSchedule.mutateAsync({
      id: schedule.id,
      date: dateStr,
      time_slot: schedule.time_slot,
      is_paid: !schedule.is_paid,
    });
    setConfirmPaidTarget(null);
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
      // 소스만 있으면 타겟 시간대로 이동 (update 사용, upsert 대신 PK 충돌 방지)
      await moveSchedule.mutateAsync({
        id: sourceSchedule.id,
        time_slot: targetSlot,
        date: dateStr,
      });
    }

    handleDragEnd();
  }, [dragSourceSlot, scheduleMap, dateStr, swapSchedules, moveSchedule, handleDragEnd]);

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

  // 매출현황 접기/펼치기
  const { showSalesSummary, toggleSection } = useUIStore();

  // 유형별 매출
  const salesByType = useMemo(() => {
    const done = schedules.filter((s: Schedule) => s.is_done);
    return {
      sale: done.filter(s => s.schedule_type === 'sale').reduce((sum, s) => sum + (s.amount || 0), 0),
      as: done.filter(s => s.schedule_type === 'as').reduce((sum, s) => sum + (s.amount || 0), 0),
      agency: done.filter(s => s.schedule_type === 'agency').reduce((sum, s) => sum + (s.amount || 0), 0),
    };
  }, [schedules]);

  // 결제방법별 매출
  const salesByPayment = useMemo(() => {
    const done = schedules.filter((s: Schedule) => s.is_done);
    return {
      cash: done.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + (s.amount || 0), 0),
      card: done.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + (s.amount || 0), 0),
      vat: done.filter(s => s.payment_method === 'vat').reduce((sum, s) => sum + (s.amount || 0), 0),
    };
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
    <div 
      className="flex flex-col h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 헤더: 날짜 네비게이션 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4 px-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => moveDay(-1)} onTouchStart={(e) => e.stopPropagation()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn(
              'text-lg lg:text-2xl font-bold',
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

          <Button variant="outline" size="icon" onClick={() => moveDay(1)} onTouchStart={(e) => e.stopPropagation()}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" onClick={handleGoToToday} onTouchStart={(e) => e.stopPropagation()} className="ml-2">
            <RotateCcw className="h-3 w-3 mr-1" />
            오늘
          </Button>
        </div>

        {/* 요약 정보 */}
        <div className="flex items-center gap-2 lg:gap-4 text-xs lg:text-sm flex-wrap">
          <div className="px-2 lg:px-3 py-1 lg:py-1.5 bg-green-100 text-green-700 rounded-lg font-medium">
            매출: <span className="font-bold">{todaySales.toLocaleString()}원</span>
          </div>
          {pendingCount > 0 && (
            <div className="px-2 lg:px-3 py-1 lg:py-1.5 bg-red-100 text-red-700 rounded-lg font-medium">
              미완료: <span className="font-bold">{pendingCount}건</span>
            </div>
          )}
          {reservedCount > 0 && (
            <div className="px-2 lg:px-3 py-1 lg:py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium">
              예약: <span className="font-bold">{reservedCount}건</span>
            </div>
          )}
        </div>
      </div>

      {/* 모바일 헤더 */}
      <div className="lg:hidden bg-gray-100 border rounded-t-lg px-3 py-2 text-sm font-semibold text-gray-700">
        스케줄 목록
      </div>

      {/* 스케줄 목록 */}
      <div
        ref={scheduleListRef}
        className="flex-1 overflow-y-auto border border-t-0 lg:border-t lg:rounded-t-lg bg-white"
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        {/* 테이블 헤더 - 데스크탑만 (sticky: 스크롤 시에도 고정, 너비 일치) */}
        <div className="hidden lg:block bg-gray-100 border-b sticky top-0 z-10 rounded-t-lg">
          <div className="grid grid-cols-[28px_80px_1fr_100px_1fr_100px_120px_100px_40px_60px_70px_60px] gap-2 px-3 py-2 text-sm font-semibold text-gray-700 border-l-4 border-l-transparent">
            <div></div>
            <div className="text-center">시간</div>
            <div className="text-center">거래처명</div>
            <div className="text-center">동호수</div>
            <div className="text-center">내용</div>
            <div className="text-center">유형</div>
            <div className="text-center">금액</div>
            <div className="text-center">결제방법</div>
            <div className="text-center">🏷️</div>
            <div className="text-center">예약</div>
            <div className="text-center">완료</div>
            <div className="text-center">입금</div>
          </div>
        </div>
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
              onCompletionClick={() => handleToggleDone(timeSlot)}
              onDepositClick={() => handleTogglePaid(timeSlot)}
              isDragging={dragSourceSlot === timeSlot}
              isDragOver={dragOverSlot === timeSlot}
              onDragStart={() => handleDragStart(timeSlot)}
              onDragOver={() => handleDragOver(timeSlot)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(timeSlot)}
              // 선택/복사/붙여넣기
              isSelected={selectedSlot === timeSlot}
              onSelect={() => setSelectedSlot(timeSlot)}
              copiedScheduleExists={!!copiedSchedule}
              onCopySchedule={() => handleCopySchedule(timeSlot)}
              onPasteSchedule={() => handlePasteSchedule(timeSlot)}
              // 모바일 터치 드래그
              isMobileDragging={mobileDragSource === timeSlot}
              isMobileDragOver={mobileDragOver === timeSlot}
              onMobileDragTouchStart={(y, immediate) => handleMobileDragTouchStart(timeSlot, y, immediate)}
              onMobileDragTouchMove={handleMobileDragTouchMove}
              onMobileDragTouchEnd={handleMobileDragTouchEnd}
            />
          ))
        )}
        {/* 모바일 드래그 인디케이터 */}
        {mobileDragSource && (
          <div style={{
            position: 'fixed',
            left: '50%',
            top: mobileDragY - 20,
            transform: 'translateX(-50%)',
            background: 'rgba(26, 35, 126, 0.9)',
            color: 'white',
            padding: '6px 18px',
            borderRadius: '16px',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}>
            ⠿ {mobileDragLabel} 이동 중...
          </div>
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
            className="w-full py-2 text-sm text-primary font-medium border-2 border-dashed border-primary/40 rounded-lg hover:bg-primary/5 flex items-center justify-center gap-2"
            onClick={() => setShowAddTime(true)}
          >
            <Plus className="h-4 w-4" />
            시간 추가
          </button>
        )}
      </div>

      {/* 매출현황 섹션 */}
      <div className="mt-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl overflow-hidden shadow-lg">
        <button
          onClick={() => toggleSection('showSalesSummary')}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="text-sm font-bold">💰 매출 현황</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{todaySales.toLocaleString()}원</span>
            {showSalesSummary ? <ChevronUp className="h-4 w-4 text-white/80" /> : <ChevronDown className="h-4 w-4 text-white/80" />}
          </div>
        </button>
        {showSalesSummary && (
          <div className="bg-white/15 rounded-xl mx-3 mb-3 p-3 backdrop-blur-sm">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="bg-white/90 text-green-600 px-2 py-0.5 rounded-full text-xs font-bold">판매</span>
                <span className="font-semibold">{salesByType.sale.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="bg-white/90 text-orange-500 px-2 py-0.5 rounded-full text-xs font-bold">AS</span>
                <span className="font-semibold">{salesByType.as.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="bg-white/90 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold">대리점</span>
                <span className="font-semibold">{salesByType.agency.toLocaleString()}원</span>
              </div>
              <div className="border-t border-white/20 my-1" />
              <div className="flex justify-between items-center">
                <span className="bg-white/90 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">현금</span>
                <span className="text-green-200">{salesByPayment.cash.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="bg-white/90 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">카드</span>
                <span className="text-blue-200">{salesByPayment.card.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="bg-white/90 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">VAT</span>
                <span className="text-orange-200">{salesByPayment.vat.toLocaleString()}원</span>
              </div>
              {pendingCount > 0 && (
                <>
                  <div className="border-t border-white/20 my-1" />
                  <div className="flex justify-between items-center bg-red-500/20 rounded-lg px-2 py-1">
                    <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">⚠ 미완료</span>
                    <span className="text-red-200 font-bold">{pendingCount}건</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 하단 안내 */}
      <div className="mt-3 px-2 text-xs text-gray-500 hidden lg:block">
        💡 거래처명과 내용 필드에서 🔍 아이콘을 클릭하면 등록된 데이터를 검색할 수 있습니다. ⠿ 아이콘을 드래그하면 순서를 변경할 수 있습니다. 행 클릭 후 Ctrl+C/V로 일정을 복사/붙여넣기 할 수 있습니다.
      </div>

      {/* 복사/붙여넣기 피드백 토스트 */}
      {copyFeedback && (
        <div style={{
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
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {copyFeedback}
        </div>
      )}

      {/* 완료 확인 팝업 */}
      {confirmDoneTarget && (
        <>
          <div onClick={() => setConfirmDoneTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 99999, background: 'white', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', width: 'min(340px, 90vw)', overflow: 'hidden' }}>
            <div style={{ background: confirmDoneTarget.schedule.is_done ? '#DC2626' : '#16a34a', color: 'white', padding: '16px 20px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {confirmDoneTarget.schedule.is_done ? '❌ 완료 취소' : '✅ 완료 처리 확인'}
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: '#9CA3AF', minWidth: 52 }}>시간</span><span style={{ fontWeight: 600 }}>{confirmDoneTarget.schedule.time_slot}</span></div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: '#9CA3AF', minWidth: 52 }}>거래처</span><span style={{ fontWeight: 600 }}>{confirmDoneTarget.schedule.title || '-'}</span></div>
                {confirmDoneTarget.schedule.unit && <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: '#9CA3AF', minWidth: 52 }}>동호수</span><span style={{ fontWeight: 600 }}>{confirmDoneTarget.schedule.unit}</span></div>}
                <div style={{ display: 'flex', gap: 8 }}><span style={{ color: '#9CA3AF', minWidth: 52 }}>금액</span><span style={{ fontWeight: 700, color: confirmDoneTarget.schedule.is_done ? '#DC2626' : '#16a34a' }}>{(confirmDoneTarget.schedule.amount || 0).toLocaleString()}원</span></div>
              </div>
              <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
                {confirmDoneTarget.schedule.is_done ? '완료를 취소하시겠습니까?' : '이 스케줄을 완료 처리하시겠습니까?'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDoneTarget(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #D1D5DB', background: 'white', color: '#6B7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button onClick={handleConfirmDone} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: confirmDoneTarget.schedule.is_done ? '#DC2626' : '#16a34a', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {confirmDoneTarget.schedule.is_done ? '❌ 완료 취소' : '✅ 완료'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 입금 확인 팝업 */}
      {confirmPaidTarget && (
        <>
          <div onClick={() => setConfirmPaidTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 99999, background: 'white', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', width: 'min(340px, 90vw)', overflow: 'hidden' }}>
            <div style={{ background: confirmPaidTarget.schedule.is_paid ? '#DC2626' : '#D97706', color: 'white', padding: '16px 20px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {confirmPaidTarget.schedule.is_paid ? '❌ 입금 취소' : '💰 입금 확인'}
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: '#9CA3AF', minWidth: 52 }}>시간</span><span style={{ fontWeight: 600 }}>{confirmPaidTarget.schedule.time_slot}</span></div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: '#9CA3AF', minWidth: 52 }}>거래처</span><span style={{ fontWeight: 600 }}>{confirmPaidTarget.schedule.title || '-'}</span></div>
                {confirmPaidTarget.schedule.unit && <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: '#9CA3AF', minWidth: 52 }}>동호수</span><span style={{ fontWeight: 600 }}>{confirmPaidTarget.schedule.unit}</span></div>}
                <div style={{ display: 'flex', gap: 8 }}><span style={{ color: '#9CA3AF', minWidth: 52 }}>금액</span><span style={{ fontWeight: 700, color: confirmPaidTarget.schedule.is_paid ? '#DC2626' : '#D97706' }}>{(confirmPaidTarget.schedule.amount || 0).toLocaleString()}원</span></div>
              </div>
              <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
                {confirmPaidTarget.schedule.is_paid ? '입금 확인을 취소하시겠습니까?' : '입금이 확인되었습니까?'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmPaidTarget(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #D1D5DB', background: 'white', color: '#6B7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button onClick={handleConfirmPaid} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: confirmPaidTarget.schedule.is_paid ? '#DC2626' : '#D97706', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {confirmPaidTarget.schedule.is_paid ? '❌ 입금 취소' : '💰 입금 확인'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
