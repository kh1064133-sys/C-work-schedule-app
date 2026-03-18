'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useItems } from '@/hooks/useItems';
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

const PAYMENT_METHODS = ['현금', '카드', '계좌이체', '기타'];

function DailyScheduleTable({ customers }: { customers: GroupBuyCustomer[] }) {
  const [page, setPage] = useState(1);
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

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>일별 설치일정</h2>
      <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#1E3A8A', color: '#fff' }}>
              <th style={{ width: 40, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>순번</th>
              <th style={{ width: 70, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>날짜</th>
              <th style={{ width: 40, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>요일</th>
              <th style={{ width: 70, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>시간</th>
              <th style={{ width: 60, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #3B5998' }}>호수</th>
              <th style={{ width: 120, padding: '8px 4px', textAlign: 'center' }}>연락처</th>
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
                <tr key={c.id} style={{
                  background: bgColor,
                  height: 36,
                  borderTop: showBorderTop ? '2px solid #CBD5E1' : '1px solid #E5E7EB',
                }}>
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
                  <td style={{ textAlign: 'center', padding: '4px' }}>
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

function TimeSlotScheduleTable({ customers }: { customers: GroupBuyCustomer[] }) {
  const isMobile = useIsMobile();
  const withDate = customers.filter(c => c.installDate);
  const dateSet = new Set(withDate.map(c => c.installDate));
  const dates = [...dateSet].sort();

  if (dates.length === 0) return null;

  // 날짜+시간 매핑
  const scheduleMap = new Map<string, string[]>();
  withDate.forEach(c => {
    const time = TIME_SLOTS.includes(c.time) ? c.time : '미정';
    const key = `${c.installDate}__${time}`;
    const arr = scheduleMap.get(key) || [];
    arr.push(c.dong && c.ho ? `${c.dong}동${c.ho}호` : c.ho ? `${c.ho}호` : '');
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
                  return (
                    <td key={dt} style={{
                      textAlign: 'center',
                      padding: isMobile ? '3px 2px' : '4px 6px',
                      borderRight: '1px solid #E5E7EB',
                      background: hasData ? '#EFF6FF' : '#fff',
                      color: hasData ? '#1D4ED8' : '#999',
                      fontWeight: hasData ? 600 : 400,
                      fontSize: isMobile ? 10 : 12,
                      minWidth: DATE_COL_W,
                      lineHeight: isMobile ? '1.3' : '1.5',
                    }}>
                      {isMobile ? items.map((item, i) => (
                        <div key={i}>{item}</div>
                      )) : items.join(', ')}
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

export function GroupBuyPage() {
  const [customers, setCustomers] = useState<GroupBuyCustomer[]>(loadCustomers);
  const [currentPage, setCurrentPage] = useState(1);
  const { data: items = [] } = useItems();

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(customers.length / ITEMS_PER_PAGE));
  const pagedCustomers = customers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // 변경 시 자동 저장
  useEffect(() => {
    saveCustomers(customers);
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
  };

  const toggleField = (id: string, field: 'reserved' | 'completed' | 'deposited') => {
    setCustomers(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: !c[field] } : c)),
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">공동구매 고객 목록</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToExcel(customers)} className="gap-1">
            <Download className="h-4 w-4" />
            엑셀 다운로드
          </Button>
          <Button variant="outline" size="sm" onClick={addEmptyRow} className="gap-1">
            <Plus className="h-4 w-4" />
            리스트추가
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
                <tr key={c.id} className="border-t hover:bg-gray-50">
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
                    {c.amount ? c.amount.toLocaleString() : ''}
                  </td>
                  <td className="px-1 py-1 border-r">
                    <select
                      value={c.paymentMethod}
                      onChange={e => updateInline(c.id, 'paymentMethod', e.target.value)}
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
                  <td className="px-2 py-1.5 text-center border-r">
                    <input
                      type="checkbox"
                      checked={c.reserved}
                      onChange={() => toggleField(c.id, 'reserved')}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center border-r">
                    <input
                      type="checkbox"
                      checked={c.completed}
                      onChange={() => toggleField(c.id, 'completed')}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center border-r">
                    <input
                      type="checkbox"
                      checked={c.deposited}
                      onChange={() => toggleField(c.id, 'deposited')}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
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
      <DailyScheduleTable customers={customers} />

      {/* 시간대별 설치일정 */}
      <TimeSlotScheduleTable customers={customers} />

    </div>
  );
}
