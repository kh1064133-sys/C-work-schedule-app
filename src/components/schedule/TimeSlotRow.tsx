'use client';

import { useState, useRef, useEffect, type MutableRefObject } from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Schedule, ScheduleType, PaymentMethod, EventIcon, Client, Item } from '@/types';
import { CompletionPopup } from './CompletionPopup';
import { DepositPopup } from './DepositPopup';
import { useSaveCompletionRecord, useCompletionRecords, useDeleteCompletionRecords } from '@/hooks/useCompletionRecords';

interface TimeSlotRowProps {
  timeSlot: string;
  schedule: Schedule | null;
  clients?: Client[];
  items?: Item[];
  onUpdate: (data: Partial<Schedule>) => void;
  onToggleReserved: () => void;
  // 드래그 관련 (PC)
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  // 선택/복사/붙여넣기
  isSelected?: boolean;
  onSelect?: () => void;
  copiedScheduleExists?: boolean;
  onCopySchedule?: () => void;
  onPasteSchedule?: () => void;
  // 모바일 터치 드래그
  isMobileDragging?: boolean;
  isMobileDragOver?: boolean;
  onMobileDragTouchStart?: (y: number, immediate?: boolean) => void;
  onMobileDragTouchMove?: (y: number) => void;
  onMobileDragTouchEnd?: () => void;
  // 변경사항 감지 콜백
  onPendingChange?: (timeSlot: string, data: { title: string; memo: string; unit: string } | null) => void;
  // 네비게이션 중 onBlur DB 저장 차단용 ref
  blockSaveRef?: MutableRefObject<boolean>;
}

const SCHEDULE_TYPES = [
  { value: '', label: '유형 선택' },
  { value: 'sale', label: '판매' },
  { value: 'as', label: 'AS' },
  { value: 'agency', label: '대리점' },
  { value: 'group', label: '공동구매' },
  { value: 'install', label: '외주설치' },
];

const PAYMENT_METHODS = [
  { value: '', label: '결제방법' },
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'vat', label: 'VAT' },
  { value: 'free', label: '무상' },
];

const EVENT_ICONS: { value: EventIcon; label: string; emoji: string }[] = [
  { value: 'golf', label: '골프', emoji: '⛳' },
  { value: 'birthday', label: '생일', emoji: '🎂' },
  { value: 'meeting', label: '미팅', emoji: '🤝' },
  { value: 'install', label: '설치', emoji: '🔨' },
];

export function TimeSlotRow({
  timeSlot,
  schedule,
  clients = [],
  items = [],
  onUpdate,
  onToggleReserved,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isSelected = false,
  onSelect,
  copiedScheduleExists = false,
  onCopySchedule,
  onPasteSchedule,
  isMobileDragging = false,
  isMobileDragOver = false,
  onMobileDragTouchStart,
  onMobileDragTouchMove,
  onMobileDragTouchEnd,
  onPendingChange,
  blockSaveRef,
}: TimeSlotRowProps) {
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showClientPickerMobile, setShowClientPickerMobile] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showItemPickerMobile, setShowItemPickerMobile] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [unitValue, setUnitValue] = useState(schedule?.unit || '');
  
  // 로컬 입력 상태 (한글 IME 문제 해결 - PC/모바일 공통)
  const [titleValue, setTitleValue] = useState(schedule?.title || '');
  const [memoValue, setMemoValue] = useState(schedule?.memo || '');
  const [scheduleTypeValue, setScheduleTypeValue] = useState(schedule?.schedule_type || '');
  const [paymentMethodValue, setPaymentMethodValue] = useState(schedule?.payment_method || '');
  const isComposingRef = useRef(false);

  // 최신 로컬 값 ref (언마운트 시 flush용)
  const latestValuesRef = useRef({ title: titleValue, memo: memoValue, unit: unitValue });
  const scheduleRef = useRef(schedule);
  
  const clientInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // 터치 탭/스크롤 구분용 (모바일 검색 목록)
  const clientMobileDropdownRef = useRef<HTMLDivElement>(null);
  const itemMobileDropdownRef = useRef<HTMLDivElement>(null);
  const onUpdateRef = useRef(onUpdate);

  // 그립 핸들 ref (passive: false 터치 이벤트 등록용)
  const pcGripRef = useRef<HTMLDivElement>(null);
  const mobileGripRef = useRef<HTMLDivElement>(null);
  const mobileDragTouchStartRef = useRef(onMobileDragTouchStart);
  const mobileDragTouchMoveRef = useRef(onMobileDragTouchMove);
  const mobileDragTouchEndRef = useRef(onMobileDragTouchEnd);
  useEffect(() => {
    mobileDragTouchStartRef.current = onMobileDragTouchStart;
    mobileDragTouchMoveRef.current = onMobileDragTouchMove;
    mobileDragTouchEndRef.current = onMobileDragTouchEnd;
  });

  // schedule 값이 변경되면 로컬 상태 동기화
  useEffect(() => {
    setUnitValue(schedule?.unit || '');
  }, [schedule?.unit]);
  
  useEffect(() => {
    setTitleValue(schedule?.title || '');
  }, [schedule?.title]);
  
  useEffect(() => {
    setMemoValue(schedule?.memo || '');
  }, [schedule?.memo]);
  
  useEffect(() => {
    setScheduleTypeValue(schedule?.schedule_type || '');
  }, [schedule?.schedule_type]);
  
  useEffect(() => {
    setPaymentMethodValue(schedule?.payment_method || '');
  }, [schedule?.payment_method]);

  // onUpdate 콜백 최신 참조 유지
  useEffect(() => { onUpdateRef.current = onUpdate; });

  // 변경사항 감지: 로컬 상태가 DB 상태와 다르면 상위에 보고
  const onPendingChangeRef = useRef(onPendingChange);
  useEffect(() => {
    latestValuesRef.current = { title: titleValue, memo: memoValue, unit: unitValue };
    scheduleRef.current = schedule;
  }, [titleValue, memoValue, unitValue, schedule]);

  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  }, [onPendingChange]);

  useEffect(() => {
    const titlePending = titleValue !== (schedule?.title || '');
    const memoPending = memoValue !== (schedule?.memo || '');
    const unitPending = unitValue !== (schedule?.unit || '');

    if (titlePending || memoPending || unitPending) {
      onPendingChangeRef.current?.(timeSlot, { title: titleValue, memo: memoValue, unit: unitValue });
    } else {
      onPendingChangeRef.current?.(timeSlot, null);
    }
  }, [titleValue, memoValue, unitValue, schedule?.title, schedule?.memo, schedule?.unit, timeSlot]);

  // 컴포넌트 언마운트 시 미저장 데이터 flush (탭 이동 시 값 유실 방지)
  useEffect(() => {
    return () => {
      const { title, memo, unit } = latestValuesRef.current;
      const s = scheduleRef.current;
      const pendingData: Record<string, string> = {};
      if (title !== (s?.title || '')) pendingData.title = title;
      if (memo !== (s?.memo || '')) pendingData.memo = memo;
      if (unit !== (s?.unit || '')) pendingData.unit = unit;
      if (Object.keys(pendingData).length > 0) {
        onUpdateRef.current(pendingData as Partial<Schedule>);
      }
      onPendingChangeRef.current?.(timeSlot, null);
    };
  }, [timeSlot]);

  // 모바일 복사/붙여넣기 팝업 상태
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  // 그립 핸들: 네이티브 터치 이벤트 등록 (passive: false → preventDefault 가능)
  useEffect(() => {
    const grips = [pcGripRef.current, mobileGripRef.current].filter(Boolean) as HTMLElement[];
    const onStart = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      mobileDragTouchStartRef.current?.(e.touches[0].clientY, true);
    };
    const onMove = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      mobileDragTouchMoveRef.current?.(e.touches[0].clientY);
    };
    const onEnd = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      mobileDragTouchEndRef.current?.();
    };
    for (const el of grips) {
      el.addEventListener('touchstart', onStart, { passive: false });
      el.addEventListener('touchmove', onMove, { passive: false });
      el.addEventListener('touchend', onEnd, { passive: false });
    }
    return () => {
      for (const el of grips) {
        el.removeEventListener('touchstart', onStart);
        el.removeEventListener('touchmove', onMove);
        el.removeEventListener('touchend', onEnd);
      }
    };
  }, []);

  // 모바일 거래처 드롭다운: 네이티브 터치 이벤트 (passive: false)
  useEffect(() => {
    const el = clientMobileDropdownRef.current;
    if (!el) return;
    let startX = 0, startY = 0, scrolled = false;

    const onTouchStart = (e: globalThis.TouchEvent) => {
      e.stopPropagation();
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      scrolled = false;
    };
    const onTouchMove = (e: globalThis.TouchEvent) => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        scrolled = true;
      }
    };
    const onTouchEnd = (e: globalThis.TouchEvent) => {
      if (scrolled) return;
      e.preventDefault();
      const target = (e.target as HTMLElement).closest('[data-client-name]') as HTMLElement | null;
      if (target?.dataset.clientName) {
        setTitleValue(target.dataset.clientName);
        onUpdateRef.current({ title: target.dataset.clientName });
        setShowClientPickerMobile(false);
      }
    };
    const onScroll = () => { scrolled = true; };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('scroll', onScroll);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('scroll', onScroll);
    };
  }, [showClientPickerMobile]);

  // 모바일 품목 드롭다운: 네이티브 터치 이벤트 (passive: false)
  useEffect(() => {
    const el = itemMobileDropdownRef.current;
    if (!el) return;
    let startX = 0, startY = 0, scrolled = false;

    const onTouchStart = (e: globalThis.TouchEvent) => {
      e.stopPropagation();
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      scrolled = false;
    };
    const onTouchMove = (e: globalThis.TouchEvent) => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        scrolled = true;
      }
    };
    const onTouchEnd = (e: globalThis.TouchEvent) => {
      if (scrolled) return;
      e.preventDefault();
      const target = (e.target as HTMLElement).closest('[data-item-name]') as HTMLElement | null;
      if (target?.dataset.itemName) {
        const name = target.dataset.itemName;
        const price = parseInt(target.dataset.itemPrice || '0', 10);
        setMemoValue(name);
        onUpdateRef.current({
          memo: name,
          amount: price || schedule?.amount || 0,
        });
        setShowItemPickerMobile(false);
      }
    };
    const onScroll = () => { scrolled = true; };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('scroll', onScroll);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('scroll', onScroll);
    };
  }, [showItemPickerMobile, schedule?.amount]);

  const isDone = schedule?.is_done || false;
  const isReserved = schedule?.is_reserved || false;
  const isPaid = schedule?.is_paid || false;
  const eventIcon = schedule?.event_icon || null;
  const [showEventPicker, setShowEventPicker] = useState(false);
  const eventPickerRef = useRef<HTMLDivElement>(null);
  const eventPickerMobileRef = useRef<HTMLDivElement>(null);
  const hasTitle = (schedule?.title || '').trim() !== '';
  const isPending = hasTitle && !isDone;

  // 이벤트 팝업 외부 클릭 닫기
  useEffect(() => {
    if (!showEventPicker) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (eventPickerRef.current && eventPickerRef.current.contains(target)) ||
        (eventPickerMobileRef.current && eventPickerMobileRef.current.contains(target))
      ) {
        return;
      }
      setShowEventPicker(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEventPicker]);

  // 필터된 거래처 목록
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.address || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

  // 필터된 품목 목록
  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  // 결제방법에 따른 스타일
  const paymentStyles: Record<string, string> = {
    cash: 'bg-green-50 border-green-400 text-green-700',
    card: 'bg-blue-50 border-blue-400 text-blue-700',
    vat: 'bg-orange-50 border-orange-400 text-orange-700',
    free: 'bg-purple-50 border-purple-400 text-purple-700',
    '': 'bg-white border-gray-200',
  };

  // 완료 팝업 상태
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  // 입금 팝업 상태
  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<PaymentMethod>('cash');
  const [depositMemo, setDepositMemo] = useState<string>('');

  const openDepositPopup = () => {
    const pm = schedule?.payment_method || 'cash';
    setDepositPaymentMethod(pm);
    setDepositAmount(pm === 'free' ? 0 : (schedule?.amount || 0));
    setDepositMemo('');
    setShowDepositPopup(true);
  };

  // 완료 기록 조회/저장/삭제
  const saveCompletionRecord = useSaveCompletionRecord();
  const deleteCompletionRecords = useDeleteCompletionRecords();
  const { data: completionRecords } = useCompletionRecords(schedule?.id);
  const existingRecord = completionRecords?.[0] || null;

  // 완료 팝업 확인 핸들러
  const handleCompletionConfirm = async (data: {
    apartment_name: string;
    unit_number: string;
    customer_name: string;
    phone: string;
    content: string;
    amount: number;
    signature_data: string;
  }) => {
    // 완료 확인서 데이터 DB 저장
    if (schedule) {
      try {
        await saveCompletionRecord.mutateAsync({
          schedule_id: schedule.id,
          apartment_name: data.apartment_name,
          unit_number: data.unit_number,
          customer_name: data.customer_name,
          phone: data.phone,
          content: data.content,
          amount: data.amount,
          signature_data: data.signature_data,
          record_type: 'completion',
        });
      } catch (e) {
        console.error('완료 기록 저장 실패:', e);
      }
    }
    // 완료 처리: 완료 체크, 예약 해제
    onUpdate({
      is_done: true,
      is_reserved: false,
    });
    setShowCompletionPopup(false);
  };

  // 입금 팝업 확인 핸들러
  const handleDepositConfirm = (data: {
    amount: number;
    payment_method: PaymentMethod;
    deposit_memo: string;
  }) => {
    // 입금 처리: 입금 체크, 완료 처리
    onUpdate({
      is_paid: true,
      is_done: true,
      amount: data.amount,
      payment_method: data.payment_method,
      memo: data.deposit_memo,
    });
    setShowDepositPopup(false);
  };

  return (
    <>
      {/* 데스크탑 레이아웃 */}
      <div
        data-timeslot={timeSlot}
        className={cn(
          'hidden lg:grid grid-cols-[28px_80px_1fr_100px_1fr_100px_120px_100px_40px_60px_70px_60px] gap-2 px-3 py-2 border-b border-l-4 items-center transition-colors',
          isPending && 'bg-red-50 border-l-red-500',
          isDone && 'bg-green-50 border-l-green-500',
          !isPending && !isDone && 'border-l-transparent hover:bg-gray-50',
          isDragging && 'opacity-40 bg-blue-100',
          isDragOver && 'border-t-2 border-t-primary bg-blue-50',
          isMobileDragging && 'opacity-40 bg-blue-100',
          isMobileDragOver && 'border-t-2 border-t-blue-500 bg-blue-50',
          isSelected && 'ring-2 ring-blue-500 ring-inset'
        )}
        onClick={() => onSelect?.()}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart?.();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOver?.();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
        }}
        onDragEnd={() => {
          onDragEnd?.();
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop?.();
        }}
      >
        {/* 드래그 핸들 */}
        <div
          ref={pcGripRef}
          data-grip
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary transition-colors flex justify-center"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* 시간 */}
        <div className="flex items-center gap-1">
          <span className={cn(
            'font-bold text-sm',
            isPending && 'text-red-500',
            isDone && 'text-green-600',
            !isPending && !isDone && 'text-primary'
          )}>
            {timeSlot}
          </span>
          <button
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            onClick={() => {
              // 로컬 상태도 초기화
              setTitleValue('');
              setMemoValue('');
              setUnitValue('');
              setScheduleTypeValue('');
              setPaymentMethodValue('');
              // 완료 기록 삭제
              if (schedule?.id) {
                deleteCompletionRecords.mutate(schedule.id);
              }
              onUpdate({
                title: '',
                unit: '',
                memo: '',
                amount: 0,
                schedule_type: null,
                payment_method: null,
                is_done: false,
                is_reserved: false,
                is_paid: false,
                event_icon: null,
              });
            }}
            title="초기화"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>

        {/* 거래처명 */}
        <div className="relative">
          <input
            ref={clientInputRef}
            type="text"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="이름 🔍"
            value={titleValue}
            onChange={(e) => {
              setTitleValue(e.target.value);
              // 항상 검색 업데이트 (한글 조합 중에도 실시간 검색)
              setClientSearch(e.target.value);
            }}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              setClientSearch((e.target as HTMLInputElement).value);
            }}
            onFocus={() => {
              setShowClientPicker(true);
              setClientSearch('');
            }}
            onBlur={(e) => {
              setTimeout(() => setShowClientPicker(false), 150);
              if (!blockSaveRef?.current && e.target.value !== schedule?.title) {
                onUpdate({ title: e.target.value });
              }
            }}
          />
          
          {/* 거래처 드롭다운 */}
          {showClientPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
              {filteredClients.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                  {clients.length === 0 ? '등록된 거래처가 없습니다' : '검색 결과가 없습니다'}
                </div>
              ) : (
                filteredClients.map((client) => (
                  <div
                    key={client.id}
                    style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                    onMouseDown={() => {
                      setTitleValue(client.name);
                      onUpdate({ title: client.name });
                      setShowClientPicker(false);
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                  >
                    <span>🏢</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.address} {client.bunji}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 동호수 */}
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder="동호수"
          value={unitValue}
          onChange={(e) => setUnitValue(e.target.value)}
          onBlur={(e) => { if (!blockSaveRef?.current) onUpdate({ unit: e.target.value }); }}
        />

        {/* 내용 (품목 선택) */}
        <div className="relative">
          <input
            ref={itemInputRef}
            type="text"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="내용 🔍"
            value={memoValue}
            onChange={(e) => {
              setMemoValue(e.target.value);
              // 항상 검색 업데이트 (한글 조합 중에도 실시간 검색)
              setItemSearch(e.target.value);
            }}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              setItemSearch((e.target as HTMLInputElement).value);
            }}
            onFocus={() => {
              setShowItemPicker(true);
              setItemSearch('');
            }}
            onBlur={(e) => {
              setTimeout(() => setShowItemPicker(false), 150);
              if (!blockSaveRef?.current && e.target.value !== schedule?.memo) {
                onUpdate({ memo: e.target.value });
              }
            }}
          />
          
          {/* 품목 드롭다운 */}
          {showItemPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
              {filteredItems.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                  {items.length === 0 ? '등록된 품목이 없습니다' : '검색 결과가 없습니다'}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                    onMouseDown={() => {
                      setMemoValue(item.name);
                      onUpdate({ 
                        memo: item.name,
                        amount: item.price || schedule?.amount || 0,
                      });
                      setShowItemPicker(false);
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span>📦</span>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#16a34a', marginLeft: 8, flexShrink: 0 }}>
                      {item.price ? `${item.price.toLocaleString()}원` : '금액 없음'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 유형 */}
        <select
          className="w-full px-2 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          value={scheduleTypeValue}
          onChange={(e) => {
            setScheduleTypeValue(e.target.value);
            onUpdate({ schedule_type: e.target.value as ScheduleType });
          }}
        >
          {SCHEDULE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>

        {/* 금액 */}
        <div className="relative">
          <input
            type="text"
            className="w-full px-3 py-2 pr-8 border rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="0"
            value={schedule?.amount ? ((paymentMethodValue === 'vat' || paymentMethodValue === 'card') ? Math.round(schedule.amount * 1.1).toLocaleString() : schedule.amount.toLocaleString()) : ''}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              const parsed = value ? parseInt(value, 10) : 0;
              const stored = (paymentMethodValue === 'vat' || paymentMethodValue === 'card') ? Math.round(parsed / 1.1) : parsed;
              onUpdate({ amount: stored });
            }}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
        </div>

        {/* 결제방법 */}
        <select
          className={cn(
            'w-full px-2 py-2 border rounded-md text-sm font-medium focus:outline-none cursor-pointer',
            paymentStyles[paymentMethodValue]
          )}
          value={paymentMethodValue}
          onChange={(e) => {
            const v = e.target.value;
            setPaymentMethodValue(v);
            if (v === 'free') {
              onUpdate({ payment_method: v as PaymentMethod, amount: 0 });
            } else {
              onUpdate({ payment_method: v as PaymentMethod });
            }
          }}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>{method.label}</option>
          ))}
        </select>

        {/* 이벤트 아이콘 */}
        <div className="relative flex justify-center" ref={eventPickerRef}>
          <button
            className={cn(
              'w-8 h-8 rounded-md border text-base flex items-center justify-center transition-colors',
              eventIcon === 'install' ? 'border-red-300 bg-red-50' :
              eventIcon ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50 text-gray-400'
            )}
            onClick={() => setShowEventPicker(!showEventPicker)}
            onMouseDown={(e) => e.stopPropagation()}
            title="이벤트"
          >
            {eventIcon ? EVENT_ICONS.find(e => e.value === eventIcon)?.emoji : '🏷️'}
          </button>
          {showEventPicker && (
            <div className="absolute top-full mt-1 right-0 bg-white border rounded-lg shadow-lg z-50 p-1 flex gap-1">
              {EVENT_ICONS.map((ev) => (
                <button
                  key={ev.value}
                  className={cn(
                    'w-9 h-9 rounded-md flex flex-col items-center justify-center text-xs transition-colors',
                    eventIcon === ev.value
                      ? ev.value === 'install' ? 'bg-red-100 border border-red-400' : 'bg-indigo-100 border border-indigo-400'
                      : 'hover:bg-gray-100'
                  )}
                  onClick={() => {
                    onUpdate({ event_icon: eventIcon === ev.value ? null : ev.value });
                    setShowEventPicker(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={ev.label}
                >
                  <span className="text-base leading-none">{ev.emoji}</span>
                </button>
              ))}
              {eventIcon && (
                <button
                  className="w-9 h-9 rounded-md flex items-center justify-center text-xs hover:bg-red-50 text-red-400"
                  onClick={() => {
                    onUpdate({ event_icon: null });
                    setShowEventPicker(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="제거"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* 예약 버튼 */}
        <Button
          variant={isReserved ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'text-xs font-bold',
            isReserved && 'bg-blue-600 hover:bg-blue-700'
          )}
          onClick={onToggleReserved}
        >
          {isReserved ? '📋' : ''} 예약
        </Button>

        {/* 완료 버튼 */}
        <Button
          variant={isDone ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'text-xs font-bold',
            isDone ? 'bg-green-600 hover:bg-green-700' : 'border-yellow-400 text-yellow-600 hover:bg-yellow-50'
          )}
          onClick={() => setShowCompletionPopup(true)}
        >
          {isDone ? '✅' : ''} 완료
        </Button>

        {/* 입금 버튼 */}
        <Button
          variant={isPaid ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'text-xs font-bold',
            isPaid ? 'bg-amber-500 hover:bg-amber-600' : 'border-amber-400 text-amber-600 hover:bg-amber-50'
          )}
          onClick={() => openDepositPopup()}
        >
          {isPaid ? '💰' : '입금'}
        </Button>
      </div>

      {/* 모바일 카드 레이아웃 */}
      <div
        data-timeslot={timeSlot}
        className={cn(
          'lg:hidden p-3 border-b border-l-4 transition-colors',
          isPending && 'bg-red-50 border-l-red-500',
          isDone && 'bg-green-50 border-l-green-500',
          !isPending && !isDone && 'border-l-transparent hover:bg-gray-50',
          isMobileDragging && 'opacity-40 bg-blue-100',
          isMobileDragOver && 'border-t-2 border-t-blue-500 bg-blue-50',
          isSelected && 'ring-2 ring-blue-500 ring-inset'
        )}
        onTouchStart={(e) => {
          // 인터랙티브 요소에서는 롱프레스 시작 안함
          const target = e.target as HTMLElement;
          if (target.closest('input, select, textarea, button, [data-grip]')) return;
          const touch = e.touches[0];
          longPressTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
          longPressTimerRef.current = setTimeout(() => {
            setMenuPosition({ x: touch.clientX, y: touch.clientY });
            setShowCopyMenu(true);
            if (navigator.vibrate) navigator.vibrate(30);
          }, 500);
        }}
        onTouchMove={(e) => {
          if (!longPressTouchStartRef.current) return;
          const touch = e.touches[0];
          const dx = Math.abs(touch.clientX - longPressTouchStartRef.current.x);
          const dy = Math.abs(touch.clientY - longPressTouchStartRef.current.y);
          if (dx > 10 || dy > 10) {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }
        }}
        onTouchEnd={() => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          longPressTouchStartRef.current = null;
        }}
      >
        {/* 헤더: 시간 + 버튼들 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* 모바일 드래그 핸들 */}
            <div
              ref={mobileGripRef}
              data-grip
              style={{
                padding: '8px 4px',
                cursor: 'grab',
                touchAction: 'none',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <GripVertical style={{ width: '20px', height: '20px' }} />
            </div>
            <span className={cn(
              'font-bold text-lg',
              isPending && 'text-red-500',
              isDone && 'text-green-600',
              !isPending && !isDone && 'text-primary'
            )}>
              {timeSlot}
            </span>
            <button
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              onClick={() => {
                // 로컬 상태도 초기화
                setTitleValue('');
                setMemoValue('');
                setUnitValue('');
                setScheduleTypeValue('');
                setPaymentMethodValue('');
                // 완료 기록 삭제
                if (schedule?.id) {
                  deleteCompletionRecords.mutate(schedule.id);
                }
                onUpdate({
                  title: '',
                  unit: '',
                  memo: '',
                  amount: 0,
                  schedule_type: null,
                  payment_method: null,
                  is_done: false,
                  is_reserved: false,
                  is_paid: false,
                  event_icon: null,
                });
              }}
              title="초기화"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            {/* 이벤트 아이콘 - 모바일 */}
            <div className="relative" ref={eventPickerMobileRef}>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'text-xs h-8 px-2',
                  eventIcon === 'install' ? 'border-red-300 bg-red-50' :
                  eventIcon && 'border-indigo-300 bg-indigo-50'
                )}
                onClick={() => setShowEventPicker(!showEventPicker)}
              >
                {eventIcon ? EVENT_ICONS.find(e => e.value === eventIcon)?.emoji : '🏷️'}
              </Button>
              {showEventPicker && (
                <div className="absolute top-full mt-1 right-0 bg-white border rounded-lg shadow-lg z-50 p-1 flex gap-1">
                  {EVENT_ICONS.map((ev) => (
                    <button
                      key={ev.value}
                      className={cn(
                        'w-10 h-10 rounded-md flex flex-col items-center justify-center text-xs transition-colors',
                        eventIcon === ev.value
                          ? ev.value === 'install' ? 'bg-red-100 border border-red-400' : 'bg-indigo-100 border border-indigo-400'
                          : 'hover:bg-gray-100'
                      )}
                      onClick={() => {
                        onUpdate({ event_icon: eventIcon === ev.value ? null : ev.value });
                        setShowEventPicker(false);
                      }}
                    >
                      <span className="text-lg leading-none">{ev.emoji}</span>
                      <span className="text-[10px] mt-0.5">{ev.label}</span>
                    </button>
                  ))}
                  {eventIcon && (
                    <button
                      className="w-10 h-10 rounded-md flex items-center justify-center text-xs hover:bg-red-50 text-red-400"
                      onClick={() => {
                        onUpdate({ event_icon: null });
                        setShowEventPicker(false);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>
            <Button
              variant={isReserved ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'text-xs h-8 px-2',
                isReserved && 'bg-blue-600 hover:bg-blue-700'
              )}
              onClick={onToggleReserved}
            >
              {isReserved ? '📋' : ''} 예약
            </Button>
            <Button
              variant={isDone ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'text-xs h-8 px-2',
                isDone ? 'bg-green-600 hover:bg-green-700' : 'border-yellow-400 text-yellow-600 hover:bg-yellow-50'
              )}
              onClick={() => setShowCompletionPopup(true)}
            >
              {isDone ? '✅' : ''} 완료
            </Button>
            <Button
              variant={isPaid ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'text-xs h-8 px-2',
                isPaid ? 'bg-amber-500 hover:bg-amber-600' : 'border-amber-400 text-amber-600'
              )}
              onClick={() => openDepositPopup()}
            >
              {isPaid ? '💰' : '입금'}
            </Button>
          </div>
        </div>

        {/* 입력 필드들 */}
        <div className="space-y-2">
          {/* 거래처 + 동호수 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="이름 🔍"
                value={titleValue}
                onChange={(e) => {
                  setTitleValue(e.target.value);
                  // 항상 검색 업데이트 (한글 조합 중에도 실시간 검색)
                  setClientSearch(e.target.value);
                }}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={(e) => {
                  isComposingRef.current = false;
                  setClientSearch((e.target as HTMLInputElement).value);
                }}
                onFocus={() => {
                  setShowClientPickerMobile(true);
                  setClientSearch('');
                }}
                onBlur={(e) => {
                  setTimeout(() => setShowClientPickerMobile(false), 150);
                  if (!blockSaveRef?.current && e.target.value !== schedule?.title) {
                    onUpdate({ title: e.target.value });
                  }
                }}
              />
              
              {/* 모바일 거래처 드롭다운 */}
              {showClientPickerMobile && (
                <div
                  ref={clientMobileDropdownRef}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
                >
                  <div>
                    {filteredClients.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                        {clients.length === 0 ? '등록된 거래처가 없습니다' : '검색 결과가 없습니다'}
                      </div>
                    ) : (
                      filteredClients.map((client) => (
                        <div
                          key={client.id}
                          data-client-name={client.name}
                          style={{
                            width: '100%', padding: '8px 12px', textAlign: 'left',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontSize: '14px', borderBottom: '1px solid #f0f0f0',
                            cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
                            background: 'white', touchAction: 'pan-y pinch-zoom',
                          }}
                          onMouseDown={() => {
                            setTitleValue(client.name);
                            onUpdate({ title: client.name });
                            setShowClientPickerMobile(false);
                          }}
                        >
                          <span>🏢</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.address} {client.bunji}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="동호수"
              value={unitValue}
              onChange={(e) => setUnitValue(e.target.value)}
              onBlur={(e) => { if (!blockSaveRef?.current) onUpdate({ unit: e.target.value }); }}
            />
          </div>

          {/* 내용 */}
          <div className="relative">
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="내용 🔍"
              value={memoValue}
              onChange={(e) => {
                setMemoValue(e.target.value);
                // 항상 검색 업데이트 (한글 조합 중에도 실시간 검색)
                setItemSearch(e.target.value);
              }}
              onCompositionStart={() => { isComposingRef.current = true; }}
              onCompositionEnd={(e) => {
                isComposingRef.current = false;
                setItemSearch((e.target as HTMLInputElement).value);
              }}
              onFocus={() => {
                setShowItemPickerMobile(true);
                setItemSearch('');
              }}
              onBlur={(e) => {
                setTimeout(() => setShowItemPickerMobile(false), 150);
                if (!blockSaveRef?.current && e.target.value !== schedule?.memo) {
                  onUpdate({ memo: e.target.value });
                }
              }}
            />
            
            {/* 모바일 품목 드롭다운 */}
            {showItemPickerMobile && (
              <div
                ref={itemMobileDropdownRef}
                style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
              >
                <div>
                  {filteredItems.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                      {items.length === 0 ? '등록된 품목이 없습니다' : '검색 결과가 없습니다'}
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <div
                        key={item.id}
                        data-item-name={item.name}
                        data-item-price={String(item.price || 0)}
                        style={{
                          width: '100%', padding: '8px 12px', textAlign: 'left',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          fontSize: '14px', borderBottom: '1px solid #f0f0f0',
                          cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
                          background: 'white', touchAction: 'pan-y pinch-zoom',
                        }}
                        onMouseDown={() => {
                          setMemoValue(item.name);
                          onUpdate({
                            memo: item.name,
                            amount: item.price || schedule?.amount || 0,
                          });
                          setShowItemPickerMobile(false);
                        }}
                      >
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📦 {item.name}</span>
                        {item.price && (
                          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px', flexShrink: 0 }}>{item.price.toLocaleString()}원</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 유형 + 결제방법 + 금액 */}
          <div className="grid grid-cols-3 gap-2 relative z-10">
            <select
              className="w-full px-2 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white appearance-auto cursor-pointer"
              value={scheduleTypeValue}
              onChange={(e) => {
                setScheduleTypeValue(e.target.value);
                onUpdate({ schedule_type: e.target.value as ScheduleType });
              }}
            >
              {SCHEDULE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <select
              className={cn(
                'w-full px-2 py-2 border rounded-md text-sm font-medium appearance-auto cursor-pointer',
                paymentStyles[paymentMethodValue]
              )}
              value={paymentMethodValue}
              onChange={(e) => {
                const v = e.target.value;
                setPaymentMethodValue(v);
                if (v === 'free') {
                  onUpdate({ payment_method: v as PaymentMethod, amount: 0 });
                } else {
                  onUpdate({ payment_method: v as PaymentMethod });
                }
              }}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
            <div className="relative">
              <input
                type="text"
                className="w-full px-2 py-2 pr-6 border rounded-md text-sm text-right"
                placeholder="0"
                value={schedule?.amount ? ((paymentMethodValue === 'vat' || paymentMethodValue === 'card') ? Math.round(schedule.amount * 1.1).toLocaleString() : schedule.amount.toLocaleString()) : ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  const parsed = value ? parseInt(value, 10) : 0;
                  const stored = (paymentMethodValue === 'vat' || paymentMethodValue === 'card') ? Math.round(parsed / 1.1) : parsed;
                  onUpdate({ amount: stored });
                }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 복사/붙여넣기 팝업 메뉴 */}
      {showCopyMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.15)' }}
            onClick={() => setShowCopyMenu(false)}
            onTouchEnd={(e) => { e.preventDefault(); setShowCopyMenu(false); }}
          />
          <div style={{
            position: 'fixed',
            left: Math.min(menuPosition.x, window.innerWidth - 180),
            top: menuPosition.y - 10,
            transform: 'translateY(-100%)',
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            zIndex: 99999,
            overflow: 'hidden',
            minWidth: 160,
          }}>
            {schedule?.title && (
              <button
                style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, border: 'none', background: 'white', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                onClick={() => { onCopySchedule?.(); setShowCopyMenu(false); }}
              >📋 복사하기</button>
            )}
            {copiedScheduleExists && (
              <button
                style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, border: 'none', background: 'white', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                onClick={() => { onPasteSchedule?.(); setShowCopyMenu(false); }}
              >📌 붙여넣기</button>
            )}
            <button
              style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, border: 'none', background: 'white', cursor: 'pointer' }}
              onClick={() => setShowCopyMenu(false)}
            >❌ 취소</button>
          </div>
        </>
      )}
      {/* 완료 팝업 */}
      {schedule && showCompletionPopup && (
        <CompletionPopup
          schedule={schedule}
          open={showCompletionPopup}
          onClose={() => setShowCompletionPopup(false)}
          onConfirm={handleCompletionConfirm}
          existingRecord={existingRecord}
        />
      )}
      {/* 입금 팝업 */}
      {schedule && showDepositPopup && (
        <DepositPopup
          open={showDepositPopup}
          onClose={() => setShowDepositPopup(false)}
          onConfirm={handleDepositConfirm}
          amount={depositAmount}
          setAmount={setDepositAmount}
          paymentMethod={depositPaymentMethod}
          setPaymentMethod={setDepositPaymentMethod}
          memo={depositMemo}
          setMemo={setDepositMemo}
        />
      )}
    </>
  );
}
