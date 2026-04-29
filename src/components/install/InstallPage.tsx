'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Settings, ChevronDown, ChevronUp, MessageSquare, X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallSchedules, useUpsertSchedule } from '@/hooks/useSchedules';
import { useClients } from '@/hooks/useClients';
import { useItems } from '@/hooks/useItems';
import { cn } from '@/lib/utils';
import { useDateStore } from '@/stores/dateStore';
import { useUIStore } from '@/stores/uiStore';
import type { Schedule, ScheduleType, PaymentMethod } from '@/types';

const SCHEDULE_TYPES = [
  { value: '', label: '유형' },
  { value: 'sale', label: '판매' },
  { value: 'as', label: 'AS' },
  { value: 'agency', label: '대리점' },
  { value: 'group', label: '공동구매' },
  { value: 'install', label: '외주설치' },
  { value: 'daily', label: '일당' },
];

// 유형별 기본 금액 키
const TYPE_PRICE_KEY = 'install_type_prices';

type TypePrices = Record<string, number>;

function loadTypePrices(): TypePrices {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(TYPE_PRICE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Number(value)])
        .filter(([, value]) => Number.isFinite(value))
    );
  } catch { return {}; }
}

function saveTypePrices(prices: TypePrices) {
  try {
    localStorage.setItem(TYPE_PRICE_KEY, JSON.stringify(prices));
  } catch {}
}

const PAYMENT_METHODS = [
  { value: '', label: '결제' },
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'vat', label: 'VAT' },
  { value: 'free', label: '무상' },
];

const paymentStyles: Record<string, string> = {
  cash: 'bg-green-50 border-green-400 text-green-700',
  card: 'bg-blue-50 border-blue-400 text-blue-700',
  vat: 'bg-orange-50 border-orange-400 text-orange-700',
  free: 'bg-purple-50 border-purple-400 text-purple-700',
  '': 'bg-white border-gray-200',
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

// --- 개별 행 컴포넌트 (인라인 편집) ---
function InstallRow({ schedule, clients, items, onSave, typePrices, isSelected, onToggleSelect, installPaid, onToggleInstallPaid, onNavigateToDate }: {
  schedule: Schedule;
  clients: { id: string; name: string; address: string | null; bunji: string | null }[];
  items: { id: string; name: string; price: number | null }[];
  onSave: (id: string, data: Partial<Schedule>) => void;
  typePrices: TypePrices;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  installPaid?: boolean;
  onToggleInstallPaid?: (id: string) => void;
  onNavigateToDate?: (dateStr: string) => void;
}) {
  const [titleValue, setTitleValue] = useState(schedule.title || '');
  const [unitValue, setUnitValue] = useState(schedule.unit || '');
  const [memoValue, setMemoValue] = useState(schedule.memo || '');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  // schedule 변경 시 로컬 동기화
  const prevId = useState(schedule.id)[0];
  if (prevId !== schedule.id) {
    // 리렌더 시 동기화 (key로 해결하지만 안전장치)
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.address || '').toLowerCase().includes(clientSearch.toLowerCase())
  );
  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const isPending = !!(schedule.title && schedule.title.trim() !== '' && !schedule.is_done);
  const paymentMethod = schedule.payment_method || '';

  return (
    <>
      {/* PC 행 */}
      <div
        onDoubleClick={() => onNavigateToDate?.(schedule.date)}
        className={cn(
          'hidden lg:grid grid-cols-[60px_30px_50px_1fr_80px_1fr_80px_100px_80px_60px_60px_60px] gap-1.5 px-2 py-1.5 border-b border-l-4 items-center transition-colors text-sm cursor-pointer',
          isPending && 'bg-red-50 border-l-red-500',
          schedule.is_done && 'bg-green-50 border-l-green-500',
          !isPending && !schedule.is_done && 'border-l-transparent hover:bg-gray-50',
        )}
      >
        {/* 날짜 */}
        <span className="text-xs font-medium text-gray-600">{formatDateShort(schedule.date)}</span>
        {/* 요일 */}
        <span className="text-xs text-gray-500">{getDayOfWeek(schedule.date)}</span>
        {/* 시간 */}
        <span className={cn(
          'font-bold text-xs',
          isPending && 'text-red-500',
          schedule.is_done && 'text-green-600',
          !isPending && !schedule.is_done && 'text-primary'
        )}>{schedule.time_slot}</span>

        {/* 거래처 */}
        <div className="relative">
          <input
            type="text"
            className="w-full px-2 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="이름 🔍"
            value={titleValue}
            onChange={(e) => { setTitleValue(e.target.value); setClientSearch(e.target.value); }}
            onFocus={() => { setShowClientPicker(true); setClientSearch(''); }}
            onBlur={(e) => {
              setTimeout(() => setShowClientPicker(false), 150);
              if (e.target.value !== schedule.title) onSave(schedule.id, { title: e.target.value });
            }}
          />
          {showClientPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
              {filteredClients.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  {clients.length === 0 ? '등록된 거래처 없음' : '검색 결과 없음'}
                </div>
              ) : filteredClients.map(c => (
                <div key={c.id} style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                  onMouseDown={() => { setTitleValue(c.name); onSave(schedule.id, { title: c.name }); setShowClientPicker(false); }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <span>🏢</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address} {c.bunji}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 동호수 */}
        <input type="text" className="w-full px-2 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder="동호수" value={unitValue}
          onChange={(e) => setUnitValue(e.target.value)}
          onBlur={(e) => { if (e.target.value !== schedule.unit) onSave(schedule.id, { unit: e.target.value }); }}
        />

        {/* 내용 */}
        <div className="relative">
          <input type="text" className="w-full px-2 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="내용 🔍" value={memoValue}
            onChange={(e) => { setMemoValue(e.target.value); setItemSearch(e.target.value); }}
            onFocus={() => { setShowItemPicker(true); setItemSearch(''); }}
            onBlur={(e) => {
              setTimeout(() => setShowItemPicker(false), 150);
              if (e.target.value !== schedule.memo) onSave(schedule.id, { memo: e.target.value });
            }}
          />
          {showItemPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
              {filteredItems.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  {items.length === 0 ? '등록된 품목 없음' : '검색 결과 없음'}
                </div>
              ) : filteredItems.map(item => (
                <div key={item.id} style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                  onMouseDown={() => { setMemoValue(item.name); onSave(schedule.id, { memo: item.name, amount: item.price || schedule.amount || 0 }); setShowItemPicker(false); }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <span style={{ fontWeight: 500 }}>📦 {item.name}</span>
                  <span style={{ fontSize: 10, color: '#16a34a', marginLeft: 6 }}>{item.price ? `${item.price.toLocaleString()}원` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 유형 */}
        <select className="w-full px-1 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          value={schedule.install_type || ''}
          onChange={(e) => {
            const type = e.target.value as ScheduleType;
            const preset = type && typePrices[type] ? typePrices[type] : undefined;
            onSave(schedule.id, {
              install_type: type || null,
              ...(preset !== undefined ? { install_amount: preset } : {}),
            });
          }}
        >
          {SCHEDULE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* 금액 */}
        <div className="relative">
          <input type="text" className="w-full px-2 py-1.5 pr-6 border rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="0"
            value={schedule.install_amount ? schedule.install_amount.toLocaleString() : ''}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '');
              const parsed = v ? parseInt(v, 10) : 0;
              onSave(schedule.id, { install_amount: parsed });
            }}
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
        </div>

        {/* 결제 */}
        <select className={cn('w-full px-1 py-1.5 border rounded-md text-xs font-medium focus:outline-none cursor-pointer', paymentStyles[paymentMethod])}
          value={paymentMethod}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'free') onSave(schedule.id, { payment_method: v as PaymentMethod, amount: 0 });
            else onSave(schedule.id, { payment_method: v as PaymentMethod });
          }}
        >
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        {/* 예약 */}
        <Button variant={schedule.is_reserved ? 'default' : 'outline'} size="sm"
          className={cn('text-[10px] h-7 px-1.5 font-bold', schedule.is_reserved && 'bg-blue-600 hover:bg-blue-700')}
          onClick={() => onSave(schedule.id, { is_reserved: !schedule.is_reserved })}
        >
          {schedule.is_reserved ? '📋' : ''} 예약
        </Button>

        {/* 완료 */}
        <Button variant={schedule.is_done ? 'default' : 'outline'} size="sm"
          className={cn('text-[10px] h-7 px-1.5 font-bold',
            schedule.is_done ? 'bg-green-600 hover:bg-green-700' : 'border-yellow-400 text-yellow-600 hover:bg-yellow-50'
          )}
          onClick={() => onSave(schedule.id, { is_done: !schedule.is_done, ...(schedule.is_done ? {} : { is_reserved: false }) })}
        >
          {schedule.is_done ? '✅' : ''} 완료
        </Button>

        {/* 결재 */}
        <Button variant={installPaid ? 'default' : 'outline'} size="sm"
          className={cn('text-[10px] h-7 px-1.5 font-bold',
            installPaid ? 'bg-amber-500 hover:bg-amber-600' : 'border-amber-400 text-amber-600 hover:bg-amber-50'
          )}
          onClick={() => onToggleInstallPaid?.(schedule.id)}
        >
          {installPaid ? '✔결재' : '결재'}
        </Button>
      </div>

      {/* 모바일 카드 */}
      <div
        onDoubleClick={() => onNavigateToDate?.(schedule.date)}
        className={cn(
        'lg:hidden p-3 border-b border-l-4 transition-colors cursor-pointer',
        isPending && 'bg-red-50 border-l-red-500',
        schedule.is_done && 'bg-green-50 border-l-green-500',
        !isPending && !schedule.is_done && 'border-l-transparent hover:bg-gray-50',
        isSelected && 'ring-2 ring-blue-400 bg-blue-50/50',
      )}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              checked={!!isSelected}
              onChange={() => onToggleSelect?.(schedule.id)}
            />
            <span className={cn('font-bold text-sm',
              isPending && 'text-red-500',
              schedule.is_done && 'text-green-600',
              !isPending && !schedule.is_done && 'text-primary'
            )}>
              {formatDateShort(schedule.date)}({getDayOfWeek(schedule.date)}) {schedule.time_slot}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button variant={schedule.is_reserved ? 'default' : 'outline'} size="sm"
              className={cn('text-xs h-7 px-2', schedule.is_reserved && 'bg-blue-600 hover:bg-blue-700')}
              onClick={() => onSave(schedule.id, { is_reserved: !schedule.is_reserved })}
            >{schedule.is_reserved ? '📋' : '예약'}</Button>
            <Button variant={schedule.is_done ? 'default' : 'outline'} size="sm"
              className={cn('text-xs h-7 px-2', schedule.is_done ? 'bg-green-600 hover:bg-green-700' : 'border-yellow-400 text-yellow-600')}
              onClick={() => onSave(schedule.id, { is_done: !schedule.is_done, ...(schedule.is_done ? {} : { is_reserved: false }) })}
            >{schedule.is_done ? '✅' : '완료'}</Button>
            <Button variant={installPaid ? 'default' : 'outline'} size="sm"
              className={cn('text-xs h-7 px-2', installPaid ? 'bg-amber-500 hover:bg-amber-600' : 'border-amber-400 text-amber-600')}
              onClick={() => onToggleInstallPaid?.(schedule.id)}
            >{installPaid ? '✔결재' : '결재'}</Button>
          </div>
        </div>
        {/* 입력 필드 */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="이름 🔍" value={titleValue}
              onChange={(e) => { setTitleValue(e.target.value); }}
              onBlur={(e) => { if (e.target.value !== schedule.title) onSave(schedule.id, { title: e.target.value }); }}
            />
            <input type="text" className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="동호수" value={unitValue}
              onChange={(e) => setUnitValue(e.target.value)}
              onBlur={(e) => { if (e.target.value !== schedule.unit) onSave(schedule.id, { unit: e.target.value }); }}
            />
          </div>
          <input type="text" className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="내용 🔍" value={memoValue}
            onChange={(e) => setMemoValue(e.target.value)}
            onBlur={(e) => { if (e.target.value !== schedule.memo) onSave(schedule.id, { memo: e.target.value }); }}
          />
          <div className="grid grid-cols-3 gap-2">
            <select className="w-full px-2 py-2 border rounded-md text-sm bg-white appearance-auto cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={schedule.install_type || ''}
              onChange={(e) => {
                const type = e.target.value as ScheduleType;
                const preset = type && typePrices[type] ? typePrices[type] : undefined;
                onSave(schedule.id, {
                  install_type: type || null,
                  ...(preset !== undefined ? { install_amount: preset } : {}),
                });
              }}
            >
              {SCHEDULE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select className={cn('w-full px-2 py-2 border rounded-md text-sm font-medium appearance-auto cursor-pointer', paymentStyles[paymentMethod])}
              value={paymentMethod}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'free') onSave(schedule.id, { payment_method: v as PaymentMethod, install_amount: 0 });
                else onSave(schedule.id, { payment_method: v as PaymentMethod });
              }}
            >
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div className="relative">
              <input type="text" className="w-full px-2 py-2 pr-6 border rounded-md text-sm text-right"
                placeholder="0"
                value={schedule.install_amount ? schedule.install_amount.toLocaleString() : ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  const parsed = v ? parseInt(v, 10) : 0;
                  onSave(schedule.id, { install_amount: parsed });
                }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// --- SMS 팝업 ---
function SmsPopup({ schedules, onClose }: { schedules: Schedule[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => {
    const lines = schedules.map(s => {
      const date = formatDateShort(s.date);
      const day = getDayOfWeek(s.date);
      const time = s.time_slot || '';
      const title = s.title || '';
      const unit = s.unit || '';
      const memo = s.memo || '';
      const parts = [`${date}(${day})`, time, title, unit, memo].filter(Boolean);
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
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            문자 발송 ({schedules.length}건)
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        {/* 메시지 미리보기 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-xs text-gray-500 mb-2">메시지 내용 (날짜 / 시간 / 거래처 / 동호수 / 내용)</div>
          <div className="bg-gray-50 border rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed font-mono">
            {message}
          </div>
        </div>
        {/* 버튼 */}
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

// --- 메인 페이지 ---
export function InstallPage() {
  const { data: allInstallSchedules = [], isLoading } = useInstallSchedules();
  const { data: clients = [] } = useClients();
  const { data: items = [] } = useItems();
  const upsertSchedule = useUpsertSchedule();

  // 체크박스 선택 & SMS
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSmsPopup, setShowSmsPopup] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedSchedules = useMemo(() => {
    return allInstallSchedules
      .filter(s => selectedIds.has(s.id))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot));
  }, [allInstallSchedules, selectedIds]);

  // 유형별 기본 금액 설정
  const [typePrices, setTypePrices] = useState<TypePrices>({});
  const [showPriceSettings, setShowPriceSettings] = useState(false);

  // 결재 상태 (localStorage 기반, 일별스케줄 is_paid와 독립)
  const INSTALL_PAID_KEY = 'install_paid_ids';
  const [installPaidIds, setInstallPaidIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(INSTALL_PAID_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : []);
    } catch { return new Set(); }
  });

  const toggleInstallPaid = useCallback((id: string) => {
    setInstallPaidIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try {
        localStorage.setItem(INSTALL_PAID_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    setTypePrices(loadTypePrices());
  }, []);

  const handlePriceChange = (type: string, value: string) => {
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    const next = { ...typePrices, [type]: num };
    setTypePrices(next);
    saveTypePrices(next);
  };

  const installSchedules = useMemo(() => {
    return [...allInstallSchedules].sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot));
  }, [allInstallSchedules]);

  const stats = useMemo(() => {
    const total = installSchedules.length;
    const completed = installSchedules.filter(s => s.is_done).length;
    const reserved = installSchedules.filter(s => s.is_reserved && !s.is_done).length;
    const pending = installSchedules.filter(s => !s.is_done && s.title).length;
    const totalAmount = installSchedules.filter(s => s.is_done).reduce((sum, s) => sum + (s.install_amount || 0), 0);
    const deposited = installSchedules.filter(s => installPaidIds.has(s.id)).length;
    return { total, completed, reserved, pending, totalAmount, deposited };
  }, [installSchedules, installPaidIds]);

  // 월별 그룹핑
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, Schedule[]> = {};
    installSchedules.forEach(s => {
      const key = s.date.substring(0, 7); // "2026-03"
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [installSchedules]);

  const handleSave = useCallback((id: string, data: Partial<Schedule>) => {
    const target = allInstallSchedules.find(sc => sc.id === id);
    if (!target) return;
    const { title, unit, memo, install_type, install_amount, payment_method, is_done, is_reserved, event_icon } = data;
    upsertSchedule.mutate({
      id: target.id,
      date: target.date,
      time_slot: target.time_slot,
      ...(title !== undefined && { title: title || null }),
      ...(unit !== undefined && { unit: unit || null }),
      ...(memo !== undefined && { memo: memo || null }),
      ...(install_type !== undefined && { install_type: install_type || null }),
      ...(install_amount !== undefined && { install_amount }),
      ...(payment_method !== undefined && { payment_method: payment_method || null }),
      ...(is_done !== undefined && { is_done }),
      ...(is_reserved !== undefined && { is_reserved }),
      ...(event_icon !== undefined && { event_icon }),
    });
  }, [allInstallSchedules, upsertSchedule]);

  const handleNavigateToDate = useCallback((dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    useDateStore.getState().setSelectedDate(new Date(y, m - 1, d));
    useUIStore.getState()._forceSetActiveTab('schedule');
  }, []);

  return (
    <div className="space-y-4" style={{ paddingBottom: selectedIds.size > 0 ? 80 : 0 }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">🔨 외주설치 목록</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={showPriceSettings ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => setShowPriceSettings(!showPriceSettings)}
          >
            <Settings className="h-3.5 w-3.5" />
            유형별 금액
            {showPriceSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <span className="text-sm text-gray-500">전체 기간</span>
        </div>
      </div>

      {/* 유형별 기본 금액 설정 */}
      {showPriceSettings && (
        <div className="bg-gray-50 border rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">유형별 기본 금액 (유형 선택 시 자동 적용)</div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {SCHEDULE_TYPES.filter(t => t.value).map(t => (
              <div key={t.value} className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-gray-700 min-w-[52px]">{t.label}</label>
                <div className="relative flex-1">
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 pr-6 border rounded-md text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="0"
                    value={typePrices[t.value] ? typePrices[t.value].toLocaleString() : ''}
                    onChange={(e) => handlePriceChange(t.value, e.target.value)}
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">원</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-xs text-blue-600">전체</div>
          <div className="text-lg font-bold text-blue-700">{stats.total}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2 text-center">
          <div className="text-xs text-yellow-600">예약</div>
          <div className="text-lg font-bold text-yellow-700">{stats.reserved}</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-xs text-red-600">미완료</div>
          <div className="text-lg font-bold text-red-700">{stats.pending}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="text-xs text-green-600">완료</div>
          <div className="text-lg font-bold text-green-700">{stats.completed}</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <div className="text-xs text-amber-600">결재</div>
          <div className="text-lg font-bold text-amber-700">{stats.deposited}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-2 text-center">
          <div className="text-xs text-purple-600">매출</div>
          <div className="text-lg font-bold text-purple-700">{stats.totalAmount.toLocaleString()}</div>
        </div>
      </div>

      {/* PC 헤더 */}
      <div className="hidden lg:grid grid-cols-[60px_30px_50px_1fr_80px_1fr_80px_100px_80px_60px_60px_60px] gap-1.5 px-2 py-2 bg-gray-100 rounded-t-lg text-xs font-medium text-gray-600">
        <span>날짜</span><span>요일</span><span>시간</span><span>거래처</span><span>동호수</span><span>내용</span><span>유형</span><span className="text-right">금액</span><span>결제</span>
        <span className="text-center">예약</span><span className="text-center">완료</span><span className="text-center">결재</span>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : installSchedules.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🔨</div>
          <p>외주설치 일정이 없습니다.</p>
          <p className="text-xs mt-1">일별 스케줄에서 🔨 설치 뱃지를 선택하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <>
          {groupedByMonth.map(([monthKey, monthSchedules]) => {
            const [y, m] = monthKey.split('-').map(Number);
            const monthDone = monthSchedules.filter(s => s.is_done);
            const monthTotal = monthDone.reduce((sum, s) => sum + (s.install_amount || 0), 0);
            return (
              <div key={monthKey}>
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg mb-1">
                  <span className="font-semibold text-sm">{y}년 {m}월</span>
                  <span className="text-xs text-gray-500">
                    {monthSchedules.length}건 · 완료 {monthDone.length}건 · {monthTotal.toLocaleString()}원
                  </span>
                </div>
                <div className="border rounded-lg lg:rounded-t-none lg:border-t-0 overflow-hidden mb-3">
                  {monthSchedules.map((s) => (
                    <InstallRow key={s.id} schedule={s} clients={clients} items={items} onSave={handleSave} typePrices={typePrices}
                      isSelected={selectedIds.has(s.id)} onToggleSelect={toggleSelect}
                      installPaid={installPaidIds.has(s.id)} onToggleInstallPaid={toggleInstallPaid}
                      onNavigateToDate={handleNavigateToDate} />
                  ))}
                </div>
              </div>
            );
          })}
          {/* 합계 */}
          <div className="bg-gray-50 rounded-lg p-3 text-center text-sm font-semibold">
            합계: {installSchedules.filter(s => s.is_done).reduce((sum, s) => sum + (s.install_amount || 0), 0).toLocaleString()}원
            <span className="text-gray-500 ml-2">({stats.completed}/{stats.total}건 완료)</span>
          </div>
        </>
      )}

      {/* 모바일 하단 플로팅 버튼 */}
      {selectedIds.size > 0 && (
        <div className="lg:hidden fixed bottom-16 left-4 right-4 z-40 flex gap-2">
          <Button variant="outline" size="sm" className="h-10 px-3 bg-white shadow-lg"
            onClick={() => setSelectedIds(new Set())}
          >
            선택해제 ({selectedIds.size})
          </Button>
          <Button className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 shadow-lg gap-2"
            onClick={() => setShowSmsPopup(true)}
          >
            <MessageSquare className="h-4 w-4" />
            문자발송 ({selectedIds.size}건)
          </Button>
        </div>
      )}

      {/* SMS 팝업 */}
      {showSmsPopup && selectedSchedules.length > 0 && (
        <SmsPopup schedules={selectedSchedules} onClose={() => setShowSmsPopup(false)} />
      )}
    </div>
  );
}
