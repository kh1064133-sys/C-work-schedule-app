'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, X, ChevronLeft, ChevronRight, Download, Upload, Link2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useItems } from '@/hooks/useItems';
import { useGroupBuyCustomers, useBatchUpsertGroupBuy, useDeleteGroupBuyCustomer, GroupBuyCustomerDB } from '@/hooks/useGroupBuy';
import * as XLSX from 'xlsx';

interface GroupBuyCustomer {
  id: string;
  installDate: string;
  dayOfWeek: string;
  time: string;
  dong: string;
  ho: string;
  contact: string;
  content: string;
  amount: number;
  paymentMethod: string;
  note: string;
  reserved: boolean;
  completed: boolean;
  deposited: boolean;
}

const DAY_MAP: Record<number, string> = {
  0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토',
};

function getDayOfWeek(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return DAY_MAP[d.getDay()] ?? '';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y.slice(2)}/${m}/${d}`;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

const PAYMENT_METHODS = ['현금', '카드', '계좌이체', '무상', '기타'];

function getRowBg(c: GroupBuyCustomer): string {
  if (c.deposited) return '#F0FDF4';
  if (c.completed) return '#FFF7ED';
  if (c.reserved) return '#EFF6FF';
  return 'white';
}

import { useSmsTemplates, useUpsertSmsTemplate } from '@/hooks/useSmsTemplates';
import { useSmsSentStatusAll, useMarkSmsSent, isSent } from '@/hooks/useSmsSentStatus';

const DEFAULT_SMS_TEMPLATES: Record<number, string> = {
  1: '안녕하세요. {호수} 고객님, 설치 일정 안내드립니다. 설치일: {날짜} {시간}. 문의사항은 연락주세요.',
  2: '{호수} 고객님, 설치 예정일 {날짜} {시간} 입니다. 확인 부탁드립니다.',
  3: '{호수} 고객님, 내일 {시간} 설치 예정입니다. 참고 부탁드립니다.',
  4: '{호수} 고객님, 설치가 완료되었습니다. 감사합니다.',
};

function applyPlaceholders(template: string, hosu: string, date: string, time: string) {
  return template
    .replace('{호수}', hosu)
    .replace('{날짜}', date)
    .replace('{시간}', time);
}

function SmsModal({ customer, smsNum, onClose, onSent }: { customer: GroupBuyCustomer; smsNum: number; onClose: () => void; onSent: () => void }) {
  const hosu = customer.dong && customer.ho ? `${customer.dong}-${customer.ho}` : customer.ho || customer.dong || '';
  const dateStr = customer.installDate ? formatDate(customer.installDate) : '';
  const timeStr = customer.time || '';

  const { data: templates = [], isLoading: templatesLoading } = useSmsTemplates();
  const upsertTemplate = useUpsertSmsTemplate();

  const savedTemplate = templates.find(t => t.sms_num === smsNum);
  const initialText = applyPlaceholders(
    savedTemplate?.template_text || DEFAULT_SMS_TEMPLATES[smsNum] || '',
    hosu, dateStr, timeStr
  );

  const [smsText, setSmsText] = useState(initialText);
  const [initialized, setInitialized] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 서버에서 템플릿 로드 후 텍스트 업데이트
  useEffect(() => {
    if (!templatesLoading && !initialized) {
      const sv = templates.find(t => t.sms_num === smsNum);
      if (sv) {
        setSmsText(applyPlaceholders(sv.template_text, hosu, dateStr, timeStr));
      }
      setInitialized(true);
    }
  }, [templatesLoading, initialized, templates, smsNum, hosu, dateStr, timeStr]);

  const charCount = smsText.length;
  const isLong = charCount > 90;

  const handleChange = (val: string) => {
    setSmsText(val);
    // 디바운스: 500ms 후 Supabase에 자동저장 (공통 템플릿)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const templateText = val
        .replace(hosu, '{호수}')
        .replace(dateStr, '{날짜}')
        .replace(timeStr, '{시간}');
      upsertTemplate.mutate({
        sms_num: smsNum,
        template_text: templateText,
      });
    }, 500);
  };

  const handleSend = () => {
    const encoded = encodeURIComponent(smsText);
    window.location.href = `sms:${customer.contact}?body=${encoded}`;
    onSent();
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '95%', maxWidth: 420, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>📩 문자 {smsNum} 발송</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#999' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: '#F0F9FF', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>호수</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{hosu || '-'}</div>
          </div>
          <div style={{ flex: 1, background: '#F0F9FF', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>연락처</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{customer.contact || '-'}</div>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <textarea
            value={smsText}
            onChange={e => handleChange(e.target.value)}
            rows={5}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `2px solid ${isLong ? '#EF4444' : '#D1D5DB'}`,
              borderRadius: 10,
              fontSize: 14,
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { if (!isLong) e.target.style.borderColor = '#3B82F6'; }}
            onBlur={e => { if (!isLong) e.target.style.borderColor = '#D1D5DB'; }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: isLong ? '#EF4444' : '#6B7280',
          }}>
            {charCount}자 / 90자
            {isLong && <span style={{ marginLeft: 6, color: '#EF4444', fontWeight: 700 }}>⚠ 장문(LMS)</span>}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>자동저장됨</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #D1D5DB', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
          >취소</button>
          <button
            onClick={handleSend}
            disabled={!customer.contact}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#3B82F6', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff', opacity: customer.contact ? 1 : 0.4 }}
          >문자 보내기</button>
        </div>
      </div>
    </div>
  );
}

function DailyScheduleTable({ customers, selectedId, onSelect }: { customers: GroupBuyCustomer[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const [smsTarget, setSmsTarget] = useState<{ customer: GroupBuyCustomer; num: number } | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkSmsNum, setBulkSmsNum] = useState<number | null>(null);
  const { data: sentStatusList = [] } = useSmsSentStatusAll();
  const markSmsSent = useMarkSmsSent();
  const { data: templates = [] } = useSmsTemplates();
  const PER_PAGE = 10;

  const sorted = [...customers]
    .filter(c => c.installDate)
    .sort((a, b) => {
      const dateCompare = a.installDate.localeCompare(b.installDate);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    });

  // 날짜별 그룹 인덱스 계산
  const dateGroups: string[] = [];
  sorted.forEach(c => {
    if (!dateGroups.includes(c.installDate)) dateGroups.push(c.installDate);
  });

  if (sorted.length === 0) return null;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // 페이지 내 첫 항목 이전 날짜 추적
  const startIdx = (safePage - 1) * PER_PAGE;
  let prevDate = startIdx > 0 ? sorted[startIdx - 1]?.installDate || '' : '';

  // 체크박스 헬퍼
  const pagedWithContact = paged.filter(c => c.contact);
  const allChecked = pagedWithContact.length > 0 && pagedWithContact.every(c => checkedIds.has(c.id));
  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(checkedIds);
      pagedWithContact.forEach(c => next.delete(c.id));
      setCheckedIds(next);
    } else {
      const next = new Set(checkedIds);
      pagedWithContact.forEach(c => next.add(c.id));
      setCheckedIds(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(checkedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCheckedIds(next);
  };

  // 단체발송
  const checkedCustomers = sorted.filter(c => checkedIds.has(c.id) && c.contact);

  const handleBulkSend = (smsNum: number) => {
    if (checkedCustomers.length === 0) return;
    const savedTpl = templates.find(t => t.sms_num === smsNum);
    const tplText = savedTpl?.template_text || DEFAULT_SMS_TEMPLATES[smsNum] || '';
    const contacts = checkedCustomers.map(c => c.contact).join(',');
    // 단체발송 시 플레이스홀더를 일반 안내문으로 변환
    const bodyText = tplText
      .replace('{호수}', '고객')
      .replace('{날짜}', '')
      .replace('{시간}', '');
    const encoded = encodeURIComponent(bodyText);
    // 발송상태 기록
    checkedCustomers.forEach(c => {
      markSmsSent.mutate({ customer_id: c.id, sms_num: smsNum });
    });
    window.location.href = `sms:${contacts}?body=${encoded}`;
    setBulkSmsNum(null);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>일별 설치일정</h2>
        {checkedCustomers.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setBulkSmsNum(bulkSmsNum ? null : 0)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 14px', borderRadius: 8,
                border: 'none', background: '#3B82F6', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              📩 단체발송 ({checkedCustomers.length}명)
            </button>
            {bulkSmsNum === 0 && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 50,
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, minWidth: 140,
              }}>
                <div style={{ fontSize: 12, color: '#6B7280', padding: '4px 8px', fontWeight: 600 }}>문자 선택</div>
                {[1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    onClick={() => handleBulkSend(num)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', border: 'none', background: 'transparent',
                      fontSize: 14, cursor: 'pointer', borderRadius: 6,
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.background = '#F0F9FF'}
                    onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
                  >
                    문자 {num} 발송
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#1E3A8A', color: '#fff' }}>
              <th style={{ width: 32, padding: '8px 2px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#60A5FA' }} />
              </th>
              <th style={{ width: 36, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>순</th>
              <th style={{ width: 70, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>날짜</th>
              <th style={{ width: 40, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>요일</th>
              <th style={{ width: 70, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>시간</th>
              <th style={{ width: 60, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>호수</th>
              <th style={{ width: 100, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>연락처</th>
              <th style={{ width: 110, padding: '8px 4px', textAlign: 'center' }}>문자</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((c, idx) => {
              const seq = startIdx + idx + 1;
              const isNewDate = c.installDate !== prevDate;
              const groupIdx = dateGroups.indexOf(c.installDate);
              const bgColor = groupIdx % 2 === 0 ? '#fff' : '#F8FAFC';
              const isWeekend = c.dayOfWeek === '토' || c.dayOfWeek === '일';
              const dayColor = isWeekend ? '#EF4444' : '#333';
              const showBorderTop = isNewDate && seq > 1;
              prevDate = c.installDate;

              return (
                <tr key={c.id} onClick={() => onSelect(c.id)} style={{
                  background: c.id === selectedId ? '#FEF9C3' : getRowBg(c),
                  height: 36,
                  borderTop: showBorderTop ? '2px solid #CBD5E1' : '1px solid #E5E7EB',
                  cursor: 'pointer',
                }}>
                  <td style={{ textAlign: 'center', borderRight: '1px solid #E5E7EB', padding: '2px' }}>
                    {c.contact ? (
                      <input
                        type="checkbox"
                        checked={checkedIds.has(c.id)}
                        onChange={e => { e.stopPropagation(); toggleOne(c.id); }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#3B82F6' }}
                      />
                    ) : null}
                  </td>
                  <td style={{ textAlign: 'center', borderRight: '1px solid #E5E7EB', padding: '4px' }}>{seq}</td>
                  <td style={{ textAlign: 'center', borderRight: '1px solid #E5E7EB', padding: '4px', fontWeight: isNewDate ? 600 : 400 }}>
                    {isNewDate ? formatShortDate(c.installDate) : ''}
                  </td>
                  <td style={{ textAlign: 'center', borderRight: '1px solid #E5E7EB', padding: '4px', color: dayColor, fontWeight: isWeekend ? 600 : 400 }}>
                    {isNewDate ? c.dayOfWeek : ''}
                  </td>
                  <td style={{ textAlign: 'center', borderRight: '1px solid #E5E7EB', padding: '4px' }}>{c.time}</td>
                  <td style={{ textAlign: 'center', borderRight: '1px solid #E5E7EB', padding: '4px' }}>
                    {c.dong && c.ho ? `${c.dong}-${c.ho}` : c.ho || c.dong}
                  </td>
                  <td style={{ textAlign: 'center', padding: '4px', borderRight: '1px solid #E5E7EB' }}>
                    {c.contact ? (
                      <a href={`tel:${c.contact}`} style={{
                        color: '#2563EB',
                        textDecoration: 'none',
                        background: '#EFF6FF',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 12,
                      }}>
                        📞 {c.contact}
                      </a>
                    ) : ''}
                  </td>
                  <td style={{ textAlign: 'center', padding: '2px 4px' }}>
                    {c.contact ? (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
                        {[1, 2, 3, 4].map(num => {
                          const sent = isSent(sentStatusList, c.id, num);
                          return (
                          <button
                            key={num}
                            onClick={e => { e.stopPropagation(); setSmsTarget({ customer: c, num }); }}
                            title={`문자 ${num} ${sent ? '(발송완료)' : '발송'}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              background: sent ? '#DCFCE7' : '#DBEAFE',
                              borderRadius: 6,
                              textDecoration: 'none',
                              cursor: 'pointer',
                              border: sent ? '1px solid #86EFAC' : 'none',
                              padding: 0,
                            }}
                          >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H7l-4 3V6c0-1.1.9-2 2-2z" fill={sent ? '#4ADE80' : '#60A5FA'} stroke={sent ? '#22C55E' : '#3B82F6'} strokeWidth="1"/>
                              {sent ? (
                                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              ) : (
                                <text x="12" y="14" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="10" fontWeight="bold">{num}</text>
                              )}
                            </svg>
                          </button>
                          );
                        })}
                      </div>
                    ) : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '6px 12px', opacity: safePage === 1 ? 0.3 : 1, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span style={{ padding: '6px 12px', fontSize: 14, fontWeight: 500, borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB' }}>{safePage}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '6px 12px', opacity: safePage === totalPages ? 0.3 : 1, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {smsTarget && <SmsModal customer={smsTarget.customer} smsNum={smsTarget.num} onClose={() => setSmsTarget(null)} onSent={() => markSmsSent.mutate({ customer_id: smsTarget.customer.id, sms_num: smsTarget.num })} />}
    </div>
  );
}

const TIME_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','미정'];
const SHORT_DAY: Record<number, string> = { 0:'일',1:'월',2:'화',3:'수',4:'목',5:'금',6:'토' };

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function TimeSlotScheduleTable({ customers, selectedId, onSelect }: { customers: GroupBuyCustomer[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const isMobile = useIsMobile();
  const withDate = customers.filter(c => c.installDate);
  const dateSet = new Set(withDate.map(c => c.installDate));
  const dates = [...dateSet].sort();

  if (dates.length === 0) return null;

  // 날짜+시간 매핑 (ID 포함)
  const scheduleMap = new Map<string, { label: string; id: string; status: string }[]>();
  withDate.forEach(c => {
    const time = TIME_SLOTS.includes(c.time) ? c.time : '미정';
    const key = `${c.installDate}__${time}`;
    const arr = scheduleMap.get(key) || [];
    const status = c.deposited ? 'deposited' : c.completed ? 'completed' : c.reserved ? 'reserved' : 'none';
    arr.push({ label: c.dong && c.ho ? `${c.dong}동${c.ho}호` : c.ho ? `${c.ho}호` : '', id: c.id, status });
    scheduleMap.set(key, arr);
  });

  const getHeaderStyle = (dateStr: string): React.CSSProperties => {
    const dow = new Date(dateStr).getDay();
    const base: React.CSSProperties = {
      color: '#fff',
      padding: isMobile ? '6px 2px' : '8px 6px',
      textAlign: 'center',
      fontSize: isMobile ? 11 : 13,
      whiteSpace: 'nowrap',
    };
    if (dow === 0) return { ...base, background: '#DC2626', borderRight: '1px solid rgba(255,255,255,0.3)' };
    if (dow === 6) return { ...base, background: '#2563EB', borderRight: '1px solid rgba(255,255,255,0.3)' };
    return { ...base, background: '#1E3A8A', borderRight: '1px solid #3B5998' };
  };

  const formatHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()}(${SHORT_DAY[d.getDay()]})`;
  };

  const TIME_COL_W = isMobile ? 50 : 70;
  const DATE_COL_W = isMobile ? 64 : 90;

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 'bold', marginBottom: 12 }}>시간대별 설치일정</h2>
      <div style={{
        overflowX: 'auto',
        border: '1px solid #ddd',
        borderRadius: 8,
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
      }}>
        <table style={{ borderCollapse: 'collapse', fontSize: isMobile ? 11 : 13, minWidth: TIME_COL_W + dates.length * DATE_COL_W }}>
          <thead>
            <tr>
              <th style={{
                width: TIME_COL_W, minWidth: TIME_COL_W,
                position: 'sticky', left: 0, zIndex: 1,
                background: '#1E3A8A', color: '#fff',
                padding: isMobile ? '6px 2px' : '8px 4px',
                textAlign: 'center', borderRight: '1px solid #3B5998',
                fontSize: isMobile ? 11 : 13,
              }}>시간</th>
              {dates.map(dt => (
                <th key={dt} style={{ ...getHeaderStyle(dt), minWidth: DATE_COL_W }}>{formatHeader(dt)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map(time => (
              <tr key={time} style={{ borderTop: '1px solid #E5E7EB' }}>
                <td style={{
                  background: '#F8FAFC', fontWeight: 'bold', textAlign: 'center',
                  padding: isMobile ? '4px 2px' : '6px 4px',
                  borderRight: '1px solid #E5E7EB',
                  position: 'sticky', left: 0, zIndex: 1,
                  minWidth: TIME_COL_W, fontSize: isMobile ? 11 : 13,
                }}>{time}</td>
                {dates.map(dt => {
                  const items = scheduleMap.get(`${dt}__${time}`) || [];
                  const hasData = items.length > 0;
                  const hasSelected = items.some(item => item.id === selectedId);
                  return (
                    <td key={dt} style={{
                      textAlign: 'center',
                      padding: isMobile ? '3px 2px' : '4px 6px',
                      borderRight: '1px solid #E5E7EB',
                      background: hasSelected ? '#FEF9C3' : hasData ? '#EFF6FF' : '#fff',
                      color: hasData ? '#1D4ED8' : '#999',
                      fontWeight: hasData ? 600 : 400,
                      fontSize: isMobile ? 10 : 12,
                      minWidth: DATE_COL_W,
                      lineHeight: isMobile ? '1.3' : '1.5',
                    }}>
                      {items.map((item, i) => {
                        const itemBg = item.id === selectedId ? '#FDE047'
                          : item.status === 'deposited' ? '#22C55E'
                          : item.status === 'completed' ? '#FB923C'
                          : item.status === 'reserved' ? '#3B82F6'
                          : 'transparent';
                        const hasStatus = item.status !== 'none';
                        const isHighlight = item.id === selectedId || hasStatus;
                        return (
                          <div key={i}
                            onClick={() => onSelect(item.id)}
                            style={{
                              cursor: 'pointer',
                              borderRadius: 4,
                              padding: '2px 4px',
                              background: itemBg,
                              color: isHighlight ? '#fff' : undefined,
                              fontWeight: isHighlight ? 700 : undefined,
                              display: 'block',
                              margin: '2px 0',
                              textAlign: 'center',
                            }}
                          >{item.label}</div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toDBRow(c: GroupBuyCustomer, sortOrder: number): Omit<GroupBuyCustomerDB, 'user_id'> {
  return {
    id: c.id,
    install_date: c.installDate,
    day_of_week: c.dayOfWeek,
    time: c.time,
    dong: c.dong,
    ho: c.ho,
    contact: c.contact,
    content: c.content,
    amount: c.amount,
    payment_method: c.paymentMethod,
    note: c.note,
    reserved: c.reserved,
    completed: c.completed,
    deposited: c.deposited,
    sort_order: sortOrder,
  };
}

function fromDBRow(row: GroupBuyCustomerDB): GroupBuyCustomer {
  return {
    id: row.id,
    installDate: row.install_date,
    dayOfWeek: row.day_of_week,
    time: row.time,
    dong: row.dong,
    ho: row.ho,
    contact: row.contact,
    content: row.content,
    amount: row.amount,
    paymentMethod: row.payment_method,
    note: row.note,
    reserved: row.reserved,
    completed: row.completed,
    deposited: row.deposited,
  };
}

const STORAGE_KEY = 'groupbuy-customers';

function loadCustomers(): GroupBuyCustomer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomers(customers: GroupBuyCustomer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

function parseExcelDate(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date((val - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  // YY/MM/DD or YYYY/MM/DD or YYYY-MM-DD
  const m = s.match(/(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const y = m[1].length === 2 ? '20' + m[1] : m[1];
    return `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  return '';
}

function importFromExcel(file: File): Promise<GroupBuyCustomer[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

        const customers: GroupBuyCustomer[] = rows.map(row => {
          const installDate = parseExcelDate(row['설치일']);
          return {
            id: crypto.randomUUID(),
            installDate,
            dayOfWeek: getDayOfWeek(installDate),
            time: String(row['시간'] ?? '').trim(),
            dong: String(row['동'] ?? '').trim(),
            ho: String(row['호수'] ?? row['호'] ?? '').trim(),
            contact: String(row['연락처'] ?? '').trim(),
            content: String(row['내용'] ?? '').trim(),
            amount: Number(row['금액']) || 0,
            paymentMethod: String(row['결재방법'] ?? row['결제방법'] ?? '').trim(),
            note: String(row['비고'] ?? '').trim(),
            reserved: String(row['예약']).toUpperCase() === 'O',
            completed: String(row['완료']).toUpperCase() === 'O',
            deposited: String(row['입금']).toUpperCase() === 'O',
          };
        }).filter(c => c.dong || c.ho || c.contact);

        resolve(customers);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function exportToExcel(customers: GroupBuyCustomer[]) {
  const wb = XLSX.utils.book_new();

  // 시트 1: 공동구매 고객 목록
  const sheet1Data = customers.map((c, idx) => ({
    '순번': idx + 1,
    '설치일': formatDate(c.installDate),
    '요일': c.dayOfWeek,
    '시간': c.time,
    '동': c.dong,
    '호수': c.ho,
    '연락처': c.contact,
    '내용': c.content,
    '금액': c.amount || '',
    '결재방법': c.paymentMethod,
    '비고': c.note,
    '예약': c.reserved ? 'O' : '',
    '완료': c.completed ? 'O' : '',
    '입금': c.deposited ? 'O' : '',
  }));
  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
  ws1['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 6 }, { wch: 8 }, { wch: 6 },
    { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '공동구매 고객 목록');

  // 시트 2: 일별 설치일정
  const sorted = [...customers]
    .filter(c => c.installDate)
    .sort((a, b) => {
      const dateCompare = a.installDate.localeCompare(b.installDate);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    });
  const sheet2Data = sorted.map((c, idx) => ({
    '순번': idx + 1,
    '날짜': formatShortDate(c.installDate),
    '요일': c.dayOfWeek,
    '시간': c.time,
    '호수': c.dong && c.ho ? `${c.dong}-${c.ho}` : c.ho || c.dong,
    '연락처': c.contact,
  }));
  const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 6 }, { wch: 10 }, { wch: 6 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '일별 설치일정');

  // 시트 3: 시간대별 설치일정
  const withDate = customers.filter(c => c.installDate);
  const dateSet = new Set(withDate.map(c => c.installDate));
  const dates = [...dateSet].sort();

  const scheduleMap = new Map<string, string[]>();
  withDate.forEach(c => {
    const time = TIME_SLOTS.includes(c.time) ? c.time : '미정';
    const key = `${c.installDate}__${time}`;
    const arr = scheduleMap.get(key) || [];
    arr.push(c.dong && c.ho ? `${c.dong}동${c.ho}호` : c.ho ? `${c.ho}호` : '');
    scheduleMap.set(key, arr);
  });

  const dateHeaders = dates.map(dt => {
    const d = new Date(dt);
    return `${d.getMonth() + 1}/${d.getDate()}(${SHORT_DAY[d.getDay()]})`;
  });

  const sheet3Header = ['시간', ...dateHeaders];
  const sheet3Rows = TIME_SLOTS.map(time => {
    const row: string[] = [time];
    dates.forEach(dt => {
      const items = scheduleMap.get(`${dt}__${time}`) || [];
      row.push(items.join(', '));
    });
    return row;
  });

  const ws3 = XLSX.utils.aoa_to_sheet([sheet3Header, ...sheet3Rows]);
  ws3['!cols'] = [{ wch: 8 }, ...dates.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, ws3, '시간대별 설치일정');

  XLSX.writeFile(wb, `공동구매_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const RESERVE_URL_KEY = 'reserve-base-url';
const RESERVE_DATES_KEY = 'reserve-dates';

function ReservationLinkModal({ customers, onClose }: { customers: GroupBuyCustomer[]; onClose: () => void }) {
  const list = customers.filter(c => c.contact && c.ho);
  const [url, setUrl] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem(RESERVE_URL_KEY) : '') || '');
  const [dates, setDates] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem(RESERVE_DATES_KEY) : '') || '');
  const [copied, setCopied] = useState('');

  useEffect(() => { if (url) localStorage.setItem(RESERVE_URL_KEY, url); }, [url]);
  useEffect(() => { if (dates) localStorage.setItem(RESERVE_DATES_KEY, dates); }, [dates]);

  const ok = /^https:\/\/.+/.test(url.trim()) && dates.trim().length > 0;

  const link = (c: GroupBuyCustomer) => {
    const room = c.dong && c.ho ? `${c.dong}-${c.ho}` : c.ho;
    return `${url.replace(/\/+$/, '')}/reserve.html?d=${room}~${c.contact}~${dates.trim()}`;
  };

  const send = (c: GroupBuyCustomer) => {
    const room = c.dong && c.ho ? `${c.dong}-${c.ho}` : c.ho;
    const body = `[${room}] 설치 예약 안내\n아래 링크에서 희망 시간을 선택해주세요.\n${link(c)}`;
    window.location.href = `sms:${c.contact}?body=${encodeURIComponent(body)}`;
  };

  const copy = async (c: GroupBuyCustomer) => {
    const text = link(c);
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
    }
    setCopied(c.id); setTimeout(() => setCopied(''), 1200);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 440, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #eee' }}>
          <b style={{ fontSize: 16 }}>🔗 예약링크 발송</b>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#888', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 설정 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f3f3', fontSize: 13 }}>
          {!ok && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>⚠️ URL(https://)과 날짜를 모두 입력하세요</div>}
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://배포주소.vercel.app" style={{ width: '100%', padding: '7px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
          <input value={dates} onChange={e => setDates(e.target.value)} placeholder="날짜: 2026-03-24,2026-03-25" style={{ width: '100%', padding: '7px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
        </div>

        {/* 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>발송 대상이 없습니다</div>
          ) : list.map(c => {
            const room = c.dong && c.ho ? `${c.dong}-${c.ho}` : c.ho;
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{room} <span style={{ fontWeight: 400, fontSize: 12, color: '#888' }}>{c.contact}</span></div>
                </div>
                <button onClick={() => send(c)} disabled={!ok} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: ok ? '#3B82F6' : '#ddd', color: '#fff', fontSize: 12, fontWeight: 600, cursor: ok ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>발송</button>
                <button onClick={() => copy(c)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd', background: copied === c.id ? '#DCFCE7' : '#fff', color: copied === c.id ? '#16A34A' : '#333', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{copied === c.id ? '✓' : '복사'}</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GroupBuyPage() {
  const [customers, setCustomers] = useState<GroupBuyCustomer[]>(loadCustomers);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { data: items = [] } = useItems();
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedCustomerId(prev => prev === id ? null : id);
  }, []);

  // Supabase hooks
  const { data: dbCustomers } = useGroupBuyCustomers();
  const batchUpsert = useBatchUpsertGroupBuy();
  const deleteCustomerMutation = useDeleteGroupBuyCustomer();
  const supabaseLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchUpsertRef = useRef(batchUpsert);
  batchUpsertRef.current = batchUpsert;

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(customers.length / ITEMS_PER_PAGE));
  const pagedCustomers = customers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Supabase에서 초기 데이터 로드 + web_reservations 동기화
  useEffect(() => {
    if (dbCustomers && !supabaseLoadedRef.current) {
      supabaseLoadedRef.current = true;
      if (dbCustomers.length > 0) {
        const loaded = dbCustomers.map(fromDBRow);
        setCustomers(loaded);
        saveCustomers(loaded);
      }
    }
  }, [dbCustomers]);

  // web_reservations → groupbuy_customers 동기화 (앱 로드 시)
  useEffect(() => {
    if (!dbCustomers || dbCustomers.length === 0) return;
    const syncReservations = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: reservations } = await supabase.from('web_reservations').select('*');
        if (!reservations || reservations.length === 0) return;

        let updated = false;
        setCustomers(prev => {
          const next = prev.map(c => {
            if (c.reserved && c.installDate) return c; // 이미 예약됨
            const room = c.dong && c.ho ? `${c.dong}-${c.ho}` : c.ho;
            const match = reservations.find((r: { room: string; phone: string }) => r.room === room && r.phone === c.contact);
            if (!match) return c;
            updated = true;
            const d = new Date(match.reserve_date + 'T00:00:00');
            return { ...c, installDate: match.reserve_date, dayOfWeek: DAY_MAP[d.getDay()] ?? '', time: match.reserve_time, reserved: true };
          });
          return updated ? next : prev;
        });
      } catch {}
    };
    syncReservations();
  }, [dbCustomers]);

  // 변경 시 자동 저장 (localStorage 즉시 + Supabase 디바운스)
  useEffect(() => {
    saveCustomers(customers);

    if (!supabaseLoadedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const dbRows = customers.map((c, i) => toDBRow(c, i));
      batchUpsertRef.current.mutate(dbRows);
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [customers]);

  const addEmptyRow = () => {
    const newCustomer: GroupBuyCustomer = {
      id: crypto.randomUUID(),
      installDate: '',
      dayOfWeek: '',
      time: '',
      dong: '',
      ho: '',
      contact: '',
      content: '',
      amount: 0,
      paymentMethod: '',
      note: '',
      reserved: false,
      completed: false,
      deposited: false,
    };
    setCustomers(prev => [...prev, newCustomer]);
    // 새 행 추가 시 마지막 페이지로 이동
    const newTotal = customers.length + 1;
    setCurrentPage(Math.ceil(newTotal / ITEMS_PER_PAGE));
  };

  const handleDelete = (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    setCustomers(prev => prev.filter(c => c.id !== id));
    deleteCustomerMutation.mutate(id);
  };

  const toggleField = (id: string, field: 'reserved' | 'completed' | 'deposited') => {
    setCustomers(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const newVal = !c[field];
        if (field === 'completed' && newVal) {
          return { ...c, completed: true, reserved: false };
        }
        if (field === 'deposited' && newVal) {
          return { ...c, deposited: true, completed: false };
        }
        return { ...c, [field]: newVal };
      }),
    );
  };

  const updateInline = (id: string, field: keyof GroupBuyCustomer, value: string | number) => {
    setCustomers(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const updateInstallDate = (id: string, dateStr: string) => {
    setCustomers(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, installDate: dateStr, dayOfWeek: getDayOfWeek(dateStr) }
          : c,
      ),
    );
  };

  return (
    <div className="space-y-4">
      {/* 상단 헤더 */}
      <div>
        <h2 className="text-lg font-bold mb-2">공동구매 고객 목록</h2>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReservationModal(true)}
            className="gap-1"
            style={{ background: '#EFF6FF', borderColor: '#93C5FD', color: '#1D4ED8' }}
          >
            <Link2 className="h-4 w-4" />
            예약링크
            <span style={{
              background: '#3B82F6', color: '#fff', fontSize: 10,
              padding: '1px 6px', borderRadius: 8, fontWeight: 700, marginLeft: 2,
            }}>
              {customers.filter(c => c.contact && c.ho).length}
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToExcel(customers)} className="gap-1">
            <Download className="h-4 w-4" />
            엑셀
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => document.getElementById('excel-import')?.click()}>
            <Upload className="h-4 w-4" />
            가져오기
          </Button>
          <input id="excel-import" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const imported = await importFromExcel(file);
              if (imported.length === 0) { alert('가져올 데이터가 없습니다.'); return; }
              if (!confirm(`${imported.length}명의 고객을 가져오시겠습니까?`)) return;
              setCustomers(prev => [...prev, ...imported]);
              alert(`${imported.length}명 가져오기 완료!`);
            } catch {
              alert('엑셀 파일을 읽을 수 없습니다.');
            }
            e.target.value = '';
          }} />
          <Button variant="outline" size="sm" onClick={addEmptyRow} className="gap-1">
            <Plus className="h-4 w-4" />
            리스트추가
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            className="gap-1"
            style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
          >
            <RotateCcw className="h-4 w-4" />
            초기화
          </Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm whitespace-nowrap table-fixed">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th style={{width:40}} className="px-1 py-2 text-center border-r">순번</th>
              <th style={{width:90}} className="px-1 py-2 text-center border-r">설치일</th>
              <th style={{width:40}} className="px-1 py-2 text-center border-r">요일</th>
              <th style={{width:70}} className="px-1 py-2 text-center border-r">시간</th>
              <th style={{width:40}} className="px-1 py-2 text-center border-r">동</th>
              <th style={{width:50}} className="px-1 py-2 text-center border-r">호수</th>
              <th style={{width:110}} className="px-1 py-2 text-center border-r">연락처</th>
              <th style={{width:120}} className="px-1 py-2 text-center border-r">내용</th>
              <th style={{width:80}} className="px-1 py-2 text-center border-r">금액</th>
              <th style={{width:70}} className="px-1 py-2 text-center border-r">결재방법</th>
              <th style={{width:60}} className="px-1 py-2 text-center border-r">비고</th>
              <th style={{width:40}} className="px-1 py-2 text-center border-r">예약</th>
              <th style={{width:40}} className="px-1 py-2 text-center border-r">완료</th>
              <th style={{width:40}} className="px-1 py-2 text-center border-r">입금</th>
              <th style={{width:40}} className="px-1 py-2 text-center">삭제</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-gray-400">
                  등록된 고객이 없습니다. +리스트추가 버튼을 눌러주세요.
                </td>
              </tr>
            ) : (
              pagedCustomers.map((c, idx) => (
                <tr key={c.id}
                  onClick={() => toggleSelect(c.id)}
                  className="border-t"
                  style={{
                    background: c.id === selectedCustomerId ? '#FEF9C3' : getRowBg(c),
                    cursor: 'pointer',
                  }}
                >
                  <td className="px-2 py-1.5 text-center border-r">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                  <td className="px-1 py-1 border-r">
                    <input
                      type="date"
                      value={c.installDate}
                      onChange={e => updateInstallDate(c.id, e.target.value)}
                      className="w-full px-0 py-0.5 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center border-r text-xs">{c.dayOfWeek}</td>
                  <td className="px-1 py-1 border-r">
                    <select
                      value={c.time}
                      onChange={e => updateInline(c.id, 'time', e.target.value)}
                      className="px-1 py-0.5 text-xs"
                    >
                      <option value="">선택</option>
                      {Array.from({ length: 10 }, (_, i) => {
                        const h = (9 + i).toString().padStart(2, '0');
                        return <option key={h} value={`${h}:00`}>{`${h}:00`}</option>;
                      })}
                    </select>
                  </td>
                  <td className="px-1 py-1 border-r">
                    <input
                      type="text"
                      value={c.dong}
                      onChange={e => updateInline(c.id, 'dong', e.target.value)}
                      className="w-full px-1 py-0.5 text-center text-xs"
                      placeholder="동"
                    />
                  </td>
                  <td className="px-1 py-1 border-r">
                    <input
                      type="text"
                      value={c.ho}
                      onChange={e => updateInline(c.id, 'ho', e.target.value)}
                      className="w-14 px-1 py-0.5 text-center text-xs"
                      placeholder="호수"
                    />
                  </td>
                  <td className="px-1 py-1 border-r">
                    <input
                      type="tel"
                      value={c.contact}
                      onChange={e => updateInline(c.id, 'contact', e.target.value)}
                      className="w-28 px-1 py-0.5 text-center text-xs"
                      placeholder="연락처"
                    />
                  </td>
                  <td className="px-1 py-1 border-r">
                    <select
                      value={c.content}
                      onChange={e => {
                        const name = e.target.value;
                        const item = items.find(i => i.name === name);
                        setCustomers(prev => prev.map(row => row.id === c.id ? { ...row, content: name, amount: item?.price ?? 0 } : row));
                      }}
                      className="w-full px-0 py-0 text-xs"
                    >
                      <option value="">선택</option>
                      {items.map(item => (
                        <option key={item.id} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center border-r text-xs">
                    {c.amount != null && c.amount !== 0 ? c.amount.toLocaleString() : c.amount === 0 ? '0' : ''}
                  </td>
                  <td className="px-1 py-1 border-r">
                    <select
                      value={c.paymentMethod}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === '무상') {
                          setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, paymentMethod: v, amount: 0 } : x));
                        } else {
                          updateInline(c.id, 'paymentMethod', v);
                        }
                      }}
                      className="w-full px-0 py-0.5 text-xs"
                    >
                      <option value="">선택</option>
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 border-r">
                    <input
                      type="text"
                      value={c.note}
                      onChange={e => updateInline(c.id, 'note', e.target.value)}
                      className="w-full px-1 py-0.5 text-center text-xs"
                    />
                  </td>
                  <td className="px-1 py-1 text-center border-r" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleField(c.id, 'reserved')}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: 'none',
                        background: c.reserved ? '#3B82F6' : '#F3F4F6',
                        color: c.reserved ? '#fff' : '#9CA3AF',
                        fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >{c.reserved ? '✓' : '·'}</button>
                  </td>
                  <td className="px-1 py-1 text-center border-r" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleField(c.id, 'completed')}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: 'none',
                        background: c.completed ? '#FB923C' : '#F3F4F6',
                        color: c.completed ? '#fff' : '#9CA3AF',
                        fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >{c.completed ? '✓' : '·'}</button>
                  </td>
                  <td className="px-1 py-1 text-center border-r" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleField(c.id, 'deposited')}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: 'none',
                        background: c.deposited ? '#22C55E' : '#F3F4F6',
                        color: c.deposited ? '#fff' : '#9CA3AF',
                        fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >{c.deposited ? '✓' : '·'}</button>
                  </td>
                  <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '6px 12px', opacity: currentPage === 1 ? 0.3 : 1, border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span style={{ padding: '6px 12px', fontSize: 14, fontWeight: 500, borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB' }}>{currentPage}/{totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '6px 12px', opacity: currentPage === totalPages ? 0.3 : 1, border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 일별 설치일정 */}
      <DailyScheduleTable customers={customers} selectedId={selectedCustomerId} onSelect={toggleSelect} />

      {/* 시간대별 설치일정 */}
      <TimeSlotScheduleTable customers={customers} selectedId={selectedCustomerId} onSelect={toggleSelect} />

      {/* 예약링크 발송 모달 */}
      {showReservationModal && (
        <ReservationLinkModal customers={customers} onClose={() => setShowReservationModal(false)} />
      )}

      {/* 초기화 확인 팝업 */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowResetConfirm(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 24px', maxWidth: 340, width: '90%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#1F2937' }}>고객 목록 초기화</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.5 }}>
              전체 고객 목록이 삭제됩니다.<br />이 작업은 되돌릴 수 없습니다.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>취소</button>
              <button onClick={() => {
                customers.forEach(c => deleteCustomerMutation.mutate(c.id));
                setCustomers([]);
                saveCustomers([]);
                setCurrentPage(1);
                setShowResetConfirm(false);
              }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>초기화</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
