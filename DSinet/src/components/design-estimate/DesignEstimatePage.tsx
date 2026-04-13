'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Save, FileSpreadsheet, Search, X, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getStoredValue, setStoredValue } from '@/lib/storage';
import { useItems } from '@/hooks/useItems';
import { useWorkTypes } from '@/hooks/useWorkTypes';
import { DiagramSheet, diagramToBase64, type DiagramData } from './DiagramSheet';
import type { Item } from '@/types';

/* ═══════════ Column Resize Hook ═══════════ */
function useColumnResize(initialWidths: number[], storageKey?: string) {
  const [colWidths, setColWidths] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === initialWidths.length) return parsed;
        }
      } catch { /* ignore */ }
    }
    return initialWidths;
  });
  const dragRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const diff = e.clientX - d.startX;
      const newW = Math.max(20, d.startW + diff);
      setColWidths(prev => {
        const a = [...prev];
        a[d.colIdx] = newW;
        return a;
      });
    };
    const onMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(colWidths));
  }, [colWidths, storageKey]);

  const startResize = (colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const colPx = colWidths.map(w => `${w}px`);
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  return { colPx, totalWidth, startResize };
}

const RH = ({ ci, sr }: { ci: number; sr: (ci: number, e: React.MouseEvent) => void }) => (
  <div onMouseDown={e => sr(ci, e)} style={{ position: 'absolute', right: -2, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1 }} />
);

/* ════════════════════════ Types ════════════════════════ */
interface LaborRate {
  id: string;
  type: string;       // 직종명 e.g. '전기공','배관공'
  category?: string;  // 직종분류 e.g. '통신', '전기'
  dailyRate: number;
  refCode?: string;   // 단가표번호 e.g. '통신노임-1'
}

interface Material {
  id: string;
  name: string;
  spec: string;
  unit: string;
  quote1: number;       // 단가견적1
  quote2: number;       // 단가견적2
  quote3: number;       // 단가견적3
  unitPrice: number;    // 적용단가
  quantity: number;
  matrixColId?: string; // 물량내역서 열 ID (자동 동기화용)
}

interface UnitCostRow {
  id: string;
  name: string;           // 품목명/직종명
  spec: string;           // 규격
  unit: string;           // 단위
  quantity: number;       // 수량
  matUnitPrice?: number;  // 재료비 단가
  matAmount?: number;     // 재료비 금액
  labUnitPrice?: number;  // 노무비 단가
  labAmount?: number;     // 노무비 금액
  memo?: string;          // 비고
}

interface UnitCost {
  id: string;
  workType: string;
  ref?: string;       // 참조번호 (e.g. 통신 4-3-3)
  rows: UnitCostRow[];
}

interface QuantityItem {
  id: string;
  workType: string;          // 일위대가 공종 참조
  location: string;          // 위치
  quantity: number;
  unit: string;
}

interface QtyMatCol {
  id: string;
  name: string;    // 품명
  spec: string;    // 규격
  unit: string;    // 단위
}

interface QtyMatRow {
  id: string;
  group: string;   // 구분
  location: string; // 위치
  values: Record<string, number>; // colId → 수량
}

interface QtyMatrix {
  cols: QtyMatCol[];
  rows: QtyMatRow[];
}

interface SummaryItem {
  id: string;
  category: string;   // 공종
  name: string;       // 품명
  spec: string;       // 규격
  unit: string;       // 단위
  quantity: number;   // 수량
  unitPrice: number;  // 단가
  memo?: string;      // 비고
}

interface DesignEstimateItem {
  id: string;
  category: 'material' | 'labor' | 'expense';
  name: string;
  spec: string;
  unit: string;
  quantity: number;        // 계산된 실제 수량
  quantityExpr?: string;  // 수량 입력 표현식
  unitPrice: number;      // 재료비 단가 (계산값)
  unitPriceExpr?: string; // 재료비 단가 입력 표현식 (% 지원)
  labUnitPrice?: number;  // 노무비 단가
  expUnitPrice?: number;  // 경비 단가
  expAmount?: number;     // 경비 금액 (수기 입력 시 우선 적용)
  memo?: string;          // 비고
  matrixColId?: string;   // 물량내역서 열 ID (자동 동기화용)
}

interface ProjectData {
  projectName: string;
  year: number;
  laborRates: LaborRate[];
  materials: Material[];
  unitCosts: UnitCost[];
  quantities: QuantityItem[];
  quantityMatrix?: QtyMatrix;
  summaryItems: SummaryItem[];
  estimateItems: DesignEstimateItem[];
  miscMatRate?: number; // 잡자재비 비율(%)
  profitRate?: number; // 이윤 비율(%)
  coverLogo?: string; // 표지: 로고 이미지 (data URL)
  diagramData?: DiagramData; // 구성도 데이터
}

const STORAGE_KEY = 'design_estimate';

type SheetTab = 'cover' | 'estimate' | 'cost-calc' | 'labor' | 'material' | 'unit-cost' | 'quantity' | 'summary' | 'diagram';

const SHEET_TABS: { id: SheetTab; label: string }[] = [
  { id: 'cover', label: '표지' },
  { id: 'cost-calc', label: '원가계산서' },
  { id: 'estimate', label: '설계내역서' },
  { id: 'unit-cost', label: '일위대가표' },
  { id: 'material', label: '자재단가표' },
  { id: 'labor', label: '노임단가표' },
  { id: 'summary', label: '산출집계표' },
  { id: 'quantity', label: '물량내역서' },
  { id: 'diagram', label: '구성도' },
];

function defaultProject(): ProjectData {
  return {
    projectName: '◯◯◯ 공사',
    year: new Date().getFullYear(),
    laborRates: [
      { id: crypto.randomUUID(), type: '보통인부', category: '일반', dailyRate: 172068 },
      { id: crypto.randomUUID(), type: '특별인부', category: '일반', dailyRate: 226122 },
      { id: crypto.randomUUID(), type: '통신내선공', category: '통신', dailyRate: 284880 },
      { id: crypto.randomUUID(), type: '통신설비공', category: '통신', dailyRate: 315528 },
      { id: crypto.randomUUID(), type: '통신케이블공', category: '통신', dailyRate: 436224 },
      { id: crypto.randomUUID(), type: '광케이블설치사', category: '통신', dailyRate: 471349 },
    ],
    materials: [
      { id: crypto.randomUUID(), name: 'PVC관', spec: 'Ø50mm', unit: 'm', quote1: 0, quote2: 0, quote3: 0, unitPrice: 3500, quantity: 0 },
    ],
    unitCosts: INITIAL_UNIT_COSTS,
    quantities: [],
    summaryItems: [],
    estimateItems: [],
    miscMatRate: 5,
    profitRate: 15,
  };
}

/* ─── Calculation engine: 원가계산서 ─── */
function calcCost(data: ProjectData) {
  // 설계내역서 전체 항목에서 재료비·노무비·경비 합산 (% 단가 실시간 계산)
  let matRunning = 0;
  let materialCost = 0;
  for (const item of data.estimateItems) {
    const expr = (item.unitPriceExpr ?? '').trim();
    let price: number;
    if (expr.endsWith('%')) {
      const pct = parseFloat(expr.slice(0, -1));
      price = isNaN(pct) ? 0 : Math.floor(matRunning * pct / 100 / (item.quantity || 1));
    } else {
      price = item.unitPrice;
    }
    materialCost += item.quantity * price;
    matRunning += item.quantity * price;
  }
  // 잡자재비 합산
  const miscRate = data.miscMatRate ?? 5;
  const miscMatCost = Math.floor(materialCost * miscRate / 100);
  materialCost += miscMatCost;

  const directLabor = data.estimateItems.reduce((s, i) => s + i.quantity * (i.labUnitPrice ?? 0), 0);
  const expenseDirect = data.estimateItems.reduce((s, i) => s + (i.expAmount != null ? i.expAmount : i.quantity * (i.expUnitPrice ?? 0)), 0);

  const indirectLabor = Math.floor(directLabor * 0.15);
  const totalLabor = directLabor + indirectLabor;
  const otherExpenses = Math.floor((materialCost + totalLabor) * 0.046);
  const pensionInsurance = 0; // 연금보험료 (해당시)
  const industrialAccident = Math.floor(totalLabor * 0.0356);
  const healthInsurance = 0; // 건강보험료 (해당시)
  const longTermCare = 0; // 노인장기요양보험료 (해당시)
  const safetyManagement = Math.floor((materialCost + directLabor) * 0.0207);
  const employmentInsurance = Math.floor(totalLabor * 0.0101);
  const asbestosFund = Math.floor(totalLabor * 0.00006); // 석면분담금
  const wageClaimBurden = Math.floor(totalLabor * 0.0009); // 임금채권부담금
  const totalExpenses = expenseDirect + otherExpenses + pensionInsurance + industrialAccident + healthInsurance + longTermCare + safetyManagement + employmentInsurance + asbestosFund + wageClaimBurden;
  const subtotal = materialCost + totalLabor + totalExpenses;
  const generalAdmin = Math.floor(subtotal * 0.08);
  const profitRate = data.profitRate ?? 15;
  const profit = Math.floor((totalLabor + totalExpenses + generalAdmin) * profitRate / 100);
  const totalCost = subtotal + generalAdmin + profit;
  const vat = Math.floor(totalCost * 0.1);
  const total = totalCost + vat;

  return {
    materialCost, directLabor, indirectLabor, totalLabor,
    otherExpenses, pensionInsurance, industrialAccident, healthInsurance, longTermCare,
    safetyManagement, employmentInsurance, asbestosFund, wageClaimBurden,
    totalExpenses, expenseDirect,
    generalAdmin, profit, totalCost, vat, total, subtotal,
  };
}

/* ─── 숫자 포맷 ─── */
const fmt = (n: number) => n.toLocaleString();

/* ─── 공유 Excel 파싱 유틸 ─── */
function readExcelFile(file: File): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        // 데이터가 있는 시트를 자동으로 찾기 (빈 시트 건너뜀)
        let rows: unknown[][] = [];
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          const r = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
          if (r.length > rows.length) rows = r;
        }
        resolve(rows);
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
function xCell(row: unknown[], idx: number): string {
  return idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';
}
function xNum(row: unknown[], idx: number): number {
  const v = parseInt(xCell(row, idx).replace(/[^0-9]/g, ''), 10);
  return isNaN(v) ? 0 : v;
}
function xFloat(row: unknown[], idx: number): number {
  const v = parseFloat(xCell(row, idx).replace(/[^0-9.]/g, ''));
  return isNaN(v) ? 0 : v;
}
function xFindCol(headerRow: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headerRow.findIndex(h => h === c.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}
function ExcelImportBtn({ label = '엑셀 불러오기', onFile }: { label?: string; onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <Button variant="outline" size="sm" className="gap-1" onClick={() => ref.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> {label}
      </Button>
    </>
  );
}

/* ─── % 포함 수량 입력 ─── */
function parseQuantityExpr(expr: string): number {
  const s = expr.trim();
  if (s.endsWith('%')) {
    const v = parseFloat(s.slice(0, -1));
    return isNaN(v) ? 0 : v / 100;
  }
  const v = parseFloat(s.replace(/,/g, ''));
  return isNaN(v) ? 0 : v;
}

function QuantityInput({ expr, onChange, className }: { expr: string; onChange: (expr: string, qty: number) => void; className?: string }) {
  const [localVal, setLocalVal] = useState(expr);
  useEffect(() => { setLocalVal(expr); }, [expr]);

  const computed = parseQuantityExpr(localVal);
  const isPercent = localVal.trim().endsWith('%');

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        className={cn('w-full px-2 py-1 border rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-300', isPercent ? 'bg-purple-50 text-purple-700' : '', className)}
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={() => onChange(localVal, parseQuantityExpr(localVal))}
        onKeyDown={e => { if (e.key === 'Enter') onChange(localVal, parseQuantityExpr(localVal)); }}
        placeholder="0 또는 50%"
      />
      {isPercent && (
        <span style={{ position: 'absolute', right: 4, bottom: -14, fontSize: 10, color: '#7e22ce', whiteSpace: 'nowrap' }}>
          = {computed % 1 === 0 ? computed : computed.toFixed(4)}
        </span>
      )}
    </div>
  );
}

function NumInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <input type="text" className={cn('w-full px-2 py-1 border rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-300', className)}
      value={value ? value.toLocaleString() : ''}
      onChange={e => {
        const v = e.target.value.replace(/[^0-9]/g, '');
        onChange(v ? parseInt(v, 10) : 0);
      }} />
  );
}

function DecimalInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [local, setLocal] = useState(value ? String(value) : '');
  useEffect(() => { setLocal(value ? String(value) : ''); }, [value]);
  return (
    <input type="text" className={cn('w-full px-2 py-1 border rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-300', className)}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { const v = parseFloat(local.replace(/[^0-9.]/g, '')); onChange(isNaN(v) ? 0 : v); }}
      onKeyDown={e => { if (e.key === 'Enter') { const v = parseFloat(local.replace(/[^0-9.]/g, '')); onChange(isNaN(v) ? 0 : v); } }}
    />
  );
}

function TextInput({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <input type="text" className={cn('w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300', className)}
      value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  );
}

/* ════════════════════ Sheet: 노임단가표 ════════════════════ */
function LaborSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = () => onChange({ laborRates: [...data.laborRates, { id: crypto.randomUUID(), type: '', category: '', dailyRate: 0, refCode: '' }] });
  const del = (id: string) => onChange({ laborRates: data.laborRates.filter(r => r.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ laborRates: data.laborRates.map(r => r.id === id ? { ...r, [field]: val } : r) });

  const handleExcel = async (file: File) => {
    try {
      const rows = await readExcelFile(file);
      if (rows.length < 1) { alert('데이터가 없습니다.'); return; }
      const h = rows[0].map(c => String(c ?? '').trim().toLowerCase());
      const hasHeader = ['직종분류', '분류', '단가', '단가표번호'].some(k => h.includes(k));
      const dataRows = hasHeader ? rows.slice(1) : rows;
      let catIdx  = xFindCol(h, '직종분류', '분류', 'category');    if (catIdx  < 0) catIdx  = 0;
      let rateIdx = xFindCol(h, '단가', '일당', '일당(원)', 'rate'); if (rateIdx < 0) rateIdx = 1;
      let refIdx  = xFindCol(h, '단가표번호', '번호', 'refcode');    if (refIdx  < 0) refIdx  = 2;
      const added = dataRows
        .map(row => ({
          id: crypto.randomUUID(),
          category: xCell(row, catIdx),
          type: '',
          dailyRate: xNum(row, rateIdx),
          refCode: xCell(row, refIdx),
        }))
        .filter(r => r.category || r.dailyRate > 0);
      if (added.length === 0) { alert('데이터를 찾을 수 없습니다.'); return; }
      onChange({ laborRates: [...data.laborRates, ...added] });
      alert(`${added.length}개 직종이 추가되었습니다.`);
    } catch { alert('엑셀 파일을 읽는 중 오류가 발생했습니다.'); }
  };

  const { colPx: lbPcts, totalWidth: lbTotalW, startResize: lbResize } = useColumnResize([40, 150, 150, 150, 50], 'de-col-labor');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">노임단가표 ({data.year}년)</h3>
        <div className="flex gap-2 no-print">
          <ExcelImportBtn onFile={handleExcel} />
          <Button variant="outline" size="sm" className="gap-1" onClick={add}><Plus className="h-3.5 w-3.5" /> 추가</Button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">헤더 구성: <span className="font-mono bg-gray-100 px-1 rounded">직종분류 | 단가(원) | 단가표번호</span></p>
      <div className="overflow-x-auto">
      <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: `${lbTotalW}px`, minWidth: '100%' }}>
        <colgroup>{lbPcts.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr className="bg-gray-100 border">
            <th className="border p-2 relative">No<RH ci={0} sr={lbResize} /></th>
            <th className="border p-2 relative">직종분류<RH ci={1} sr={lbResize} /></th>
            <th className="border p-2 relative">단가(원)<RH ci={2} sr={lbResize} /></th>
            <th className="border p-2 relative">단가표번호<RH ci={3} sr={lbResize} /></th>
            <th className="border p-2 no-print"></th>
          </tr>
        </thead>
        <tbody>
          {data.laborRates.map((r, i) => (
            <tr key={r.id} className="border hover:bg-gray-50">
              <td className="border p-1 text-center text-gray-500">{i + 1}</td>
              <td className="border p-1"><TextInput value={r.category ?? ''} onChange={v => upd(r.id, 'category', v)} placeholder="통신설비공" /></td>
              <td className="border p-1"><NumInput value={r.dailyRate} onChange={v => upd(r.id, 'dailyRate', v)} /></td>
              <td className="border p-1"><TextInput value={r.refCode ?? ''} onChange={v => upd(r.id, 'refCode', v)} placeholder="통신노임-1" /></td>
              <td className="border p-1 text-center no-print">
                <button className="text-red-500 hover:text-red-700" onClick={() => del(r.id)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/* ════════════════════ Sheet: 자재단가표 ════════════════════ */
function MaterialSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = () => onChange({ materials: [...data.materials, { id: crypto.randomUUID(), name: '', spec: '', unit: '개', quote1: 0, quote2: 0, quote3: 0, unitPrice: 0, quantity: 0 }] });
  const del = (id: string) => onChange({ materials: data.materials.filter(m => m.id !== id) });
  const upd = (id: string, field: string, val: string | number) => {
    const newMats = data.materials.map(m => m.id === id ? { ...m, [field]: val } : m);
    const partial: Partial<ProjectData> = { materials: newMats };
    // 적용단가 변경 시 설계내역서 재료비 단가 자동 반영
    if (field === 'unitPrice') {
      const mat = newMats.find(m => m.id === id);
      if (mat) {
        partial.estimateItems = data.estimateItems.map(e =>
          (mat.matrixColId && e.matrixColId === mat.matrixColId) || e.name === mat.name
            ? { ...e, unitPrice: Number(val), unitPriceExpr: undefined } : e
        );
      }
    }
    onChange(partial);
  };

  const handleExcel = async (file: File) => {
    try {
      const rows = await readExcelFile(file);
      if (rows.length < 1) { alert('데이터가 없습니다.'); return; }
      const h = rows[0].map(c => String(c ?? '').trim().toLowerCase());
      const hasHeader = ['품명', '자재명', '자재', '단가'].some(k => h.includes(k));
      const dataRows = hasHeader ? rows.slice(1) : rows;
      let nameIdx  = xFindCol(h, '품명', '자재명', '자재', 'name');      if (nameIdx  < 0) nameIdx  = 0;
      let specIdx  = xFindCol(h, '규격', 'spec');                               if (specIdx  < 0) specIdx  = 1;
      let unitIdx  = xFindCol(h, '단위', 'unit');                               if (unitIdx  < 0) unitIdx  = 2;
      let q1Idx    = xFindCol(h, '단가견적1', '견적단가1', 'quote1');       if (q1Idx    < 0) q1Idx    = 3;
      let q2Idx    = xFindCol(h, '단가견적2', '견적단가2', 'quote2');       if (q2Idx    < 0) q2Idx    = 4;
      let q3Idx    = xFindCol(h, '단가견적3', '곬적단가3', 'quote3');       if (q3Idx    < 0) q3Idx    = 5;
      let priceIdx = xFindCol(h, '적용단가', '단가', '단가(원)', 'price'); if (priceIdx < 0) priceIdx = 6;
      let qtyIdx   = xFindCol(h, '수량', 'qty', 'quantity');                    if (qtyIdx   < 0) qtyIdx   = 7;
      const added = dataRows
        .map(row => ({
          id: crypto.randomUUID(),
          name: xCell(row, nameIdx),
          spec: xCell(row, specIdx),
          unit: xCell(row, unitIdx) || '개',
          quote1: xNum(row, q1Idx),
          quote2: xNum(row, q2Idx),
          quote3: xNum(row, q3Idx),
          unitPrice: xNum(row, priceIdx),
          quantity: xFloat(row, qtyIdx),
        }))
        .filter(r => r.name);
      if (added.length === 0) { alert('품명 데이터를 찾을 수 없습니다.'); return; }
      onChange({ materials: [...data.materials, ...added] });
      alert(`${added.length}개 자재가 추가되었습니다.`);
    } catch { alert('엑셀 파일을 읽는 중 오류가 발생했습니다.'); }
  };

  const { colPx: mtPcts, totalWidth: mtTotalW, startResize: mtResize } = useColumnResize([40, 150, 250, 56, 100, 100, 100, 112, 48], 'de-col-material');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">자재단가표</h3>
        <div className="flex gap-2 no-print">
          <ExcelImportBtn onFile={handleExcel} />
          <Button variant="outline" size="sm" className="gap-1" onClick={add}><Plus className="h-3.5 w-3.5" /> 추가</Button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">헤더 구성: <span className="font-mono bg-gray-100 px-1 rounded">품명 | 규격 | 단위 | 단가견적1 | 단가견적2 | 단가견적3 | 적용단가</span></p>
      <div className="overflow-x-auto">
      <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: `${mtTotalW}px`, minWidth: '100%' }}>
        <colgroup>{mtPcts.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2 align-middle relative" rowSpan={2}>연번<RH ci={0} sr={mtResize} /></th>
            <th className="border p-2 align-middle relative" rowSpan={2}>품명<RH ci={1} sr={mtResize} /></th>
            <th className="border p-2 align-middle relative" rowSpan={2}>규격<RH ci={2} sr={mtResize} /></th>
            <th className="border p-2 align-middle relative text-center" rowSpan={2}>단위<RH ci={3} sr={mtResize} /></th>
            <th className="border p-2 text-center" colSpan={3}>비교 견적</th>
            <th className="border p-2 align-middle relative" rowSpan={2}>적용단가<RH ci={7} sr={mtResize} /></th>
            <th className="border p-2 no-print align-middle" rowSpan={2}></th>
          </tr>
          <tr className="bg-gray-100">
            <th className="border p-2 relative">견적1<RH ci={4} sr={mtResize} /></th>
            <th className="border p-2 relative">견적2<RH ci={5} sr={mtResize} /></th>
            <th className="border p-2 relative">견적3<RH ci={6} sr={mtResize} /></th>
          </tr>
        </thead>
        <tbody>
          {data.materials.map((m, i) => (
            <tr key={m.id} className="border hover:bg-gray-50">
              <td className="border p-1 text-center text-gray-500">{i + 1}</td>
              <td className="border p-1">
                <TextInput value={m.name} onChange={v => upd(m.id, 'name', v)} />
              </td>
              <td className="border p-1"><TextInput value={m.spec} onChange={v => upd(m.id, 'spec', v)} /></td>
              <td className="border p-1 text-center"><TextInput value={m.unit} onChange={v => upd(m.id, 'unit', v)} className="text-center" /></td>
              <td className="border p-1">
                <div className="relative group">
                  <NumInput value={m.quote1 ?? 0} onChange={v => upd(m.id, 'quote1', v)} className="group-hover:pr-8" />
                  {(m.quote1 ?? 0) > 0 && (
                    <button
                      title="적용단가로 설정"
                      onClick={() => upd(m.id, 'unitPrice', m.quote1 ?? 0)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] leading-none px-1 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >적용</button>
                  )}
                </div>
              </td>
              <td className="border p-1">
                <div className="relative group">
                  <NumInput value={m.quote2 ?? 0} onChange={v => upd(m.id, 'quote2', v)} className="group-hover:pr-8" />
                  {(m.quote2 ?? 0) > 0 && (
                    <button
                      title="적용단가로 설정"
                      onClick={() => upd(m.id, 'unitPrice', m.quote2 ?? 0)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] leading-none px-1 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >적용</button>
                  )}
                </div>
              </td>
              <td className="border p-1">
                <div className="relative group">
                  <NumInput value={m.quote3 ?? 0} onChange={v => upd(m.id, 'quote3', v)} className="group-hover:pr-8" />
                  {(m.quote3 ?? 0) > 0 && (
                    <button
                      title="적용단가로 설정"
                      onClick={() => upd(m.id, 'unitPrice', m.quote3 ?? 0)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] leading-none px-1 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >적용</button>
                  )}
                </div>
              </td>
              <td className="border p-1"><NumInput value={m.unitPrice} onChange={v => upd(m.id, 'unitPrice', v)} /></td>
              <td className="border p-1 text-center no-print">
                <button className="text-red-500 hover:text-red-700" onClick={() => del(m.id)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/* ════════════════════ Sheet: 일위대가표 ════════════════════ */

const INITIAL_UNIT_COSTS: UnitCost[] = [
  { id: 'uc-01', workType: '통신랙', ref: '통신 4-3-3',
    rows: [{ id: 'r-01-1', name: '통신설비공', spec: '', unit: '인', quantity: 0.48, labUnitPrice: 315528 }] },
  { id: 'uc-02', workType: '구내광섬유케이블', ref: '통신 4-1-3',
    rows: [
      { id: 'r-02-1', name: '광케이블설치사', spec: '', unit: '인', quantity: 0.0092, labUnitPrice: 471349 },
      { id: 'r-02-2', name: '특별인부', spec: '', unit: '인', quantity: 0.0046, labUnitPrice: 226122 },
    ] },
  { id: 'uc-03', workType: '광분배함(반) 및 성단 등', ref: '통신 4-1-2-2',
    rows: [
      { id: 'r-03-1', name: '통신설비공', spec: '', unit: '인', quantity: 0.09, labUnitPrice: 315528 },
      { id: 'r-03-2', name: '보통인부', spec: '', unit: '인', quantity: 0.09, labUnitPrice: 172068 },
    ] },
  { id: 'uc-04', workType: '구내광섬유케이블(성단)', ref: '통신 4-1-3',
    rows: [
      { id: 'r-04-1', name: '광케이블설치사', spec: '', unit: '인', quantity: 0.06, labUnitPrice: 471349 },
      { id: 'r-04-2', name: '특별인부', spec: '', unit: '인', quantity: 0.05, labUnitPrice: 226122 },
    ] },
  { id: 'uc-05', workType: '광점퍼코드 포설(40M)', ref: '통신 4-1-3',
    rows: [
      { id: 'r-05-1', name: '광케이블설치사', spec: '', unit: '인', quantity: 0.28, labUnitPrice: 471349 },
      { id: 'r-05-2', name: '특별인부', spec: '', unit: '인', quantity: 0.32, labUnitPrice: 226122 },
    ] },
  { id: 'uc-06', workType: '광점퍼코드 포설(30M)', ref: '통신 4-1-3',
    rows: [
      { id: 'r-06-1', name: '광케이블설치사', spec: '', unit: '인', quantity: 0.21, labUnitPrice: 471349 },
      { id: 'r-06-2', name: '특별인부', spec: '', unit: '인', quantity: 0.24, labUnitPrice: 226122 },
    ] },
  { id: 'uc-07', workType: '광점퍼코드 포설(10M)', ref: '통신 4-1-3',
    rows: [
      { id: 'r-07-1', name: '광케이블설치사', spec: '', unit: '인', quantity: 0.07, labUnitPrice: 471349 },
      { id: 'r-07-2', name: '특별인부', spec: '', unit: '인', quantity: 0.08, labUnitPrice: 226122 },
    ] },
  { id: 'uc-08', workType: '꼬임케이블 포설', ref: '통신 4-3-1',
    rows: [{ id: 'r-08-1', name: '통신케이블공', spec: '', unit: '인', quantity: 0.015, labUnitPrice: 436224 }] },
  { id: 'uc-09', workType: '커넥터 및 Jack 접속', ref: '통신 4-3-2',
    rows: [{ id: 'r-09-1', name: '통신내선공', spec: '', unit: '인', quantity: 0.013, labUnitPrice: 284880 }] },
  { id: 'uc-10', workType: '구내통신배관', ref: '통신 3-1-1',
    rows: [{ id: 'r-10-1', name: '통신내선공', spec: '', unit: '인', quantity: 0.06, labUnitPrice: 284880 }] },
  { id: 'uc-11', workType: '몰딩', ref: '통신 3-5-3',
    rows: [{ id: 'r-11-1', name: '통신내선공', spec: '', unit: '인', quantity: 0.025, labUnitPrice: 284880 }] },
];

function UnitCostSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const addUC = () => onChange({
    unitCosts: [...data.unitCosts, { id: crypto.randomUUID(), workType: '', ref: '', rows: [] }]
  });
  const delUC = (id: string) => onChange({ unitCosts: data.unitCosts.filter(u => u.id !== id) });
  const updUC = (id: string, partial: Partial<UnitCost>) =>
    onChange({ unitCosts: data.unitCosts.map(u => u.id === id ? { ...u, ...partial } : u) });

  // 노임단가 검색 팝업 상태
  const [laborSearch, setLaborSearch] = useState<{
    ucId: string; ri: number;
  } | null>(null);
  const [laborQuery, setLaborQuery] = useState('');

  const filteredRates = laborQuery.trim()
    ? data.laborRates.filter(r => r.type.includes(laborQuery) || (r.category ?? '').includes(laborQuery))
    : data.laborRates;

  // 자재단가 검색 팝업 상태
  const [matSearch, setMatSearch] = useState<{ ucId: string; ri: number } | null>(null);
  const [matQuery, setMatQuery] = useState('');
  const filteredMats = matQuery.trim()
    ? data.materials.filter(m => m.name.includes(matQuery) || m.spec.includes(matQuery))
    : data.materials;

  // 작업종별 검색 팝업 상태
  const [workTypeSearch, setWorkTypeSearch] = useState<{ ucId: string; ri?: number } | null>(null);
  const [workTypeQuery, setWorkTypeQuery] = useState('');
  const { data: workTypeList = [] } = useWorkTypes();
  const filteredWorkTypes = workTypeQuery.trim()
    ? workTypeList.filter(w => w.name.includes(workTypeQuery) || (w.memo ?? '').includes(workTypeQuery))
    : workTypeList;

  const handleExcel = async (file: File) => {
    try {
      const rows = await readExcelFile(file);
      const newUnitCosts: UnitCost[] = [];
      let current: UnitCost | null = null;
      for (const row of rows) {
        const colA = xCell(row, 0);
        const colB = xCell(row, 1);
        const colC = xCell(row, 2);
        const colD = xCell(row, 3);
        if (['계', '합계', '소계', '합  계', '소  계'].includes(colB.trim())) continue;
        if (!colA && !colB && !colC) continue;
        const aNum = Number(colA.replace(/[^0-9]/g, ''));
        if (colA !== '' && !isNaN(aNum) && aNum > 0 && colB.trim() !== '') {
          current = { id: crypto.randomUUID(), workType: colB.trim(), ref: '', rows: [] };
          newUnitCosts.push(current);
          continue;
        }
        if (!current) continue;
        if (colD.trim() === '인') {
          const laborName = colC.trim();
          const qty = xFloat(row, 4);
          const unitPrice = xNum(row, 7);
          if (laborName) current.rows.push({ id: crypto.randomUUID(), name: laborName, spec: '', unit: '인', quantity: qty, labUnitPrice: unitPrice });
        } else if (colB.trim() !== '' && xNum(row, 7) > 0) {
          current.rows.push({ id: crypto.randomUUID(), name: colB.trim(), spec: colC.trim(), unit: colD.trim() || '개', quantity: xFloat(row, 4), matUnitPrice: xNum(row, 7) });
        }
      }
      if (newUnitCosts.length === 0) { alert('공종 데이터를 찾을 수 없습니다.'); return; }
      onChange({ unitCosts: [...data.unitCosts, ...newUnitCosts] });
      alert(`${newUnitCosts.length}개 공종이 추가되었습니다.`);
    } catch { alert('엑셀 파일을 읽는 중 오류가 발생했습니다.'); }
  };

  // 하단 요약 계산 (재료 행 수량을 노무비 승수로 사용)
  const calcUcTotals = (uc: UnitCost) => {
    const rows = uc.rows ?? [];
    // 첫 번째 비-인 행(재료 행)의 수량을 승수로 사용
    const matRow = rows.find(r => r.unit !== '인');
    const multiplier = (matRow && matRow.quantity > 0) ? matRow.quantity : 1;
    const mat = rows.reduce((s, r) => s + Math.floor(r.matAmount ?? (r.matUnitPrice ?? 0) * r.quantity), 0);
    // 노무비: 행별로 (단가 × 수량 × 승수) 절삭 후 합산
    const lab = rows.filter(r => r.unit === '인').reduce((s, r) => s + Math.floor((r.labAmount ?? (r.labUnitPrice ?? 0) * r.quantity) * multiplier), 0);
    return { mat: mat * multiplier, lab, multiplier };
  };
  const totalMaterial = data.unitCosts.reduce((s, uc) => s + calcUcTotals(uc).mat, 0);
  const directLabor = data.unitCosts.reduce((s, uc) => s + calcUcTotals(uc).lab, 0);
  const indirectLabor = Math.floor(directLabor * 0.15);
  const totalLabor = directLabor + indirectLabor;
  const otherExp = Math.floor((totalMaterial + totalLabor) * 0.046);
  const accident = Math.floor(totalLabor * 0.0356);
  const safety = Math.floor((totalMaterial + directLabor) * 0.0207);
  const employment = Math.floor(totalLabor * 0.0101);
  const totalExpense = otherExp + accident + safety + employment;
  const subtotal = totalMaterial + totalLabor + totalExpense;
  const generalAdmin = Math.floor(subtotal * 0.08);
  const profit = Math.floor((totalLabor + totalExpense + generalAdmin) * 0.15);
  const totalCost = subtotal + generalAdmin + profit;
  const vat = Math.floor(totalCost * 0.1);
  const grandTotal = totalCost + vat;

  const thStyle = 'border border-gray-400 p-1 text-center align-middle bg-gray-100 text-xs font-bold relative';
  const tdStyle = 'border border-gray-300 p-1 text-sm';
  const { colPx: ucPcts, totalWidth: ucTotalW, startResize: ucResize } = useColumnResize([60, 170, 130, 48, 60, 90, 100, 90, 100, 100, 32], 'de-col-unitcost');

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">일위대가표</h3>
        <div className="flex gap-2 no-print">
          <ExcelImportBtn onFile={handleExcel} />
          <Button variant="outline" size="sm" className="gap-1" onClick={addUC}><Plus className="h-3.5 w-3.5" /> 공종 추가</Button>
        </div>
      </div>

      {data.unitCosts.length === 0 && <p className="text-gray-400 text-center py-8">공종을 추가하세요.</p>}

      <div className="overflow-x-auto">
      <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', borderColor: '#999', width: `${ucTotalW}px`, minWidth: '100%' }}>
        <colgroup>{ucPcts.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        {/* ── 2단 헤더 ── */}
        <thead>
          <tr>
            <th className={thStyle} rowSpan={2}>연번<RH ci={0} sr={ucResize} /></th>
            <th className={thStyle} rowSpan={2}>작업종별<RH ci={1} sr={ucResize} /></th>
            <th className={thStyle} rowSpan={2}>규&nbsp;&nbsp;격<RH ci={2} sr={ucResize} /></th>
            <th className={thStyle} rowSpan={2}>단위<RH ci={3} sr={ucResize} /></th>
            <th className={thStyle} rowSpan={2}>수&nbsp;량<RH ci={4} sr={ucResize} /></th>
            <th className={thStyle} colSpan={2}>재&nbsp;료&nbsp;비</th>
            <th className={thStyle} colSpan={2}>노&nbsp;무&nbsp;비</th>
            <th className={thStyle} rowSpan={2}>비&nbsp;고<RH ci={9} sr={ucResize} /></th>
            <th className={`${thStyle} no-print`} rowSpan={2}></th>
          </tr>
          <tr>
            <th className={thStyle}>단&nbsp;가<RH ci={5} sr={ucResize} /></th>
            <th className={thStyle}>금&nbsp;액<RH ci={6} sr={ucResize} /></th>
            <th className={thStyle}>단&nbsp;가<RH ci={7} sr={ucResize} /></th>
            <th className={thStyle}>금&nbsp;액<RH ci={8} sr={ucResize} /></th>
          </tr>
        </thead>
        <tbody>
          {data.unitCosts.map((uc, i) => {
            const { mat: matTotal, lab: laborTotal, multiplier } = calcUcTotals(uc);
            const matUnit = (uc.rows ?? []).reduce((s, r) => s + Math.floor(r.matAmount ?? (r.matUnitPrice ?? 0) * r.quantity), 0);
            const labUnit = (uc.rows ?? []).filter(r => r.unit === '인').reduce((s, r) => s + Math.floor(r.labAmount ?? (r.labUnitPrice ?? 0) * r.quantity), 0);
            return (
              <React.Fragment key={uc.id}>
                {/* ── 공종 헤더 행 ── */}
                <tr style={{ background: '#fffbe6' }}>
                  <td className={`${tdStyle} text-center font-bold text-xs`}>
                    제{i + 1}호표
                  </td>
                  <td className={tdStyle} colSpan={4}>
                    <div className="flex items-center gap-1">
                      <TextInput value={uc.workType} onChange={v => updUC(uc.id, { workType: v })} placeholder="공종명" className="font-bold" />
                      <button
                        className="shrink-0 text-gray-400 hover:text-purple-600"
                        title="작업종별 검색"
                        onClick={() => { setWorkTypeQuery(''); setWorkTypeSearch({ ucId: uc.id }); }}
                      ><Search className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                  <td className={tdStyle} colSpan={4}></td>
                  <td className={tdStyle}>
                    <TextInput value={uc.ref ?? ''} onChange={v => updUC(uc.id, { ref: v })} placeholder="통신 4-3-3" className="text-xs text-gray-500" />
                  </td>
                  <td className={`${tdStyle} text-center no-print`}>
                    <button className="text-red-400 hover:text-red-600 text-xs" onClick={() => delUC(uc.id)}>✕</button>
                  </td>
                </tr>

                {/* ── 통합 행들 ── */}
                {(uc.rows ?? []).map((row, ri) => {
                  const ucRows = uc.rows ?? [];
                  // 노무비 행이면 재료 행 수량(승수)을 금액에 반영
                  const isLabor = row.unit === '인';
                  const labAmt = isLabor
                    ? Math.floor((row.labUnitPrice ?? 0) * row.quantity * multiplier)
                    : Math.floor((row.labUnitPrice ?? 0) * row.quantity);
                  const matAmt = Math.floor((row.matUnitPrice ?? 0) * row.quantity);
                  // 개별 행 표시 금액은 floor, 합계는 raw 합산 후 floor
                  return (
                  <tr key={`row-${ri}`} className="hover:bg-gray-50">
                    <td className={`${tdStyle} text-center text-gray-400`}>{ri + 1}</td>
                    <td className={tdStyle}>
                      <div className="flex items-center gap-1">
                        <TextInput value={row.name} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, name: v }; updUC(uc.id, { rows: nr }); }} placeholder="품목명" />
                        <button
                          className="shrink-0 text-gray-400 hover:text-purple-600"
                          title="작업종별에서 검색"
                          onClick={() => { setWorkTypeQuery(''); setWorkTypeSearch({ ucId: uc.id, ri }); }}
                        ><Search className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                    <td className={tdStyle}>
                      <div className="flex items-center gap-1">
                        <TextInput value={row.spec} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, spec: v }; updUC(uc.id, { rows: nr }); }} />
                        <button
                          className="shrink-0 text-gray-400 hover:text-blue-600"
                          title="노임단가표에서 선택"
                          onClick={() => { setLaborQuery(''); setLaborSearch({ ucId: uc.id, ri }); }}
                        ><Search className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                    <td className={`${tdStyle} text-center`}>
                      <TextInput value={row.unit} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, unit: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={`${tdStyle} text-right`}>
                      <DecimalInput value={row.quantity} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, quantity: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={tdStyle}>
                      <NumInput value={row.matUnitPrice ?? 0} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, matUnitPrice: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={tdStyle}>
                      <NumInput value={row.matAmount ?? matAmt} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, matAmount: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={tdStyle}>
                      <NumInput value={row.labUnitPrice ?? 0} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, labUnitPrice: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={tdStyle}>
                      <NumInput value={row.labAmount ?? labAmt} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, labAmount: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={tdStyle}>
                      <TextInput value={row.memo ?? ''} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, memo: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={`${tdStyle} text-center no-print`}>
                      <button className="text-red-400 hover:text-red-600" onClick={() => { const nr = ucRows.filter((_, ii) => ii !== ri); updUC(uc.id, { rows: nr }); }}>✕</button>
                    </td>
                  </tr>
                  );
                })}
                {/* ── 합계 행 ── */}
                <tr style={{ background: '#e8f0fe', borderTop: '2px solid #aaa' }}>
                  <td className={`${tdStyle} text-center font-bold text-xs`} style={{ background: '#dce8fb' }}>합계</td>
                  <td className={`${tdStyle} font-bold text-xs text-center`} colSpan={4} style={{ background: '#dce8fb' }}>{multiplier > 1 ? `${multiplier} × 단가` : '재료비 + 노무비'}</td>
                  <td className={`${tdStyle} text-right pr-2 font-bold text-xs text-gray-500`}>소계</td>
                  <td className={`${tdStyle} text-right pr-2 font-bold text-green-800`}>{fmt(matTotal)}</td>
                  <td className={`${tdStyle} text-right pr-2 font-bold text-xs text-gray-500`}>소계</td>
                  <td className={`${tdStyle} text-right pr-2 font-bold text-blue-800`}>{fmt(laborTotal)}</td>
                  <td className={`${tdStyle} text-right pr-2 font-extrabold text-purple-800`} style={{ background: '#f0eaff' }}>{fmt(matTotal + laborTotal)}</td>
                  <td className="border border-gray-300 no-print"></td>
                </tr>
                {/* 추가 버튼 행 */}
                <tr className="no-print">
                  <td colSpan={11} className="border border-gray-200 p-0.5 text-center">
                    <button className="text-xs text-gray-700 border border-gray-300 rounded px-3 py-0.5 hover:bg-gray-50" onClick={() => updUC(uc.id, { rows: [...(uc.rows ?? []), { id: crypto.randomUUID(), name: '', spec: '', unit: '', quantity: 0 }] })}>+ 추가</button>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* 하단 고정 요약바 */}

      {/* 노임단가 검색 팝업 */}
      {laborSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setLaborSearch(null)}>
          <div className="bg-white rounded-lg shadow-xl w-96 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h4 className="font-bold text-sm">노임단가표 선택</h4>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setLaborSearch(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="px-3 py-2 border-b">
              <input
                autoFocus
                type="text"
                placeholder="직종명 검색..."
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={laborQuery}
                onChange={e => setLaborQuery(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredRates.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-6">검색 결과가 없습니다.</p>
              )}
              {filteredRates.map(lr => (
                <button
                  key={lr.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 text-sm"
                  onClick={() => {
                    const { ucId, ri } = laborSearch;
                    const uc = data.unitCosts.find(u => u.id === ucId);
                    if (!uc) return;
                    const nr = [...(uc.rows ?? [])];
                    nr[ri] = { ...nr[ri], spec: lr.type, unit: '인', labUnitPrice: lr.dailyRate };
                    updUC(ucId, { rows: nr });
                    setLaborSearch(null);
                  }}
                >
                  <span className="font-medium text-black">{lr.type}</span>
                  {lr.category && <span className="text-gray-500 text-xs ml-2">{lr.category}</span>}
                  <span className="float-right text-black font-bold">{lr.dailyRate.toLocaleString()}원</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 자재단가 검색 팝업 */}
      {matSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMatSearch(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[28rem] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h4 className="font-bold text-sm">자재단가표 선택</h4>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setMatSearch(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="px-3 py-2 border-b">
              <input
                autoFocus
                type="text"
                placeholder="자재명 또는 규격 검색..."
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                value={matQuery}
                onChange={e => setMatQuery(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredMats.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-6">검색 결과가 없습니다.</p>
              )}
              {filteredMats.map(mat => (
                <button
                  key={mat.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-green-50 border-b border-gray-100 text-sm"
                  onClick={() => {
                    const { ucId, ri } = matSearch;
                    const uc = data.unitCosts.find(u => u.id === ucId);
                    if (!uc) return;
                    const nr = [...(uc.rows ?? [])];
                    nr[ri] = { ...nr[ri], name: mat.name, spec: mat.spec, unit: mat.unit, matUnitPrice: mat.unitPrice };
                    updUC(ucId, { rows: nr });
                    setMatSearch(null);
                  }}
                >
                  <span className="font-medium text-black">{mat.name}</span>
                  <span className="text-gray-500 text-xs ml-2">{mat.spec}</span>
                  <span className="text-gray-400 text-xs ml-1">({mat.unit})</span>
                  <span className="float-right text-green-700 font-bold">{mat.unitPrice.toLocaleString()}원</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 작업종별 검색 팝업 */}
      {workTypeSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setWorkTypeSearch(null)}>
          <div className="bg-white rounded-lg shadow-xl w-96 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h4 className="font-bold text-sm">작업종별 선택</h4>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setWorkTypeSearch(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="px-3 py-2 border-b">
              <input
                autoFocus
                type="text"
                placeholder="작업종별명 검색..."
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                value={workTypeQuery}
                onChange={e => setWorkTypeQuery(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredWorkTypes.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-6">검색 결과가 없습니다.</p>
              )}
              {filteredWorkTypes.map(wt => (
                <button
                  key={wt.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-purple-50 border-b border-gray-100 text-sm"
                  onClick={() => {
                    const { ucId, ri } = workTypeSearch;
                    if (ri != null) {
                      // 행 레벨: 품목명/규격/단위/단가 반영
                      const uc = data.unitCosts.find(u => u.id === ucId);
                      if (!uc) return;
                      const nr = [...(uc.rows ?? [])];
                      nr[ri] = { ...nr[ri], name: wt.name, spec: wt.spec ?? '', unit: wt.unit ?? nr[ri].unit, matUnitPrice: wt.price > 0 ? wt.price : (nr[ri].matUnitPrice ?? 0) };
                      updUC(ucId, { rows: nr });
                    } else {
                      // 공종 헤더 레벨
                      updUC(ucId, { workType: wt.name });
                    }
                    setWorkTypeSearch(null);
                  }}
                >
                  <span className="font-medium text-black">{wt.name}</span>
                  {wt.spec && <span className="text-gray-500 text-xs ml-2">{wt.spec}</span>}
                  {wt.price > 0 && <span className="float-right text-purple-700 font-bold">{wt.price.toLocaleString()}원</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20 py-2 px-4 no-print">
        <div className="grid grid-cols-6 gap-2 text-center max-w-screen-xl mx-auto text-xs">
          <div className="bg-green-50 rounded p-2"><div className="text-green-600 font-medium">재료비</div><div className="font-bold text-green-800 text-sm">{fmt(totalMaterial)}</div></div>
          <div className="bg-blue-50 rounded p-2"><div className="text-blue-600 font-medium">노무비</div><div className="font-bold text-blue-800 text-sm">{fmt(totalLabor)}</div></div>
          <div className="bg-orange-50 rounded p-2"><div className="text-orange-600 font-medium">경비</div><div className="font-bold text-orange-800 text-sm">{fmt(totalExpense)}</div></div>
          <div className="bg-yellow-50 rounded p-2"><div className="text-yellow-600 font-medium">총원가</div><div className="font-bold text-yellow-800 text-sm">{fmt(totalCost)}</div></div>
          <div className="bg-gray-50 rounded p-2"><div className="text-gray-600 font-medium">부가세</div><div className="font-bold text-gray-800 text-sm">{fmt(vat)}</div></div>
          <div className="bg-purple-50 rounded p-2"><div className="text-purple-600 font-medium">도급공사비</div><div className="font-bold text-purple-800 text-sm">{fmt(grandTotal)}</div></div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Sheet: 물량내역서 ════════════════════ */
const DEFAULT_QTY_ROWS = 10;
function makeDefaultMatrix(): QtyMatrix {
  const rows: QtyMatRow[] = Array.from({ length: DEFAULT_QTY_ROWS }, () => ({
    id: crypto.randomUUID(), group: '', location: '', values: {},
  }));
  return { cols: [], rows };
}

function QuantitySheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const needsDefault = !data.quantityMatrix || data.quantityMatrix.rows.length === 0;
  const matrix: QtyMatrix = needsDefault ? makeDefaultMatrix() : data.quantityMatrix!;
  const [searchColId, setSearchColId] = useState<string | null>(null);

  // 최초 로드 시 quantityMatrix가 없거나 행이 0개이면 기본 8행 저장
  useEffect(() => {
    if (!data.quantityMatrix || data.quantityMatrix.rows.length === 0) {
      onChange({ quantityMatrix: makeDefaultMatrix() });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setMatrix = (m: QtyMatrix) => {
    onChange({ quantityMatrix: m });
  };

  /* 열(자재) 추가/삭제 */
  const addCol = () => {
    const col: QtyMatCol = { id: crypto.randomUUID(), name: '', spec: '', unit: '' };
    setMatrix({ ...matrix, cols: [...matrix.cols, col], rows: matrix.rows.map(r => ({ ...r, values: { ...r.values, [col.id]: 0 } })) });
  };
  const delCol = (colId: string) => {
    setMatrix({
      cols: matrix.cols.filter(c => c.id !== colId),
      rows: matrix.rows.map(r => { const v = { ...r.values }; delete v[colId]; return { ...r, values: v }; }),
    });
  };
  const updCol = (colId: string, field: keyof QtyMatCol, val: string) => {
    setMatrix({ ...matrix, cols: matrix.cols.map(c => c.id === colId ? { ...c, [field]: val } : c) });
  };

  /* 행(위치) 추가/삭제 */
  const addRow = () => {
    const vals: Record<string, number> = {};
    matrix.cols.forEach(c => { vals[c.id] = 0; });
    setMatrix({ ...matrix, rows: [...matrix.rows, { id: crypto.randomUUID(), group: '', location: '', values: vals }] });
  };
  const delRow = (rowId: string) => setMatrix({ ...matrix, rows: matrix.rows.filter(r => r.id !== rowId) });
  const updRow = (rowId: string, field: 'group' | 'location', val: string) => {
    setMatrix({ ...matrix, rows: matrix.rows.map(r => r.id === rowId ? { ...r, [field]: val } : r) });
  };
  const updCell = (rowId: string, colId: string, val: number) => {
    setMatrix({ ...matrix, rows: matrix.rows.map(r => r.id === rowId ? { ...r, values: { ...r.values, [colId]: val } } : r) });
  };

  /* 그룹 rowSpan 계산 */
  const rowSpans = useMemo(() => {
    const spans: (number | 0)[] = [];
    let i = 0;
    while (i < matrix.rows.length) {
      const g = matrix.rows[i].group;
      let cnt = 1;
      while (i + cnt < matrix.rows.length && matrix.rows[i + cnt].group === g && g !== '') cnt++;
      spans.push(cnt);
      for (let j = 1; j < cnt; j++) spans.push(0);
      i += cnt;
    }
    return spans;
  }, [matrix.rows]);

  const cols = matrix.cols;
  const fixedCols = 2; // 구분, 위치

  /* 열별 합계 계산 */
  const colTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    cols.forEach(c => {
      totals[c.id] = matrix.rows.reduce((sum, r) => sum + (r.values[c.id] ?? 0), 0);
    });
    return totals;
  }, [cols, matrix.rows]);

  /* 엑셀 불러오기 */
  const handleExcel = async (file: File) => {
    try {
      const rows = await readExcelFile(file);
      if (rows.length < 1) { alert('데이터가 없습니다.'); return; }

      // 헤더 행 자동 감지: '구분' 또는 '위치' 키워드가 있는 행을 헤더로 사용
      let headerIdx = 0;
      let startCol = 0;
      for (let ri = 0; ri < Math.min(rows.length, 5); ri++) {
        const cells = rows[ri].map(c => String(c ?? '').trim().toLowerCase());
        const foundGroup = cells.findIndex(c => c === '구분' || c === '공종' || c === '분류');
        const foundLoc = cells.findIndex(c => c === '위치' || c === '장소' || c === '세부');
        if (foundGroup >= 0 || foundLoc >= 0) {
          headerIdx = ri;
          // 구분/위치 열 다음부터 품목
          startCol = Math.max(foundGroup, foundLoc) + 1;
          break;
        }
      }
      // 헤더 키워드 못 찾으면 첫 행을 헤더로, 0열부터 품목으로 사용
      if (startCol === 0) startCol = 0;

      const header = rows[headerIdx].map(c => String(c ?? '').trim());
      const newCols: QtyMatCol[] = [];
      for (let ci = startCol; ci < header.length; ci++) {
        const name = header[ci];
        if (!name) continue;
        // 구분/위치 등 헤더 키워드는 건너뜀
        if (['구분', '위치', '공종', '장소', '분류', '세부', '번호', 'no', '합계'].includes(name.toLowerCase())) continue;
        // 다음 행이 규격, 그 다음이 단위일 수 있음
        const spec = rows.length > headerIdx + 1 ? String(rows[headerIdx + 1]?.[ci] ?? '').trim() : '';
        const unit = rows.length > headerIdx + 2 ? String(rows[headerIdx + 2]?.[ci] ?? '').trim() : '';
        newCols.push({ id: crypto.randomUUID(), name, spec, unit });
      }

      // 품목 열을 못 찾으면 첫 행 전체를 품목으로 시도
      if (newCols.length === 0) {
        for (let ci = 0; ci < header.length; ci++) {
          const name = header[ci];
          if (!name) continue;
          if (['구분', '위치', '공종', '장소', '분류', '세부', '번호', 'no', '합계'].includes(name.toLowerCase())) continue;
          const spec = rows.length > 1 ? String(rows[1]?.[ci] ?? '').trim() : '';
          const unit = rows.length > 2 ? String(rows[2]?.[ci] ?? '').trim() : '';
          newCols.push({ id: crypto.randomUUID(), name, spec, unit });
        }
        startCol = 0;
      }

      if (newCols.length === 0) {
        alert(`품목을 인식할 수 없습니다.\n첫 행: ${header.join(' | ')}`);
        return;
      }

      // 데이터 행 (헤더 + 규격/단위 행 건너뜀)
      const hasSpec = rows.length > headerIdx + 1;
      const hasUnit = rows.length > headerIdx + 2;
      const dataStart = headerIdx + 1 + (hasSpec ? 1 : 0) + (hasUnit ? 1 : 0);
      const newRows: QtyMatRow[] = [];
      for (let ri = dataStart; ri < rows.length; ri++) {
        const row = rows[ri];
        const group = startCol > 0 ? String(row?.[0] ?? '').trim() : '';
        const location = startCol > 1 ? String(row?.[1] ?? '').trim() : '';
        if (!group && !location && !row?.slice(startCol).some(v => v)) continue;
        // 합계 행 건너뜀
        const firstCell = String(row?.[0] ?? '').trim().toLowerCase();
        if (['합계', '소계', '계', '합  계'].includes(firstCell)) continue;
        const values: Record<string, number> = {};
        newCols.forEach((col, ci) => {
          const raw = row?.[startCol + ci];
          const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0').replace(/,/g, ''));
          values[col.id] = isNaN(num) ? 0 : num;
        });
        newRows.push({ id: crypto.randomUUID(), group, location, values });
      }
      if (newRows.length === 0) {
        // 행 데이터가 없으면 기본 10행 생성
        for (let i = 0; i < DEFAULT_QTY_ROWS; i++) {
          const values: Record<string, number> = {};
          newCols.forEach(col => { values[col.id] = 0; });
          newRows.push({ id: crypto.randomUUID(), group: '', location: '', values });
        }
      }
      setMatrix({ cols: newCols, rows: newRows });
      alert(`${newCols.length}개 품목, ${newRows.length}개 행이 불러와졌습니다.`);
    } catch { alert('엑셀 파일을 읽는 중 오류가 발생했습니다.'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">물량내역서</h3>
        <div className="flex gap-2 no-print">
          <ExcelImportBtn onFile={handleExcel} />
          <Button variant="outline" size="sm" className="gap-1" onClick={addCol}><Plus className="h-3.5 w-3.5" /> 열 추가</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={addRow}><Plus className="h-3.5 w-3.5" /> 행 추가</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', minWidth: `${(fixedCols + cols.length + 1) * 100}px` }}>
          <colgroup>
            <col style={{ width: '80px' }} />
            <col style={{ width: '120px' }} />
            {cols.map(c => <col key={c.id} style={{ width: '100px' }} />)}
            <col style={{ width: '40px' }} />
          </colgroup>
          <thead>
            {/* Row 1: 품명 */}
            <tr className="bg-gray-100 border">
              <th className="border p-2" rowSpan={4}>구분</th>
              <th className="border p-2">품명</th>
              {cols.map(c => (
                <th key={c.id} className="border p-1">
                  <div className="flex items-center gap-0.5">
                    <textarea className="w-full text-center text-xs border-none outline-none bg-transparent resize-none overflow-hidden leading-tight" placeholder="품명" rows={2} value={c.name} onChange={e => updCol(c.id, 'name', e.target.value)} />
                    <button className="text-blue-400 hover:text-blue-600 text-xs no-print flex-shrink-0" onClick={() => setSearchColId(c.id)} title="품목 검색">
                      <Search className="h-3 w-3" />
                    </button>
                    <button className="text-red-400 hover:text-red-600 text-xs no-print flex-shrink-0" onClick={() => delCol(c.id)}>✕</button>
                  </div>
                </th>
              ))}
              <th className="border p-2 no-print" rowSpan={4}></th>
            </tr>
            {/* Row 2: 규격 */}
            <tr className="bg-gray-100 border">
              <th className="border p-2">규격</th>
              {cols.map(c => (
                <th key={c.id} className="border p-1">
                  <input className="w-full text-center text-xs border-none outline-none bg-transparent font-normal" placeholder="규격" value={c.spec} onChange={e => updCol(c.id, 'spec', e.target.value)} />
                </th>
              ))}
            </tr>
            {/* Row 3: 단위 */}
            <tr className="bg-gray-100 border">
              <th className="border p-2">단위</th>
              {cols.map(c => (
                <th key={c.id} className="border p-1">
                  <input className="w-full text-center text-xs border-none outline-none bg-transparent font-normal" placeholder="단위" value={c.unit} onChange={e => updCol(c.id, 'unit', e.target.value)} />
                </th>
              ))}
            </tr>
            {/* Row 4: 합계 */}
            <tr className="bg-gray-200 border">
              <th className="border p-2">합계</th>
              {cols.map(c => (
                <th key={c.id} className="border p-1 text-xs font-semibold text-right pr-2">
                  {colTotals[c.id] ? fmt(colTotals[c.id]) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, ri) => (
              <tr key={row.id} className="border hover:bg-gray-50">
                {ri === 0 && (
                  <td className="border p-1 text-center bg-gray-50 font-medium align-middle" rowSpan={matrix.rows.length} style={{ wordBreak: 'keep-all', lineHeight: '1.4' }}>
                    <textarea
                      className="w-full text-center text-sm font-medium text-black border-none outline-none bg-transparent resize-none overflow-hidden"
                      rows={2}
                      value={row.group}
                      onChange={e => {
                        const v = e.target.value;
                        setMatrix({ ...matrix, rows: matrix.rows.map(r => ({ ...r, group: v })) });
                      }}
                    />
                  </td>
                )}
                <td className="border p-1">
                  <TextInput value={row.location} onChange={v => updRow(row.id, 'location', v)} />
                </td>
                {cols.map(c => (
                  <td key={c.id} className="border p-1">
                    <NumInput value={row.values[c.id] ?? 0} onChange={v => updCell(row.id, c.id, v)} />
                  </td>
                ))}
                <td className="border p-1 text-center no-print">
                  <button className="text-red-500 hover:text-red-700" onClick={() => delRow(row.id)}>✕</button>
                </td>
              </tr>
            ))}
            {matrix.rows.length === 0 && (
              <tr><td colSpan={fixedCols + cols.length + 1} className="text-center py-8 text-gray-400 text-sm">열과 행을 추가하여 물량내역서를 작성하세요.</td></tr>
            )}
          </tbody>
        </table>
      </div>



      {/* 품목 검색 모달 */}
      {searchColId && (
        <ItemSelectModal
          onSelect={(item: Item) => {
            const price = item.price ?? 0;
            const newMatrix = {
              ...matrix,
              cols: matrix.cols.map(col => col.id === searchColId
                ? { ...col, name: item.name, spec: (item as any).spec ?? '', unit: (item as any).unit ?? '' }
                : col),
              _colPrices: { ...(matrix as any)._colPrices, [searchColId!]: price },
            };
            onChange({ quantityMatrix: newMatrix });
            setSearchColId(null);
          }}
          onClose={() => setSearchColId(null)}
        />
      )}
    </div>
  );
}

/* ════════════════════ Sheet: 산출집계표 ════════════════════ */
function SummarySheet({ data }: { data: ProjectData }) {
  // 물량내역서(quantityMatrix)에서 자동 생성
  const matrix = data.quantityMatrix ?? { cols: [], rows: [] };
  const items = useMemo(() => {
    return matrix.cols
      .map(col => {
        const total = matrix.rows.reduce((sum, r) => sum + (r.values[col.id] ?? 0), 0);
        return { name: col.name, spec: col.spec, unit: col.unit, quantity: total };
      })
      .filter(item => item.name);
  }, [matrix]);

  const { colPx, totalWidth: qtTotalW, startResize } = useColumnResize([36, 200, 300, 56, 80, 150], 'de-col-quantity');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">산출집계표</h3>
        <p className="text-xs text-gray-400">물량내역서 데이터를 기반으로 자동 생성됩니다.</p>
      </div>
      <div className="overflow-x-auto">
      <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: `${qtTotalW}px`, minWidth: '100%' }}>
        <colgroup>
          {colPx.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <thead>
          <tr className="bg-gray-100 border">
            <th className="border p-2 relative">No<RH ci={0} sr={startResize} /></th>
            <th className="border p-2 relative">품명<RH ci={1} sr={startResize} /></th>
            <th className="border p-2 relative">규격<RH ci={2} sr={startResize} /></th>
            <th className="border p-2 relative">단위<RH ci={3} sr={startResize} /></th>
            <th className="border p-2 relative">수량<RH ci={4} sr={startResize} /></th>
            <th className="border p-2 relative">비고<RH ci={5} sr={startResize} /></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border hover:bg-gray-50">
              <td className="border p-1 text-center text-gray-500">{i + 1}</td>
              <td className="border p-2">{item.name}</td>
              <td className="border p-2 text-gray-600">{item.spec}</td>
              <td className="border p-2 text-center">{item.unit}</td>
              <td className="border p-2 text-right pr-3">{item.quantity ? fmt(item.quantity) : ''}</td>
              <td className="border p-2"></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {items.length === 0 && <p className="text-gray-400 text-center py-8 text-sm">물량내역서에 품목을 추가하면 자동으로 표시됩니다.</p>}
    </div>
  );
}



/* 품목 선택 팝업 모달 */
function ItemSelectModal({ onSelect, onClose }: {
  onSelect: (item: Item) => void;
  onClose: () => void;
}) {
  const { data: allItems = [] } = useItems();
  const [search, setSearch] = useState('');
  const filtered = allItems.filter((item: Item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.spec ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 flex flex-col" style={{ height: '80vh' }}>
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h3 className="font-bold text-base">품목 선택 <span className="text-sm font-normal text-gray-400">({filtered.length}건)</span></h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-3 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="품목명 또는 규격 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">검색 결과가 없습니다.</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">품목명</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">규격</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">단위</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">단가</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: Item) => (
                  <tr key={item.id} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => { onSelect(item); onClose(); }}>
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-gray-500">{item.spec || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{(item as any).unit || '-'}</td>
                    <td className="px-3 py-2 text-right text-green-600">{item.price ? item.price.toLocaleString() + '원' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* 항목명 셀 (돋보기 버튼으로 팝업 열기) */
function ItemNameCell({ value, onChange, onSelect }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: Item) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <input
        type="text"
        className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        className="flex-shrink-0 px-1.5 border rounded text-gray-400 hover:text-blue-600 hover:border-blue-400 bg-gray-50"
        onClick={() => setModalOpen(true)}
        title="품목 검색"
      >
        <Search className="h-3.5 w-3.5" />
      </button>
      {modalOpen && (
        <ItemSelectModal
          onSelect={item => { onSelect(item); setModalOpen(false); }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

/* % 수량 행의 금액을 누적합 기반으로 계산 */
function computeEstimateAmounts(items: DesignEstimateItem[]): Map<string, number> {
  const map = new Map<string, number>();
  let runningTotal = 0;
  for (const item of items) {
    let amount: number;
    const expr = item.quantityExpr?.trim() ?? '';
    if (expr.endsWith('%')) {
      const pct = parseFloat(expr.slice(0, -1));
      amount = isNaN(pct) ? 0 : Math.floor(runningTotal * pct / 100);
    } else {
      amount = item.quantity * item.unitPrice;
    }
    map.set(item.id, amount);
    runningTotal += amount;
  }
  return map;
}

function EstimateSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = (category: 'material' | 'labor' | 'expense') =>
    onChange({ estimateItems: [...data.estimateItems, { id: crypto.randomUUID(), category, name: '', spec: '', unit: '식', quantity: 1, unitPrice: 0, labUnitPrice: 0, expUnitPrice: 0 }] });
  const del = (id: string) => onChange({ estimateItems: data.estimateItems.filter(e => e.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ estimateItems: data.estimateItems.map(e => e.id === id ? { ...e, [field]: val } : e) });

  // 일위대가표 검색 팝업 상태
  const [ucSearch, setUcSearch] = useState<string | null>(null); // estimateItem id
  const [ucQuery, setUcQuery] = useState('');
  const filteredUCs = ucQuery.trim()
    ? data.unitCosts.filter(uc => uc.workType.includes(ucQuery) || (uc.ref ?? '').includes(ucQuery))
    : data.unitCosts;

  const categories: { key: 'material' | 'labor' | 'expense'; label: string; bg: string; hdrBg: string }[] = [
    { key: 'material', label: '재료비',      bg: 'bg-green-50',  hdrBg: 'bg-green-100' },
    { key: 'labor',    label: '노무비(직접)', bg: 'bg-blue-50',   hdrBg: 'bg-blue-100'  },
    { key: 'expense',  label: '경비(직접)',   bg: 'bg-orange-50', hdrBg: 'bg-orange-100' },
  ];

  const amountMap = computeEstimateAmounts(data.estimateItems);

  // 재료비 단가 % 계산을 위한 실시간 누적 금액 맵
  const matBaseMap = useMemo(() => {
    const baseMap = new Map<string, number>(); // id → 해당 항목 이전까지의 재료비 금액 합
    const priceMap = new Map<string, number>(); // id → 실제 계산된 재료비 단가
    let runningMatTotal = 0;
    for (const item of data.estimateItems) {
      baseMap.set(item.id, runningMatTotal);
      const expr = (item.unitPriceExpr ?? '').trim();
      let price: number;
      if (expr.endsWith('%')) {
        const pct = parseFloat(expr.slice(0, -1));
        price = isNaN(pct) ? 0 : Math.floor(runningMatTotal * pct / 100 / (item.quantity || 1));
      } else {
        price = item.unitPrice;
      }
      priceMap.set(item.id, price);
      runningMatTotal += item.quantity * price;
    }
    return { baseMap, priceMap };
  }, [data.estimateItems]);

  // 총 컬럼 수: 연번+품명+규격+단위+수량 + 재료비×2 + 노무비×2 + 경비×2 + 계 + 비고 + del = 14
  const COLS = 14;

  const renderCell = (item: DesignEstimateItem, cat: typeof categories[0]) => {
    if (cat.key === 'material') {
      const expr = item.unitPriceExpr || String(item.unitPrice || '');
      const isPercent = expr.trim().endsWith('%');
      // % 기준: 해당 행 이전 모든 행의 재료비 금액 누적합 (실시간 계산)
      const baseAmount = matBaseMap.baseMap.get(item.id) ?? 0;
      const computedUnitPrice = matBaseMap.priceMap.get(item.id) ?? item.unitPrice;
      const amount = item.quantity * computedUnitPrice;
      const displayExpr = isPercent ? expr : (item.unitPrice > 0 ? fmt(item.unitPrice) : '');
      return (
        <>
          <td className="border p-1">
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className={`w-full px-2 py-1 border rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 ${isPercent ? 'bg-purple-50 text-purple-700' : ''}`}
                defaultValue={displayExpr}
                key={displayExpr}
                onFocus={e => { if (!isPercent) e.target.value = String(item.unitPrice || ''); }}
                onBlur={e => {
                  const val = e.target.value.trim();
                  if (val.endsWith('%')) {
                    const pct = parseFloat(val.slice(0, -1));
                    const computed = isNaN(pct) ? 0 : Math.floor(baseAmount * pct / 100 / (item.quantity || 1));
                    onChange({ estimateItems: data.estimateItems.map(ei => ei.id === item.id ? { ...ei, unitPriceExpr: val, unitPrice: computed } : ei) });
                  } else {
                    const num = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
                    onChange({ estimateItems: data.estimateItems.map(ei => ei.id === item.id ? { ...ei, unitPriceExpr: undefined, unitPrice: num } : ei) });
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="0 또는 10%"
              />
              {isPercent && (
                <span style={{ position: 'absolute', right: 4, bottom: -14, fontSize: 10, color: '#7e22ce', whiteSpace: 'nowrap' }}>
                  기준:{fmt(baseAmount)}
                </span>
              )}
            </div>
          </td>
          <td className="border p-1 text-right pr-2">{amount > 0 ? fmt(amount) : ''}</td>
        </>
      );
    }
    if (cat.key === 'labor') {
      const labPrice = item.labUnitPrice ?? 0;
      const amount = item.quantity * labPrice;
      return (
        <>
          <td className="border p-1"><NumInput value={labPrice} onChange={v => upd(item.id, 'labUnitPrice', v)} /></td>
          <td className="border p-1 text-right pr-2">{amount > 0 ? fmt(amount) : ''}</td>
        </>
      );
    }
    // expense
    const expPrice = item.expUnitPrice ?? 0;
    const expAmt = item.expAmount != null ? item.expAmount : item.quantity * expPrice;
    return (
      <>
        <td className="border p-1"><NumInput value={expPrice} onChange={v => upd(item.id, 'expUnitPrice', v)} /></td>
        <td className="border p-1">
          <NumInput
            value={expAmt}
            onChange={v => {
              const newUnitPrice = item.quantity > 0 ? Math.floor(v / item.quantity) : 0;
              onChange({ estimateItems: data.estimateItems.map(ei =>
                ei.id === item.id ? { ...ei, expAmount: v, expUnitPrice: newUnitPrice } : ei
              )});
            }}
          />
        </td>
      </>
    );
  };

  let globalSeq = 0;

  // 일위대가표 단가 계산 함수 (UnitCostSheet와 동일 로직)
  const calcUcTotals = (uc: UnitCost) => {
    const rows = uc.rows ?? [];
    const matRow = rows.find(r => r.unit !== '인');
    const multiplier = (matRow && matRow.quantity > 0) ? matRow.quantity : 1;
    const mat = rows.reduce((s, r) => s + Math.floor(r.matAmount ?? (r.matUnitPrice ?? 0) * r.quantity), 0);
    const lab = rows.filter(r => r.unit === '인').reduce((s, r) => s + Math.floor((r.labAmount ?? (r.labUnitPrice ?? 0) * r.quantity) * multiplier), 0);
    return { mat: mat * multiplier, lab, multiplier };
  };

  // 일위대가 → 설계내역서 자동 반영
  const applyFromUnitCosts = () => {
    if (data.unitCosts.length === 0) { alert('일위대가표에 공종이 없습니다.'); return; }
    const matrix = data.quantityMatrix ?? { cols: [], rows: [] };
    // 산출집계표 수량 맵 (품명 → 합계 수량)
    const summaryQtyMap = new Map<string, number>();
    matrix.cols.forEach(col => {
      if (!col.name) return;
      const total = matrix.rows.reduce((sum, r) => sum + (r.values[col.id] ?? 0), 0);
      summaryQtyMap.set(col.name, (summaryQtyMap.get(col.name) ?? 0) + total);
    });

    const newItems: DesignEstimateItem[] = [];
    data.unitCosts.forEach(uc => {
      const { mat, lab } = calcUcTotals(uc);
      // 산출집계표에서 동일 이름 항목 수량 매칭
      const qty = summaryQtyMap.get(uc.workType) ?? 1;
      newItems.push({
        id: crypto.randomUUID(),
        category: 'material',
        name: uc.workType,
        spec: uc.ref ?? '',
        unit: '식',
        quantity: qty,
        unitPrice: mat,       // 재료비 단가 (일위대가 재료비 합계)
        labUnitPrice: lab,    // 노무비 단가 (일위대가 노무비 합계)
        expUnitPrice: 0,
        memo: '',
      });
    });

    // 기존 항목과 병합: 같은 이름이면 단가 업데이트, 없으면 추가
    const existing = [...data.estimateItems];
    let addedCount = 0;
    let updatedCount = 0;
    newItems.forEach(ni => {
      const found = existing.find(e => e.name === ni.name);
      if (found) {
        found.unitPrice = ni.unitPrice;
        found.labUnitPrice = ni.labUnitPrice;
        found.quantity = ni.quantity;
        found.spec = ni.spec || found.spec;
        updatedCount++;
      } else {
        existing.push(ni);
        addedCount++;
      }
    });
    onChange({ estimateItems: existing });
    const msg = [];
    if (addedCount) msg.push(`${addedCount}개 추가`);
    if (updatedCount) msg.push(`${updatedCount}개 단가 갱신`);
    alert(`설계내역서에 ${msg.join(', ')}되었습니다.\n(재료비·노무비 단가 = 일위대가표 합계)`);
  };

  const { colPx: esPcts, totalWidth: esTotalW, startResize: esResize } = useColumnResize([40, 160, 180, 50, 56, 88, 104, 88, 104, 88, 104, 104, 72, 40], 'de-col-estimate');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">설계내역서</h3>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => add('material')}>
            <Plus className="h-3.5 w-3.5" /> 추가
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: `${esTotalW}px`, minWidth: '100%' }}>
        <colgroup>{esPcts.map((w: string, i: number) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1 align-middle relative" rowSpan={2}>연번<RH ci={0} sr={esResize} /></th>
            <th className="border p-1 align-middle relative" rowSpan={2}>품명<RH ci={1} sr={esResize} /></th>
            <th className="border p-1 align-middle relative" rowSpan={2}>규격<RH ci={2} sr={esResize} /></th>
            <th className="border p-1 align-middle relative" rowSpan={2}>단위<RH ci={3} sr={esResize} /></th>
            <th className="border p-1 align-middle relative" rowSpan={2}>수량<RH ci={4} sr={esResize} /></th>
            <th className="border p-1 text-center" colSpan={2}>재료비</th>
            <th className="border p-1 text-center" colSpan={2}>노무비</th>
            <th className="border p-1 text-center" colSpan={2}>경비</th>
            <th className="border p-1 align-middle relative" rowSpan={2}>계<RH ci={11} sr={esResize} /></th>
            <th className="border p-1 align-middle relative" rowSpan={2}>비고<RH ci={12} sr={esResize} /></th>
            <th className="border p-1 align-middle no-print" rowSpan={2}></th>
          </tr>
          <tr className="bg-gray-100">
            <th className="border p-1 relative">단가<RH ci={5} sr={esResize} /></th>
            <th className="border p-1 relative">금액<RH ci={6} sr={esResize} /></th>
            <th className="border p-1 relative">단가<RH ci={7} sr={esResize} /></th>
            <th className="border p-1 relative">금액<RH ci={8} sr={esResize} /></th>
            <th className="border p-1 relative">단가<RH ci={9} sr={esResize} /></th>
            <th className="border p-1 relative">금액<RH ci={10} sr={esResize} /></th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-bold bg-gray-200 text-sm">
            <td colSpan={5} className="border p-1 text-center">합 계</td>
            <td colSpan={2} className="border p-1 text-right pr-2 bg-green-100">
              {(() => {
                const miscRate = data.miscMatRate ?? 5;
                const matSum = data.estimateItems.reduce((s, e) => s + e.quantity * (matBaseMap.priceMap.get(e.id) ?? e.unitPrice), 0);
                return fmt(matSum + Math.floor(matSum * miscRate / 100));
              })()}
            </td>
            <td colSpan={2} className="border p-1 text-right pr-2 bg-blue-100">
              {fmt(data.estimateItems.reduce((s, e) => s + e.quantity * (e.labUnitPrice ?? 0), 0))}
            </td>
            <td colSpan={2} className="border p-1 text-right pr-2 bg-orange-100">
              {fmt(data.estimateItems.reduce((s, e) => s + (e.expAmount != null ? e.expAmount : e.quantity * (e.expUnitPrice ?? 0)), 0))}
            </td>
            <td className="border p-1 text-right pr-2">
              {(() => {
                const miscRate = data.miscMatRate ?? 5;
                const matSum = data.estimateItems.reduce((s, e) => s + e.quantity * (matBaseMap.priceMap.get(e.id) ?? e.unitPrice), 0);
                const miscAmount = Math.floor(matSum * miscRate / 100);
                const labSum = data.estimateItems.reduce((s, e) => s + e.quantity * (e.labUnitPrice ?? 0), 0);
                const expSum = data.estimateItems.reduce((s, e) => s + (e.expAmount != null ? e.expAmount : e.quantity * (e.expUnitPrice ?? 0)), 0);
                return fmt(matSum + miscAmount + labSum + expSum);
              })()}
            </td>
            <td className="border p-1"></td>
            <td className="border no-print"></td>
          </tr>
          {categories.map(cat => {
            const items = data.estimateItems.filter(e => e.category === cat.key);
            const subtotal = items.reduce((s, e) => s + (amountMap.get(e.id) ?? e.quantity * e.unitPrice), 0);
            return (
              <React.Fragment key={cat.key}>
                {items.map((item, i) => {
                  globalSeq++;
                  const seq = globalSeq;
                  const amount = amountMap.get(item.id) ?? item.quantity * item.unitPrice;
                  return (
                    <tr key={item.id} className="border hover:bg-gray-50">
                      <td className="border p-1 text-center text-gray-400">{seq}</td>
                      <td className="border p-1">
                        <TextInput value={item.name} onChange={v => upd(item.id, 'name', v)} />
                      </td>
                      <td className="border p-1"><TextInput value={item.spec} onChange={v => upd(item.id, 'spec', v)} /></td>
                      <td className="border p-1"><TextInput value={item.unit} onChange={v => upd(item.id, 'unit', v)} /></td>
                      <td className="border p-1" style={{ paddingBottom: item.quantityExpr?.endsWith('%') ? 16 : undefined }}>
                        <QuantityInput
                          expr={item.quantityExpr ?? String(item.quantity)}
                          onChange={(expr, qty) => onChange({
                            estimateItems: data.estimateItems.map(e => e.id === item.id ? { ...e, quantityExpr: expr, quantity: qty } : e),
                          })}
                        />
                      </td>
                      {renderCell(item, categories[0])}
                      {renderCell(item, categories[1])}
                      {renderCell(item, categories[2])}
                      <td className="border p-1 text-right pr-2 font-medium">
                        {fmt(item.quantity * (matBaseMap.priceMap.get(item.id) ?? item.unitPrice) + item.quantity * (item.labUnitPrice ?? 0) + (item.expAmount != null ? item.expAmount : item.quantity * (item.expUnitPrice ?? 0)))}
                      </td>
                      <td className="border p-1">
                        <div className="flex items-center gap-1">
                          <TextInput value={item.memo ?? ''} onChange={v => upd(item.id, 'memo', v)} />
                          <button
                            className="shrink-0 text-gray-400 hover:text-indigo-600 no-print"
                            title="일위대가표에서 선택"
                            onClick={() => { setUcQuery(''); setUcSearch(item.id); }}
                          ><Search className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                      <td className="border p-1 text-center no-print">
                        <button className="text-red-400" onClick={() => del(item.id)}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
          {/* ── 잡자재비 고정행 ── */}
          {(() => {
            const miscRate = data.miscMatRate ?? 5;
            const totalMat = data.estimateItems.reduce((s, e) => s + e.quantity * (matBaseMap.priceMap.get(e.id) ?? e.unitPrice), 0);
            const miscAmount = Math.floor(totalMat * miscRate / 100);
            return (
              <tr className="border bg-yellow-50 font-medium">
                <td className="border p-1 text-center text-gray-400">{data.estimateItems.length + 1}</td>
                <td className="border p-1" colSpan={3}>잡자재비</td>
                <td className="border p-1 text-center">1</td>
                <td className="border p-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="w-14 px-1 py-0.5 border rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                      value={miscRate}
                      onChange={e => onChange({ miscMatRate: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                </td>
                <td className="border p-1 text-right pr-2">{fmt(miscAmount)}</td>
                <td className="border p-1"></td>
                <td className="border p-1"></td>
                <td className="border p-1"></td>
                <td className="border p-1"></td>
                <td className="border p-1 text-right pr-2 font-bold">{fmt(miscAmount)}</td>
                <td className="border p-1 text-xs text-gray-500">재료비×{miscRate}%</td>
                <td className="border p-1 no-print"></td>
              </tr>
            );
          })()}
        </tbody>
      </table>
      </div>

      {/* 일위대가표 선택 팝업 */}
      {ucSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setUcSearch(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[32rem] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h4 className="font-bold text-sm">일위대가표에서 선택</h4>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setUcSearch(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="px-3 py-2 border-b">
              <input
                autoFocus
                type="text"
                placeholder="작업종별 또는 참조번호 검색..."
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={ucQuery}
                onChange={e => setUcQuery(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredUCs.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-6">검색 결과가 없습니다.</p>
              )}
              {filteredUCs.map(uc => {
                const { lab } = calcUcTotals(uc);
                const ucIdx = data.unitCosts.indexOf(uc);
                const label = `제${ucIdx + 1}호표`;
                return (
                  <button
                    key={uc.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 text-sm"
                    onClick={() => {
                      onChange({
                        estimateItems: data.estimateItems.map(e =>
                          e.id === ucSearch ? { ...e, labUnitPrice: lab, memo: label } : e
                        ),
                      });
                      setUcSearch(null);
                    }}
                  >
                    <span className="font-medium text-indigo-600">{label}</span>
                    <span className="float-right text-black font-bold">{lab.toLocaleString()}원</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════ 숫자 → 한글 금액 변환 ════════════════════ */
function numberToKorean(n: number): string {
  if (n === 0) return '영';
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const smallUnits = ['', '십', '백', '천'];
  const bigUnits = ['', '만', '억', '조'];
  let result = '';
  let groupIdx = 0;
  while (n > 0) {
    const group = n % 10000;
    if (group > 0) {
      let groupStr = '';
      let g = group;
      for (let i = 0; i < 4 && g > 0; i++) {
        const d = g % 10;
        if (d > 0) {
          groupStr = digits[d] + smallUnits[i] + groupStr;
        }
        g = Math.floor(g / 10);
      }
      result = groupStr + bigUnits[groupIdx] + result;
    }
    n = Math.floor(n / 10000);
    groupIdx++;
  }
  return result;
}

/* ════════════════════ Sheet: 표지 ════════════════════ */
function CoverSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const c = useMemo(() => calcCost(data), [data]);

  // 물량내역서 위치 자동 연동
  const locationText = useMemo(() => {
    const rows = data.quantityMatrix?.rows ?? [];
    const locs = [...new Set(rows.map(r => r.location.trim()).filter(Boolean))];
    return locs.join(', ');
  }, [data.quantityMatrix]);

  return (
    <div className="flex flex-col items-center py-8">
      {/* 제목 */}
      <div className="text-center mb-10">
        <h3 className="text-2xl font-bold leading-relaxed tracking-widest">
          {data.projectName}
        </h3>
        <h3 className="text-2xl font-bold tracking-[0.3em] mt-1">설 계 내 역 서</h3>
      </div>

      {/* 금액 테이블 */}
      <table className="border-collapse w-full max-w-[700px] mb-8">
        <thead>
          <tr className="bg-red-50">
            <th className="border border-gray-400 px-4 py-3 text-center font-bold w-[140px]">구 분</th>
            <th className="border border-gray-400 px-4 py-3 text-center font-bold" colSpan={2}>금 액</th>
            <th className="border border-gray-400 px-4 py-3 text-center font-bold w-[80px]">비 고</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-400 px-4 py-3 text-center font-medium">합 계</td>
            <td className="border border-gray-400 px-4 py-3 whitespace-nowrap">
              <span className="text-sm">一金 {numberToKorean(c.total)}원 整</span>
            </td>
            <td className="border border-gray-400 px-4 py-3 text-right font-mono whitespace-nowrap">
              ( ₩ <span className="inline-block min-w-[100px] text-right">{fmt(c.total)}</span> )
            </td>
            <td className="border border-gray-400 px-4 py-3"></td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-4 py-3 text-center font-medium">공사비</td>
            <td className="border border-gray-400 px-4 py-3 whitespace-nowrap">
              <span className="text-sm">一金 {numberToKorean(c.totalCost)}원 整</span>
            </td>
            <td className="border border-gray-400 px-4 py-3 text-right font-mono whitespace-nowrap">
              ( ₩ <span className="inline-block min-w-[100px] text-right">{fmt(c.totalCost)}</span> )
            </td>
            <td className="border border-gray-400 px-4 py-3"></td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-4 py-3 text-center font-medium">부가가치세</td>
            <td className="border border-gray-400 px-4 py-3 whitespace-nowrap">
              <span className="text-sm">一金 {numberToKorean(c.vat)}원 整</span>
            </td>
            <td className="border border-gray-400 px-4 py-3 text-right font-mono whitespace-nowrap">
              ( ₩ <span className="inline-block min-w-[100px] text-right">{fmt(c.vat)}</span> )
            </td>
            <td className="border border-gray-400 px-4 py-3"></td>
          </tr>
        </tbody>
      </table>

      {/* 위치 (물량내역서 연동) */}
      <div className="w-full max-w-[700px] mb-12">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">▣ 위치: {locationText || <span className="text-gray-400">물량내역서에 위치를 입력하면 자동 표시됩니다</span>}</span>
        </div>
      </div>

      {/* 발주처 로고 */}
      <div className="mt-8 flex flex-col items-center gap-3">
        {data.coverLogo && (
          <div className="relative group">
            <img src={data.coverLogo} alt="로고" className="max-h-[100px] object-contain" />
            <button
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onChange({ coverLogo: undefined })}
            >×</button>
          </div>
        )}
        <label className="cursor-pointer border rounded px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 whitespace-nowrap">
          {data.coverLogo ? '로고 변경' : '로고 업로드'}
          <input type="file" accept="image/*" className="hidden" onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
              const result = ev.target?.result as string;
              if (result) onChange({ coverLogo: result });
            };
            reader.readAsDataURL(file);
            e.target.value = '';
          }} />
        </label>
      </div>
    </div>
  );
}

/* ════════════════════ Sheet: 원가계산서 ════════════════════ */
function CostCalcSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const c = useMemo(() => calcCost(data), [data]);

  return (
    <div>
      <h3 className="font-bold text-lg mb-3">원가계산서</h3>
      <p className="text-xs text-gray-500 mb-3">설계내역서 데이터를 기반으로 자동 계산됩니다.</p>
      <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '50px' }} />
          <col style={{ width: '50px' }} />
          <col style={{ width: '170px' }} />
          <col style={{ width: '120px' }} />
          <col />
        </colgroup>
        <thead>
          <tr className="bg-gray-100 border">
            <th className="border p-2 text-center" colSpan={2}>비목</th>
            <th className="border p-2 text-center">구 분</th>
            <th className="border p-2 text-center">금 액</th>
            <th className="border p-2 text-center">비 고</th>
          </tr>
        </thead>
        <tbody>
          {/* ── 순공사비 (rowSpan=16): 재료비2 + 노무비3 + 경비10 + 계1 ── */}

          {/* 재료비 (rowSpan=2) */}
          <tr className="border">
            <td className="border p-2 text-center font-bold align-middle bg-gray-50" rowSpan={16} style={{ writingMode: 'vertical-rl', letterSpacing: '4px' }}>순공사비</td>
            <td className="border p-2 text-center font-medium align-middle bg-gray-50" rowSpan={2} style={{ writingMode: 'vertical-rl', letterSpacing: '2px' }}>재료비</td>
            <td className="border p-2">재료비</td>
            <td className="border p-2 text-right pr-3">{fmt(c.materialCost)}</td>
            <td className="border p-2 text-xs text-gray-500"></td>
          </tr>
          <tr className="border bg-blue-50">
            <td className="border p-2 font-bold">소 계</td>
            <td className="border p-2 text-right pr-3 font-bold">{fmt(c.materialCost)}</td>
            <td className="border p-2"></td>
          </tr>

          {/* 노무비 (rowSpan=3) */}
          <tr className="border">
            <td className="border p-2 text-center font-medium align-middle bg-gray-50" rowSpan={3} style={{ writingMode: 'vertical-rl', letterSpacing: '2px' }}>노무비</td>
            <td className="border p-2">직접노무비</td>
            <td className="border p-2 text-right pr-3">{fmt(c.directLabor)}</td>
            <td className="border p-2 text-xs text-gray-500"></td>
          </tr>
          <tr className="border">
            <td className="border p-2">간접노무비</td>
            <td className="border p-2 text-right pr-3">{fmt(c.indirectLabor)}</td>
            <td className="border p-2 text-xs text-gray-500">직접노무비 × 15%</td>
          </tr>
          <tr className="border bg-blue-50">
            <td className="border p-2 font-bold">소 계</td>
            <td className="border p-2 text-right pr-3 font-bold">{fmt(c.totalLabor)}</td>
            <td className="border p-2"></td>
          </tr>

          {/* 경비 (rowSpan=10: 9항목 + 소계) */}
          <tr className="border">
            <td className="border p-2 text-center font-medium align-middle bg-gray-50" rowSpan={10} style={{ writingMode: 'vertical-rl', letterSpacing: '2px' }}>경비</td>
            <td className="border p-2">기타경비</td>
            <td className="border p-2 text-right pr-3">{fmt(c.otherExpenses)}</td>
            <td className="border p-2 text-xs text-gray-500">(재료비+노무비) × 4.6%</td>
          </tr>
          <tr className="border">
            <td className="border p-2">연금보험료</td>
            <td className="border p-2 text-right pr-3">{c.pensionInsurance ? fmt(c.pensionInsurance) : ''}</td>
            <td className="border p-2 text-xs text-gray-500"></td>
          </tr>
          <tr className="border">
            <td className="border p-2">산재보험료</td>
            <td className="border p-2 text-right pr-3">{fmt(c.industrialAccident)}</td>
            <td className="border p-2 text-xs text-gray-500">노무비 × 3.56%</td>
          </tr>
          <tr className="border">
            <td className="border p-2">건강보험료</td>
            <td className="border p-2 text-right pr-3">{c.healthInsurance ? fmt(c.healthInsurance) : ''}</td>
            <td className="border p-2 text-xs text-gray-500"></td>
          </tr>
          <tr className="border">
            <td className="border p-2">노인장기요양보험료</td>
            <td className="border p-2 text-right pr-3">{c.longTermCare ? fmt(c.longTermCare) : ''}</td>
            <td className="border p-2 text-xs text-gray-500"></td>
          </tr>
          <tr className="border">
            <td className="border p-2">산업안전보건관리비</td>
            <td className="border p-2 text-right pr-3">{fmt(c.safetyManagement)}</td>
            <td className="border p-2 text-xs text-gray-500">(재료비+직접노무비) × 2.07%</td>
          </tr>
          <tr className="border">
            <td className="border p-2">고용보험료</td>
            <td className="border p-2 text-right pr-3">{fmt(c.employmentInsurance)}</td>
            <td className="border p-2 text-xs text-gray-500">노무비 × 1.01%</td>
          </tr>
          <tr className="border">
            <td className="border p-2">석면분담금</td>
            <td className="border p-2 text-right pr-3">{fmt(c.asbestosFund)}</td>
            <td className="border p-2 text-xs text-gray-500">노무비 × 0.006%</td>
          </tr>
          <tr className="border">
            <td className="border p-2">임금채권부담금</td>
            <td className="border p-2 text-right pr-3">{fmt(c.wageClaimBurden)}</td>
            <td className="border p-2 text-xs text-gray-500">노무비 × 0.09%</td>
          </tr>
          <tr className="border bg-blue-50">
            <td className="border p-2 font-bold">소 계</td>
            <td className="border p-2 text-right pr-3 font-bold">{fmt(c.totalExpenses)}</td>
            <td className="border p-2"></td>
          </tr>

          {/* 순공사비 계 */}
          <tr className="border bg-gray-100">
            <td className="border p-2 font-bold text-center" colSpan={2}>계</td>
            <td className="border p-2 text-right pr-3 font-bold">{fmt(c.subtotal)}</td>
            <td className="border p-2"></td>
          </tr>

          {/* ── 일반관리비 ── */}
          <tr className="border">
            <td className="border p-2 font-medium" colSpan={3}>일반관리비</td>
            <td className="border p-2 text-right pr-3">{fmt(c.generalAdmin)}</td>
            <td className="border p-2 text-xs text-gray-500">(재료비+노무비+경비) × 8%</td>
          </tr>
          {/* ── 이윤 ── */}
          <tr className="border">
            <td className="border p-2 font-medium" colSpan={3}>이 윤</td>
            <td className="border p-2 text-right pr-3">{fmt(c.profit)}</td>
            <td className="border p-2 text-xs text-gray-500">
              <span>(노무비+경비+일반관리비) × </span>
              <input
                type="number"
                className="w-12 px-1 py-0.5 border rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 no-print"
                value={data.profitRate ?? 15}
                onChange={e => onChange({ profitRate: Math.max(0, Number(e.target.value) || 0) })}
              />
              <span>%</span>
            </td>
          </tr>
          {/* ── 총원가 ── */}
          <tr className="border bg-yellow-50">
            <td className="border p-2 font-bold" colSpan={3}>총 원 가</td>
            <td className="border p-2 text-right pr-3 font-bold text-blue-800">{fmt(c.totalCost)}</td>
            <td className="border p-2"></td>
          </tr>
          {/* ── 부가가치세 ── */}
          <tr className="border">
            <td className="border p-2 font-medium" colSpan={3}>부가가치세</td>
            <td className="border p-2 text-right pr-3">{fmt(c.vat)}</td>
            <td className="border p-2 text-xs text-gray-500">총원가 × 10%</td>
          </tr>
          {/* ── 도급공사비 ── */}
          <tr className="border bg-yellow-50">
            <td className="border p-2 font-bold" colSpan={3}>도급공사비</td>
            <td className="border p-2 text-right pr-3 font-bold text-blue-800">{fmt(c.total)}</td>
            <td className="border p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════ Main ════════════════════════ */
export function DesignEstimatePage() {
  const [data, setData] = useState<ProjectData>(defaultProject);
  const [activeSheet, setActiveSheet] = useState<SheetTab>('estimate');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = getStoredValue<ProjectData | null>(STORAGE_KEY, null);
    if (saved) {
      // 노임단가 데이터 마이그레이션: 구형 (type=직종, category=직급) → 신형 (type=직급명)
      const KNOWN_LABOR_TYPES = new Set(['보통인부', '특별인부', '통신내선공', '통신설비공', '통신케이블공', '광케이블설치사']);
      const needsMigration = saved.laborRates?.some((r: LaborRate) => !KNOWN_LABOR_TYPES.has(r.type));
      if (needsMigration) {
        setData({ ...saved, laborRates: defaultProject().laborRates });
      } else {
        setData(saved);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      // 빈 문자열/0 기본값 필드 제거로 용량 절약
      const slim: ProjectData = {
        ...data,
        estimateItems: data.estimateItems.filter(e => e.name).map(e => {
          const o: Record<string, unknown> = { id: e.id, category: e.category, name: e.name, spec: e.spec, unit: e.unit, quantity: e.quantity, unitPrice: e.unitPrice };
          if (e.quantityExpr && e.quantityExpr !== String(e.quantity)) o.quantityExpr = e.quantityExpr;
          if (e.unitPriceExpr) o.unitPriceExpr = e.unitPriceExpr;
          if (e.labUnitPrice) o.labUnitPrice = e.labUnitPrice;
          if (e.expUnitPrice) o.expUnitPrice = e.expUnitPrice;
          if (e.expAmount != null) o.expAmount = e.expAmount;
          if (e.memo) o.memo = e.memo;
          if (e.matrixColId) o.matrixColId = e.matrixColId;
          return o as unknown as DesignEstimateItem;
        }),
        materials: data.materials.filter(m => m.name).map(m => {
          const o: Record<string, unknown> = { id: m.id, name: m.name, spec: m.spec, unit: m.unit, unitPrice: m.unitPrice, quantity: m.quantity };
          if (m.quote1) o.quote1 = m.quote1;
          if (m.quote2) o.quote2 = m.quote2;
          if (m.quote3) o.quote3 = m.quote3;
          return o as unknown as Material;
        }),
        unitCosts: data.unitCosts.filter(uc => uc.workType),
        quantityMatrix: data.quantityMatrix ? {
          cols: data.quantityMatrix.cols.filter(c => c.name),
          rows: data.quantityMatrix.rows.filter(r => r.group || r.location || Object.values(r.values).some(v => v !== 0)).map(r => {
            const values: Record<string, number> = {};
            Object.entries(r.values).forEach(([k, v]) => { if (v !== 0) values[k] = v; });
            return { id: r.id, group: r.group, location: r.location, values };
          }),
        } : undefined,
        summaryItems: data.summaryItems.filter(s => s.name),
        laborRates: data.laborRates.filter(l => l.type),
      };
      setStoredValue(STORAGE_KEY, slim);
    }, 500);
    return () => clearTimeout(timer);
  }, [data, loaded]);

  const updateData = useCallback((partial: Partial<ProjectData>) => {
    setData(prev => {
      const next = { ...prev, ...partial };
      // 물량내역서 변경 시 자재단가표 + 설계내역서 자동 동기화
      if (partial.quantityMatrix && !partial.materials) {
        const matrix = partial.quantityMatrix;
        const colIds = new Set(matrix.cols.map(c => c.id));

        // ── 자재단가표 동기화 ──
        const colPrices: Record<string, number> = (matrix as any)._colPrices ?? {};
        const matResult: Material[] = [];
        const matSeen = new Set<string>(); // col.id 중복 방지
        matrix.cols.forEach(col => {
          if (!col.name) return;
          if (matSeen.has(col.id)) return;
          matSeen.add(col.id);
          const total = matrix.rows.reduce((sum, r) => sum + (r.values[col.id] ?? 0), 0);
          const hintPrice = colPrices[col.id] ?? 0;
          // matrixColId로 먼저 매칭, 없으면 name으로 폴백
          const found = prev.materials.find(mm => mm.matrixColId === col.id)
            ?? prev.materials.find(mm => !mm.matrixColId && mm.name === col.name);
          if (found) {
            const q1 = hintPrice > 0 ? hintPrice : found.quote1;
            const up = hintPrice > 0 ? hintPrice : found.unitPrice;
            matResult.push({ ...found, matrixColId: col.id, name: col.name, spec: col.spec || found.spec, unit: col.unit || found.unit, quantity: total, quote1: q1, unitPrice: up });
          } else {
            matResult.push({ id: crypto.randomUUID(), matrixColId: col.id, name: col.name, spec: col.spec, unit: col.unit || '개', quote1: hintPrice, quote2: 0, quote3: 0, unitPrice: hintPrice, quantity: total });
          }
        });
        // 매트릭스와 무관한 수동 자재는 보존, 삭제된 열의 자재는 제거
        prev.materials.forEach(mm => {
          if (!mm.matrixColId && !matResult.some(r => r.name === mm.name)) matResult.push(mm);
        });
        next.materials = matResult;

        // ── 설계내역서 동기화 ──
        const estResult: DesignEstimateItem[] = [];
        const estSeen = new Set<string>();
        matrix.cols.forEach(col => {
          if (!col.name) return;
          if (estSeen.has(col.id)) return;
          estSeen.add(col.id);
          const total = matrix.rows.reduce((sum, r) => sum + (r.values[col.id] ?? 0), 0);
          const mat = matResult.find(mm => mm.matrixColId === col.id);
          const unitPrice = mat?.unitPrice ?? 0;
          const found = prev.estimateItems.find(e => e.matrixColId === col.id)
            ?? prev.estimateItems.find(e => !e.matrixColId && e.name === col.name && e.category === 'material');
          if (found) {
            estResult.push({ ...found, matrixColId: col.id, name: col.name, quantity: total, spec: col.spec || found.spec, unit: col.unit || found.unit, unitPrice: unitPrice > 0 ? unitPrice : found.unitPrice });
          } else {
            estResult.push({ id: crypto.randomUUID(), matrixColId: col.id, category: 'material', name: col.name, spec: col.spec, unit: col.unit || '식', quantity: total, unitPrice, labUnitPrice: 0, expUnitPrice: 0, memo: '' });
          }
        });
        // 매트릭스와 무관한 수동 내역은 보존, 삭제된 열의 내역은 제거
        prev.estimateItems.forEach(e => {
          if (!e.matrixColId && !estResult.some(r => r.name === e.name)) estResult.push(e);
        });
        next.estimateItems = estResult;
      }

      // 일위대가표 변경 시 설계내역서 노무비 자동 동기화
      if (partial.unitCosts) {
        const ucs = partial.unitCosts;
        const items = [...(next.estimateItems ?? prev.estimateItems)];
        ucs.forEach(uc => {
          if (!uc.workType) return;
          const rows = uc.rows ?? [];
          const matRow = rows.find(r => r.unit !== '인');
          const multiplier = (matRow && matRow.quantity > 0) ? matRow.quantity : 1;
          const lab = rows.filter(r => r.unit === '인').reduce((s, r) => s + Math.floor((r.labAmount ?? (r.labUnitPrice ?? 0) * r.quantity) * multiplier), 0);
          const mat = rows.reduce((s, r) => s + Math.floor(r.matAmount ?? (r.matUnitPrice ?? 0) * r.quantity), 0) * multiplier;
          const found = items.find(e => e.name === uc.workType);
          if (found) {
            found.labUnitPrice = lab;
            if (mat > 0) found.unitPrice = mat;
          }
        });
        next.estimateItems = items;
      }

      return next;
    });
  }, []);

  // 일위대가표 합계 계산 (엑셀용)
  const calcUcTotalsForExport = (uc: UnitCost) => {
    const rows = uc.rows ?? [];
    const matRow = rows.find(r => r.unit !== '인');
    const multiplier = (matRow && matRow.quantity > 0) ? matRow.quantity : 1;
    const mat = rows.reduce((s, r) => s + Math.floor(r.matAmount ?? (r.matUnitPrice ?? 0) * r.quantity), 0);
    const lab = rows.filter(r => r.unit === '인').reduce((s, r) => s + Math.floor((r.labAmount ?? (r.labUnitPrice ?? 0) * r.quantity) * multiplier), 0);
    return { mat: mat * multiplier, lab, multiplier };
  };

  /* ═══════════ 엑셀 내보내기 (템플릿 기반) ═══════════ */
  const handleExportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const { saveAs } = await import('file-saver');

    // 1) 템플릿 파일 로드
    const resp = await fetch('/template.xlsx');
    const arrBuf = await resp.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrBuf);

    const cost = calcCost(data);
    const matrix = data.quantityMatrix ?? { cols: [], rows: [] };
    const coverLocations = [...new Set(matrix.rows.map(r => r.location.trim()).filter(Boolean))].join(', ');

    /* ── helper: 셀에 값 쓰기 (서식 유지, 수식 제거) ── */
    const setCell = (ws: import('exceljs').Worksheet, row: number, col: number, value: string | number) => {
      const cell = ws.getCell(row, col);
      // 수식(공유 수식 포함) 완전 제거 후 값 설정
      if ((cell as any).formula || (cell as any).sharedFormula) {
        (cell as any).formula = undefined;
        (cell as any).sharedFormula = undefined;
        (cell as any).formulaType = undefined;
      }
      cell.value = value === '' ? null : value;
    };
    const setNumCell = (ws: import('exceljs').Worksheet, row: number, col: number, value: number) => {
      const cell = ws.getCell(row, col);
      if ((cell as any).formula || (cell as any).sharedFormula) {
        (cell as any).formula = undefined;
        (cell as any).sharedFormula = undefined;
        (cell as any).formulaType = undefined;
      }
      cell.value = value || null;
    };
    /* helper: 시트의 모든 수식을 값(result)으로 교체 — 시트간 참조 깨짐 방지 */
    const flattenFormulas = (ws: import('exceljs').Worksheet) => {
      ws.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const v = cell.value as any;
          if (v && (v.formula || v.sharedFormula)) {
            const result = v.result;
            cell.value = (result != null && typeof result !== 'object') ? result : null;
          }
        });
      });
    };
    /* helper: 데이터 이후 남은 템플릿 행 정리 */
    const clearRows = (ws: import('exceljs').Worksheet, fromRow: number) => {
      const lastRow = ws.rowCount;
      for (let r = fromRow; r <= lastRow; r++) {
        const row = ws.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.value = null;
        });
      }
    };

    /* ── 모든 시트의 수식을 값으로 플래튼 (시트간 참조/공유수식 깨짐 방지) ── */
    wb.eachSheet((ws) => { flattenFormulas(ws); });

    /* ── 설계예산서 (Sheet 1) ── */
    const wsBudget = wb.getWorksheet('설계예산서');
    if (wsBudget) {
      // R6: 사업명 (D7)
      setCell(wsBudget, 7, 5, data.projectName);
      // R7: 위치 (D8)
      setCell(wsBudget, 8, 5, coverLocations);
      // R8-R9: 공사개요 (E9)
      setCell(wsBudget, 9, 5, `${data.projectName} - 1식`);
      // R2: 설계년월일 (J3)
      setCell(wsBudget, 3, 10, `${data.year}.01`);
    }

    /* ── 표지 (Sheet 2) ── */
    const wsCover = wb.getWorksheet('표지');
    if (wsCover) {
      // R1: 공사명 (A2, merged)
      setCell(wsCover, 2, 1, data.projectName);
      // R5: 합계 금액 한글 (N6)
      setCell(wsCover, 6, 14, `${numberToKorean(cost.total)}원 整 `);
      // R5: 합계 금액 숫자 (X6)
      setNumCell(wsCover, 6, 24, cost.total);
      // R6: 공사비 한글 (N7)
      setCell(wsCover, 7, 14, `${numberToKorean(cost.totalCost)}원 整 `);
      setNumCell(wsCover, 7, 24, cost.totalCost);
      // R7: 부가가치세 한글 (N8)
      setCell(wsCover, 8, 14, `${numberToKorean(cost.vat)}원 整 `);
      setNumCell(wsCover, 8, 24, cost.vat);
      // R9: 위치 (C10)
      setCell(wsCover, 10, 3, `▣ 위치: ${coverLocations}`);
    }

    /* ── 원가계산서 (Sheet 3) ── */
    const wsCostCalc = wb.getWorksheet('원가계산서');
    if (wsCostCalc) {
      // 템플릿 행 매핑 (1-indexed): Row 1=제목, Row 3=헤더, Row 4~
      setNumCell(wsCostCalc, 4, 4, cost.materialCost);   // 재료비
      setCell(wsCostCalc, 4, 6, '잡자재비 포함');
      setNumCell(wsCostCalc, 5, 4, cost.materialCost);   // 소계
      setNumCell(wsCostCalc, 6, 4, cost.directLabor);    // 직접노무비
      setNumCell(wsCostCalc, 7, 4, cost.indirectLabor);  // 간접노무비
      setCell(wsCostCalc, 7, 6, '직접노무비 * 15%');
      setNumCell(wsCostCalc, 8, 4, cost.totalLabor);     // 노무비 소계
      setNumCell(wsCostCalc, 9, 4, cost.otherExpenses);  // 기타경비
      setCell(wsCostCalc, 9, 6, '(재료비 + 노무비) * 4.6%');
      setNumCell(wsCostCalc, 10, 4, cost.pensionInsurance); // 연금보험료
      setNumCell(wsCostCalc, 11, 4, cost.industrialAccident); // 산재보험료
      setCell(wsCostCalc, 11, 6, '(노무비) * 3.56%');
      setNumCell(wsCostCalc, 12, 4, cost.healthInsurance);  // 건강보험료
      setNumCell(wsCostCalc, 13, 4, cost.longTermCare);     // 노인장기요양보험료
      setNumCell(wsCostCalc, 14, 4, cost.safetyManagement); // 산업안전보건관리비
      setCell(wsCostCalc, 14, 6, '(재료비+직접노무비) * 2.07%');
      setNumCell(wsCostCalc, 15, 4, cost.employmentInsurance); // 고용보험료
      setCell(wsCostCalc, 15, 6, '(노무비) * 1.01%');
      setNumCell(wsCostCalc, 16, 4, cost.asbestosFund);     // 석면분담금
      setCell(wsCostCalc, 16, 6, '(노무비) * 0.006%');
      setNumCell(wsCostCalc, 17, 4, cost.wageClaimBurden);  // 임금채권부담금
      setCell(wsCostCalc, 17, 6, '(노무비) * 0.09%');
      setNumCell(wsCostCalc, 18, 4, cost.totalExpenses);    // 경비 소계
      setNumCell(wsCostCalc, 19, 4, cost.subtotal);         // 순공사비계
      setNumCell(wsCostCalc, 20, 4, cost.generalAdmin);     // 일반관리비
      setCell(wsCostCalc, 20, 6, '(재료비+노무비+경비) * 8%');
      setNumCell(wsCostCalc, 21, 4, cost.profit);           // 이윤
      setCell(wsCostCalc, 21, 6, `(노무비+경비+일반관리비) * ${data.profitRate ?? 15}%`);
      setNumCell(wsCostCalc, 22, 4, cost.totalCost);        // 총원가
      setNumCell(wsCostCalc, 23, 4, cost.vat);              // 부가가치세
      setCell(wsCostCalc, 23, 6, '10%');
      setNumCell(wsCostCalc, 24, 4, cost.total);            // 도급공사비
    }

    /* ── 설계내역서 (Sheet 4) ── */
    const wsEstimate = wb.getWorksheet('설계내역서');
    if (wsEstimate) {
      // 헤더: Row 1=제목, Row 3=헤더1, Row 4=헤더2 (단가/금액)
      // 데이터: Row 5부터 (합계행은 Row 5, 데이터는 Row 6~)
      // 템플릿 구조: A=연번, B=품명, C=규격, D=단위, E=수량, F=재료비단가, G=재료비금액, H=노무비단가, I=노무비금액, J=경비단가, K=경비금액, L=계, M=비고
      const startRow = 5; // 합계행
      const dataStartRow = 6; // 실제 데이터 시작
      
      // 먼저 기존 데이터 행 제거 (템플릿 샘플 데이터), 합계행+기존행 개수
      const templateDataRows = wsEstimate.rowCount - dataStartRow + 1;
      // 새 데이터 행 삽입
      const items = data.estimateItems;
      const miscRate = data.miscMatRate ?? 5;
      const matSum = items.reduce((s, e) => s + e.quantity * e.unitPrice, 0);
      const miscAmt = Math.floor(matSum * miscRate / 100);
      const totalMat = matSum + miscAmt;
      const totalLab = items.reduce((s, e) => s + e.quantity * (e.labUnitPrice ?? 0), 0);
      const totalExp = items.reduce((s, e) => s + (e.expAmount != null ? e.expAmount : e.quantity * (e.expUnitPrice ?? 0)), 0);

      // 합계행 (Row 5)
      setNumCell(wsEstimate, startRow, 7, totalMat);        // G: 재료비 합
      setNumCell(wsEstimate, startRow, 9, totalLab);        // I: 노무비 합
      setNumCell(wsEstimate, startRow, 11, totalExp);       // K: 경비 합
      setNumCell(wsEstimate, startRow, 12, totalMat + totalLab + totalExp); // L: 계

      // 데이터 행 쓰기
      items.forEach((e, i) => {
        const r = dataStartRow + i;
        const matAmt = e.quantity * e.unitPrice;
        const labAmt = e.quantity * (e.labUnitPrice ?? 0);
        const expAmt = e.expAmount != null ? e.expAmount : e.quantity * (e.expUnitPrice ?? 0);
        setCell(wsEstimate, r, 1, i + 1);          // A: 연번
        setCell(wsEstimate, r, 2, e.name);          // B: 품명
        setCell(wsEstimate, r, 3, e.spec);          // C: 규격
        setCell(wsEstimate, r, 4, e.unit);          // D: 단위
        setNumCell(wsEstimate, r, 5, e.quantity);   // E: 수량
        setNumCell(wsEstimate, r, 6, e.unitPrice);  // F: 재료비단가
        setNumCell(wsEstimate, r, 7, matAmt);       // G: 재료비금액
        setNumCell(wsEstimate, r, 8, e.labUnitPrice ?? 0); // H: 노무비단가
        setNumCell(wsEstimate, r, 9, labAmt);       // I: 노무비금액
        setNumCell(wsEstimate, r, 10, e.expUnitPrice ?? 0); // J: 경비단가
        setNumCell(wsEstimate, r, 11, expAmt);      // K: 경비금액
        setNumCell(wsEstimate, r, 12, matAmt + labAmt + expAmt); // L: 계
        setCell(wsEstimate, r, 13, e.memo ?? '');   // M: 비고
      });
      // 잡자재비 행
      const miscRow = dataStartRow + items.length;
      setCell(wsEstimate, miscRow, 1, items.length + 1);
      setCell(wsEstimate, miscRow, 2, '잡자재비');
      setCell(wsEstimate, miscRow, 3, `재료비의 ${miscRate}%`);
      setCell(wsEstimate, miscRow, 4, '식');
      setNumCell(wsEstimate, miscRow, 5, 1);
      setNumCell(wsEstimate, miscRow, 7, miscAmt);
      setNumCell(wsEstimate, miscRow, 12, miscAmt);
      clearRows(wsEstimate, miscRow + 1);
    }

    /* ── 일위대가표 (Sheet 5) ── */
    const wsUnitCost = wb.getWorksheet('일위대가표');
    if (wsUnitCost) {
      // 템플릿: Row 1=제목, Row 3=헤더1(연번,작업종별,...), Row 4=헤더2(단가,금액), Row 5~=데이터
      // A=연번, B=작업종별, C=규격, D=단위, E=수량, F=재료비단가, G=재료비금액, H=노무비단가, I=노무비금액, J=비고
      let r = 5;
      data.unitCosts.forEach((uc, i) => {
        const ucCalc = calcUcTotalsForExport(uc);
        // 제목행
        setCell(wsUnitCost, r, 1, i + 1);
        setCell(wsUnitCost, r, 2, uc.workType);
        setCell(wsUnitCost, r, 10, uc.ref ?? '');
        r++;
        // 상세행
        (uc.rows ?? []).forEach(row => {
          const isLabor = row.unit === '인';
          if (isLabor) {
            // 노무비 행: 이름은 C열(규격), B열(작업종별)은 비움 — 원본 형식
            setCell(wsUnitCost, r, 3, row.name);
          } else {
            // 품목/재료 행: 이름은 B열(작업종별), 규격은 C열
            setCell(wsUnitCost, r, 2, row.name);
            setCell(wsUnitCost, r, 3, row.spec);
          }
          setCell(wsUnitCost, r, 4, row.unit);
          setNumCell(wsUnitCost, r, 5, row.quantity);
          setNumCell(wsUnitCost, r, 6, row.matUnitPrice ?? 0);
          setNumCell(wsUnitCost, r, 7, row.matAmount ?? Math.floor((row.matUnitPrice ?? 0) * row.quantity));
          setNumCell(wsUnitCost, r, 8, row.labUnitPrice ?? 0);
          const labAmt = isLabor
            ? Math.floor((row.labUnitPrice ?? 0) * row.quantity * ucCalc.multiplier)
            : Math.floor((row.labUnitPrice ?? 0) * row.quantity);
          setNumCell(wsUnitCost, r, 9, row.labAmount ?? labAmt);
          setCell(wsUnitCost, r, 10, row.memo ?? '');
          r++;
        });
        // 합계행
        setCell(wsUnitCost, r, 2, '계');
        setNumCell(wsUnitCost, r, 7, ucCalc.mat);
        setNumCell(wsUnitCost, r, 9, ucCalc.lab);
        r++;
        // 빈 행
        r++;
      });
      clearRows(wsUnitCost, r);
    }

    /* ── 자재단가표 (Sheet 6) ── */
    const wsMaterial = wb.getWorksheet('자재단가표');
    if (wsMaterial) {
      // Row 1=제목, Row 3=헤더1, Row 4=헤더2, Row 5~=데이터
      // A=연번, B=품명, C=규격, D=단위, E=견적1, F=견적2, G=견적3, H=적용단가, I=비고
      data.materials.forEach((m, i) => {
        const r = 5 + i;
        setCell(wsMaterial, r, 1, i + 1);
        setCell(wsMaterial, r, 2, m.name);
        setCell(wsMaterial, r, 3, m.spec);
        setCell(wsMaterial, r, 4, m.unit);
        setNumCell(wsMaterial, r, 5, m.quote1);
        setNumCell(wsMaterial, r, 6, m.quote2);
        setNumCell(wsMaterial, r, 7, m.quote3);
        setNumCell(wsMaterial, r, 8, m.unitPrice);
      });
      clearRows(wsMaterial, 5 + data.materials.length);
    }

    /* ── 노임단가표 (Sheet 7) ── */
    const wsLabor = wb.getWorksheet('노임단가표');
    if (wsLabor) {
      // Row 1=제목 (연도 포함), Row 3=헤더, Row 4~=데이터
      // A=연번, B=직종분류, C=단가, D=단가표번호
      setCell(wsLabor, 1, 1, `노임단가표(${data.year}년 상반기)`);
      data.laborRates.forEach((lr, i) => {
        const r = 4 + i;
        setCell(wsLabor, r, 1, i + 1);
        setCell(wsLabor, r, 2, lr.category ?? lr.type);
        setNumCell(wsLabor, r, 3, lr.dailyRate);
        setCell(wsLabor, r, 4, lr.refCode ?? '');
      });
      clearRows(wsLabor, 4 + data.laborRates.length);
    }

    /* ── 산출집계표 (Sheet 8) ── */
    const wsSummary = wb.getWorksheet('산출집계표');
    if (wsSummary) {
      // Row 1=제목, Row 3=헤더, Row 4~=데이터
      // A=연번, B=품명, C=규격, D=단위, E=수량, F=비고
      const summaryItems = matrix.cols
        .map(col => {
          const total = matrix.rows.reduce((sum, r) => sum + (r.values[col.id] ?? 0), 0);
          return { name: col.name, spec: col.spec, unit: col.unit, quantity: total };
        })
        .filter(item => item.name);
      summaryItems.forEach((item, i) => {
        const r = 4 + i;
        setCell(wsSummary, r, 1, i + 1);
        setCell(wsSummary, r, 2, item.name);
        setCell(wsSummary, r, 3, item.spec);
        setCell(wsSummary, r, 4, item.unit);
        setNumCell(wsSummary, r, 5, item.quantity);
      });
      clearRows(wsSummary, 4 + summaryItems.length);
    }

    /* ── 물량내역서 (Sheet 9) ── */
    const wsQuantity = wb.getWorksheet('물량내역서');
    if (wsQuantity) {
      // Row 1=제목, Row 2=위치, Row 3=헤더(구분,품명,...), Row 4=규격, Row 5=단위, Row 6=합계, Row 7~=데이터
      // A=구분, B=위치, C~=각 자재
      const qmCols = matrix.cols;
      // 위치 행
      setCell(wsQuantity, 2, 1, `▣ 위치: ${coverLocations}`);
      // 헤더행 (품명)
      qmCols.forEach((col, ci) => {
        setCell(wsQuantity, 3, 3 + ci, col.name);
        setCell(wsQuantity, 4, 3 + ci, col.spec);
        setCell(wsQuantity, 5, 3 + ci, col.unit);
        // 합계
        const total = matrix.rows.reduce((s, r) => s + (r.values[col.id] ?? 0), 0);
        setNumCell(wsQuantity, 6, 3 + ci, total);
      });
      // 데이터행
      matrix.rows.forEach((row, ri) => {
        const r = 7 + ri;
        setCell(wsQuantity, r, 1, row.group);
        setCell(wsQuantity, r, 2, row.location);
        qmCols.forEach((col, ci) => {
          const v = row.values[col.id] ?? 0;
          if (v) setNumCell(wsQuantity, r, 3 + ci, v);
        });
      });
      clearRows(wsQuantity, 7 + matrix.rows.length);
    }

    /* ── 구성도 (Sheet 10) ── */
    const wsDiagram = wb.getWorksheet('구성도');
    if (wsDiagram) {
      // 기존 이미지/드로잉 참조 초기화 (getImages/removeImage는 XML 손상 유발)
      (wsDiagram as any)._media = [];

      setCell(wsDiagram, 1, 1, '구성도');
      const pngBase64 = await diagramToBase64(data.diagramData);
      if (pngBase64) {
        const imgId = wb.addImage({ base64: pngBase64, extension: 'png' });
        wsDiagram.addImage(imgId, {
          tl: { col: 0, row: 1 },
          ext: { width: 720, height: 480 },
        });
      }
    }

    // 정의된 이름(Named Ranges) 제거 — 행 수 변경으로 참조 깨짐 방지
    if ((wb as any).definedNames) {
      (wb as any).definedNames.model = [];
    }

    // 파일 저장
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${data.projectName}_설계내역.xlsx`);
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" /> 설계내역서
          </h2>
          <input className="border rounded px-2 py-1 text-sm font-medium flex-1 min-w-[400px]" value={data.projectName}
            onChange={e => updateData({ projectName: e.target.value })} />
          <input type="number" className="border rounded px-2 py-1 text-sm w-20" value={data.year}
            onChange={e => updateData({ year: parseInt(e.target.value) || new Date().getFullYear() })} />
          <span className="text-sm text-gray-500">년</span>
        </div>
        <div className="flex gap-2">
          {activeSheet === 'cover' && (
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExportExcel}>
              <Download className="h-3.5 w-3.5" /> 엑셀 내보내기
            </Button>
          )}
        </div>
      </div>

      {/* 시트 탭 */}
      <div className="flex border-b mb-4 overflow-x-auto">
        {SHEET_TABS.map(tab => (
          <button key={tab.id}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeSheet === tab.id ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
            onClick={() => setActiveSheet(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 시트 내용 */}
      <div className="bg-white p-4 rounded-lg border min-h-[400px]">
        {activeSheet === 'cover' && <CoverSheet data={data} onChange={updateData} />}
        {activeSheet === 'labor' && <LaborSheet data={data} onChange={updateData} />}
        {activeSheet === 'material' && <MaterialSheet data={data} onChange={updateData} />}
        {activeSheet === 'unit-cost' && <UnitCostSheet data={data} onChange={updateData} />}
        {activeSheet === 'quantity' && <QuantitySheet data={data} onChange={updateData} />}
        {activeSheet === 'estimate' && <EstimateSheet data={data} onChange={updateData} />}
        {activeSheet === 'cost-calc' && <CostCalcSheet data={data} onChange={updateData} />}
        {activeSheet === 'summary' && <SummarySheet data={data} />}
        {activeSheet === 'diagram' && (
          <DiagramSheet value={data.diagramData} onChange={d => updateData({ diagramData: d })} />
        )}
      </div>

      {/* 하단 원가 요약 */}
      {(() => {
        const c = calcCost(data);
        return (
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-2 text-center">
            <div className="bg-green-50 rounded p-2"><div className="text-xs text-green-600">재료비</div><div className="font-bold text-green-800">{fmt(c.materialCost)}</div></div>
            <div className="bg-blue-50 rounded p-2"><div className="text-xs text-blue-600">노무비</div><div className="font-bold text-blue-800">{fmt(c.totalLabor)}</div></div>
            <div className="bg-orange-50 rounded p-2"><div className="text-xs text-orange-600">경비</div><div className="font-bold text-orange-800">{fmt(c.totalExpenses)}</div></div>
            <div className="bg-yellow-50 rounded p-2"><div className="text-xs text-yellow-600">총원가</div><div className="font-bold text-yellow-800">{fmt(c.totalCost)}</div></div>
            <div className="bg-gray-50 rounded p-2"><div className="text-xs text-gray-600">부가세</div><div className="font-bold text-gray-800">{fmt(c.vat)}</div></div>
            <div className="bg-purple-50 rounded p-2"><div className="text-xs text-purple-600">도급공사비</div><div className="font-bold text-purple-800">{fmt(c.total)}</div></div>
          </div>
        );
      })()}
    </div>
  );
}
