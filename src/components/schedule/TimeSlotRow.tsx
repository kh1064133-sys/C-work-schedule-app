'use client';

import { useState, useRef, useEffect } from 'react';
import { GripVertical, Check, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrencyInput } from '@/lib/utils/format';
import type { Schedule, ScheduleType, PaymentMethod, Client, Item } from '@/types';

interface TimeSlotRowProps {
  timeSlot: string;
  schedule: Schedule | null;
  clients?: Client[];
  items?: Item[];
  onUpdate: (data: Partial<Schedule>) => void;
  onToggleDone: () => void;
  onToggleReserved: () => void;
  // 드래그 관련
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}

const SCHEDULE_TYPES = [
  { value: '', label: '유형 선택' },
  { value: 'sale', label: '판매' },
  { value: 'as', label: 'AS' },
  { value: 'agency', label: '대리점' },
  { value: 'group', label: '공동구매' },
];

const PAYMENT_METHODS = [
  { value: '', label: '결제방법' },
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'vat', label: 'VAT' },
];

export function TimeSlotRow({
  timeSlot,
  schedule,
  clients = [],
  items = [],
  onUpdate,
  onToggleDone,
  onToggleReserved,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: TimeSlotRowProps) {
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  
  const clientInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  const isDone = schedule?.is_done || false;
  const isReserved = schedule?.is_reserved || false;
  const hasTitle = (schedule?.title || '').trim() !== '';
  const isPending = hasTitle && !isDone;

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
    '': 'bg-white border-gray-200',
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[28px_80px_1fr_100px_1fr_100px_120px_100px_60px_70px] gap-2 px-3 py-2 border-b border-l-4 items-center transition-colors',
        isPending && 'bg-red-50 border-l-red-500',
        isDone && 'bg-green-50 border-l-green-500',
        !isPending && !isDone && 'border-l-transparent hover:bg-gray-50',
        isDragging && 'opacity-40 bg-blue-100',
        isDragOver && 'border-t-2 border-t-primary bg-blue-50'
      )}
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
      <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary transition-colors flex justify-center">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* 시간 */}
      <div className={cn(
        'font-bold text-sm',
        isPending && 'text-red-500',
        isDone && 'text-green-600',
        !isPending && !isDone && 'text-primary'
      )}>
        {timeSlot}
      </div>

      {/* 거래처명 */}
      <div className="relative">
        <input
          ref={clientInputRef}
          type="text"
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder="이름 🔍"
          value={schedule?.title || ''}
          onChange={(e) => {
            onUpdate({ title: e.target.value });
            setClientSearch(e.target.value);
          }}
          onFocus={() => {
            setShowClientPicker(true);
            setClientSearch(schedule?.title || '');
          }}
          onBlur={() => setTimeout(() => setShowClientPicker(false), 150)}
        />
        
        {/* 거래처 드롭다운 */}
        {showClientPicker && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2 border-b">
              <input
                type="text"
                className="w-full px-2 py-1 text-sm border rounded"
                placeholder="거래처 검색..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>
            <div>
              {filteredClients.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  등록된 거래처가 없습니다
                </div>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
                    onMouseDown={() => {
                      onUpdate({ title: client.name });
                      setShowClientPicker(false);
                    }}
                  >
                    <span>🏢</span>
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-xs text-gray-500">{client.address} {client.bunji}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 동호수 */}
      <input
        type="text"
        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        placeholder="동호수"
        value={schedule?.unit || ''}
        onChange={(e) => onUpdate({ unit: e.target.value })}
      />

      {/* 내용 (품목 선택) */}
      <div className="relative">
        <input
          ref={itemInputRef}
          type="text"
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder="내용 🔍"
          value={schedule?.memo || ''}
          onChange={(e) => {
            onUpdate({ memo: e.target.value });
            setItemSearch(e.target.value);
          }}
          onFocus={() => {
            setShowItemPicker(true);
            setItemSearch(schedule?.memo || '');
          }}
          onBlur={() => setTimeout(() => setShowItemPicker(false), 150)}
        />
        
        {/* 품목 드롭다운 */}
        {showItemPicker && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2 border-b">
              <input
                type="text"
                className="w-full px-2 py-1 text-sm border rounded"
                placeholder="품목 검색..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
              />
            </div>
            <div>
              {filteredItems.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  등록된 품목이 없습니다
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    className="w-full px-3 py-2 text-left hover:bg-green-50 flex items-center gap-2 text-sm"
                    onMouseDown={() => {
                      onUpdate({ 
                        memo: item.name,
                        amount: item.price || schedule?.amount || 0,
                      });
                      setShowItemPicker(false);
                    }}
                  >
                    <span>📦</span>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-green-600">
                        {item.price ? `${item.price.toLocaleString()}원` : '금액 없음'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 유형 */}
      <select
        className="w-full px-2 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
        value={schedule?.schedule_type || ''}
        onChange={(e) => onUpdate({ schedule_type: e.target.value as ScheduleType })}
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
          value={schedule?.amount ? schedule.amount.toLocaleString() : ''}
          onChange={(e) => {
            const value = e.target.value.replace(/[^0-9]/g, '');
            onUpdate({ amount: value ? parseInt(value, 10) : 0 });
          }}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
      </div>

      {/* 결제방법 */}
      <select
        className={cn(
          'w-full px-2 py-2 border rounded-md text-sm font-medium focus:outline-none cursor-pointer',
          paymentStyles[schedule?.payment_method || '']
        )}
        value={schedule?.payment_method || ''}
        onChange={(e) => onUpdate({ payment_method: e.target.value as PaymentMethod })}
      >
        {PAYMENT_METHODS.map((method) => (
          <option key={method.value} value={method.value}>{method.label}</option>
        ))}
      </select>

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
        onClick={onToggleDone}
      >
        {isDone ? '✅' : ''} 완료
      </Button>
    </div>
  );
}
