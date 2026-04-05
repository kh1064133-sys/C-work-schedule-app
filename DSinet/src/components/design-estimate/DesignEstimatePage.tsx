'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Save, FileSpreadsheet, Search, X, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getStoredValue, setStoredValue } from '@/lib/storage';
import { useItems } from '@/hooks/useItems';
import type { Item } from '@/types';

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

interface SummaryItem {
  id: string;
  category: string;   // 공종
  name: string;       // 항목명
  spec: string;       // 규격
  unit: string;       // 단위
  quantity: number;   // 수량
  unitPrice: number;  // 단가
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
}

interface ProjectData {
  projectName: string;
  year: number;
  laborRates: LaborRate[];
  materials: Material[];
  unitCosts: UnitCost[];
  quantities: QuantityItem[];
  summaryItems: SummaryItem[];
  estimateItems: DesignEstimateItem[];
}

const STORAGE_KEY = 'design_estimate';

type SheetTab = 'estimate' | 'cost-calc' | 'labor' | 'material' | 'unit-cost' | 'quantity' | 'summary' | 'diagram';

const SHEET_TABS: { id: SheetTab; label: string }[] = [
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
      { id: crypto.randomUUID(), type: '전기공', dailyRate: 230000 },
      { id: crypto.randomUUID(), type: '배관공', dailyRate: 220000 },
      { id: crypto.randomUUID(), type: '보통인부', dailyRate: 160000 },
    ],
    materials: [
      { id: crypto.randomUUID(), name: 'PVC관', spec: 'Ø50mm', unit: 'm', quote1: 0, quote2: 0, quote3: 0, unitPrice: 3500, quantity: 0 },
    ],
    unitCosts: INITIAL_UNIT_COSTS,
    quantities: [],
    summaryItems: [],
    estimateItems: [],
  };
}

/* ─── Calculation engine: 원가계산서 ─── */
function calcCost(data: ProjectData) {
  // 설계내역서에서 합계 산출
  const materialCost = data.estimateItems.filter(i => i.category === 'material').reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const directLabor = data.estimateItems.filter(i => i.category === 'labor').reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const expenseDirect = data.estimateItems.filter(i => i.category === 'expense').reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const indirectLabor = Math.round(directLabor * 0.15);
  const totalLabor = directLabor + indirectLabor;
  const otherExpenses = Math.round((materialCost + totalLabor) * 0.046);
  const industrialAccident = Math.round(totalLabor * 0.0356);
  const safetyManagement = Math.round((materialCost + directLabor) * 0.0207);
  const employmentInsurance = Math.round(totalLabor * 0.0101);
  const totalExpenses = expenseDirect + otherExpenses + industrialAccident + safetyManagement + employmentInsurance;
  const subtotal = materialCost + totalLabor + totalExpenses;
  const generalAdmin = Math.round(subtotal * 0.08);
  const profit = Math.round((totalLabor + totalExpenses + generalAdmin) * 0.15);
  const totalCost = subtotal + generalAdmin + profit;
  const vat = Math.round(totalCost * 0.1);
  const total = totalCost + vat;

  return {
    materialCost, directLabor, indirectLabor, totalLabor,
    otherExpenses, industrialAccident, safetyManagement, employmentInsurance,
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
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-blue-50 border">
            <th className="border p-2 w-10">No</th>
            <th className="border p-2 w-36">직종분류</th>
            <th className="border p-2 w-36">단가(원)</th>
            <th className="border p-2 w-36">단가표번호</th>
            <th className="border p-2 w-12 no-print"></th>
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
  );
}

/* ════════════════════ Sheet: 자재단가표 ════════════════════ */
function MaterialSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = () => onChange({ materials: [...data.materials, { id: crypto.randomUUID(), name: '', spec: '', unit: '개', quote1: 0, quote2: 0, quote3: 0, unitPrice: 0, quantity: 0 }] });
  const del = (id: string) => onChange({ materials: data.materials.filter(m => m.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ materials: data.materials.map(m => m.id === id ? { ...m, [field]: val } : m) });

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
      <table className="w-full border-collapse text-sm">
        <thead className="bg-green-50">
          <tr>
            <th className="border p-2 w-10 align-middle" rowSpan={2}>연번</th>
            <th className="border p-2 align-middle" rowSpan={2}>품명</th>
            <th className="border p-2 w-[300px] align-middle" rowSpan={2}>규격</th>
            <th className="border p-2 w-14 align-middle" rowSpan={2}>단위</th>
            <th className="border p-2 text-center" colSpan={3}>비교 견적</th>
            <th className="border p-2 w-28 align-middle" rowSpan={2}>적용단가</th>
            <th className="border p-2 w-12 no-print align-middle" rowSpan={2}></th>
          </tr>
          <tr className="bg-green-50">
            <th className="border p-2 w-28">견적1</th>
            <th className="border p-2 w-28">견적2</th>
            <th className="border p-2 w-28">견적3</th>
          </tr>
        </thead>
        <tbody>
          {data.materials.map((m, i) => (
            <tr key={m.id} className="border hover:bg-gray-50">
              <td className="border p-1 text-center text-gray-500">{i + 1}</td>
              <td className="border p-1">
                <ItemNameCell
                  value={m.name}
                  onChange={v => upd(m.id, 'name', v)}
                  onSelect={item => onChange({ materials: data.materials.map(r => r.id === m.id ? { ...r, name: item.name, spec: item.spec ?? r.spec, unit: (item as Item & { unit?: string }).unit ?? r.unit, unitPrice: item.price || r.unitPrice } : r) })}
                />
              </td>
              <td className="border p-1"><TextInput value={m.spec} onChange={v => upd(m.id, 'spec', v)} /></td>
              <td className="border p-1"><TextInput value={m.unit} onChange={v => upd(m.id, 'unit', v)} /></td>
              <td className="border p-1">
                <div className="relative group">
                  <NumInput value={m.quote1 ?? 0} onChange={v => upd(m.id, 'quote1', v)} />
                  {(m.quote1 ?? 0) > 0 && (
                    <button
                      title="적용단가로 설정"
                      onClick={() => upd(m.id, 'unitPrice', m.quote1 ?? 0)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] leading-none px-1 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >적용</button>
                  )}
                </div>
              </td>
              <td className="border p-1">
                <div className="relative group">
                  <NumInput value={m.quote2 ?? 0} onChange={v => upd(m.id, 'quote2', v)} />
                  {(m.quote2 ?? 0) > 0 && (
                    <button
                      title="적용단가로 설정"
                      onClick={() => upd(m.id, 'unitPrice', m.quote2 ?? 0)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] leading-none px-1 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >적용</button>
                  )}
                </div>
              </td>
              <td className="border p-1">
                <div className="relative group">
                  <NumInput value={m.quote3 ?? 0} onChange={v => upd(m.id, 'quote3', v)} />
                  {(m.quote3 ?? 0) > 0 && (
                    <button
                      title="적용단가로 설정"
                      onClick={() => upd(m.id, 'unitPrice', m.quote3 ?? 0)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] leading-none px-1 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
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

  // 하단 요약 계산
  const totalMaterial = data.unitCosts.reduce((s, uc) => s + (uc.rows ?? []).reduce((rs, r) => rs + (r.matAmount ?? Math.round((r.matUnitPrice ?? 0) * r.quantity)), 0), 0);
  const directLabor = data.unitCosts.reduce((s, uc) => s + (uc.rows ?? []).reduce((rs, r) => rs + (r.labAmount ?? Math.round((r.labUnitPrice ?? 0) * r.quantity)), 0), 0);
  const indirectLabor = Math.round(directLabor * 0.15);
  const totalLabor = directLabor + indirectLabor;
  const otherExp = Math.round((totalMaterial + totalLabor) * 0.046);
  const accident = Math.round(totalLabor * 0.0356);
  const safety = Math.round((totalMaterial + directLabor) * 0.0207);
  const employment = Math.round(totalLabor * 0.0101);
  const totalExpense = otherExp + accident + safety + employment;
  const subtotal = totalMaterial + totalLabor + totalExpense;
  const generalAdmin = Math.round(subtotal * 0.08);
  const profit = Math.round((totalLabor + totalExpense + generalAdmin) * 0.15);
  const totalCost = subtotal + generalAdmin + profit;
  const vat = Math.round(totalCost * 0.1);
  const grandTotal = totalCost + vat;

  const thStyle = 'border border-gray-400 p-1 text-center align-middle bg-gray-100 text-xs font-bold';
  const tdStyle = 'border border-gray-300 p-1 text-sm';

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

      <table className="w-full border-collapse text-sm" style={{ borderColor: '#999' }}>
        {/* ── 2단 헤더 ── */}
        <thead>
          <tr>
            <th className={thStyle} rowSpan={2} style={{ width: 60 }}>연번</th>
            <th className={thStyle} rowSpan={2}>작업종별</th>
            <th className={thStyle} rowSpan={2} style={{ width: 120 }}>규&nbsp;&nbsp;격</th>
            <th className={thStyle} rowSpan={2} style={{ width: 48 }}>단위</th>
            <th className={thStyle} rowSpan={2} style={{ width: 60 }}>수&nbsp;량</th>
            <th className={`${thStyle} bg-green-50`} colSpan={2}>재&nbsp;료&nbsp;비</th>
            <th className={`${thStyle} bg-blue-50`} colSpan={2}>노&nbsp;무&nbsp;비</th>
            <th className={thStyle} rowSpan={2} style={{ width: 100 }}>비&nbsp;고</th>
            <th className={`${thStyle} no-print`} rowSpan={2} style={{ width: 32 }}></th>
          </tr>
          <tr>
            <th className={`${thStyle} bg-green-50`} style={{ width: 90 }}>단&nbsp;가</th>
            <th className={`${thStyle} bg-green-50`} style={{ width: 100 }}>금&nbsp;액</th>
            <th className={`${thStyle} bg-blue-50`} style={{ width: 90 }}>단&nbsp;가</th>
            <th className={`${thStyle} bg-blue-50`} style={{ width: 100 }}>금&nbsp;액</th>
          </tr>
        </thead>
        <tbody>
          {data.unitCosts.map((uc, i) => {
            const matTotal = (uc.rows ?? []).reduce((s, r) => s + (r.matAmount ?? Math.round((r.matUnitPrice ?? 0) * r.quantity)), 0);
            const laborTotal = (uc.rows ?? []).reduce((s, r) => s + (r.labAmount ?? Math.round((r.labUnitPrice ?? 0) * r.quantity)), 0);
            return (
              <React.Fragment key={uc.id}>
                {/* ── 공종 헤더 행 ── */}
                <tr style={{ background: '#fffbe6' }}>
                  <td className={`${tdStyle} text-center font-bold text-xs`}>
                    제{i + 1}호표
                  </td>
                  <td className={tdStyle} colSpan={4}>
                    <TextInput value={uc.workType} onChange={v => updUC(uc.id, { workType: v })} placeholder="공종명" className="font-bold" />
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
                  return (
                  <tr key={`row-${ri}`} className="hover:bg-gray-50">
                    <td className={`${tdStyle} text-center text-gray-400`}>{ri + 1}</td>
                    <td className={tdStyle}>
                      <TextInput value={row.name} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, name: v }; updUC(uc.id, { rows: nr }); }} placeholder="품목명/직종명" />
                    </td>
                    <td className={tdStyle}>
                      <TextInput value={row.spec} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, spec: v }; updUC(uc.id, { rows: nr }); }} />
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
                      <NumInput value={row.matAmount ?? Math.round((row.matUnitPrice ?? 0) * row.quantity)} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, matAmount: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={tdStyle}>
                      <NumInput value={row.labUnitPrice ?? 0} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, labUnitPrice: v }; updUC(uc.id, { rows: nr }); }} />
                    </td>
                    <td className={tdStyle}>
                      <NumInput value={row.labAmount ?? Math.round((row.labUnitPrice ?? 0) * row.quantity)} onChange={v => { const nr = [...ucRows]; nr[ri] = { ...row, labAmount: v }; updUC(uc.id, { rows: nr }); }} />
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
                  <td className={`${tdStyle} font-bold text-xs text-center`} colSpan={4} style={{ background: '#dce8fb' }}>재료비 + 노무비</td>
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

      {/* 하단 고정 요약바 */}
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
function QuantitySheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = () => onChange({ quantities: [...data.quantities, { id: crypto.randomUUID(), workType: '', location: '', quantity: 0, unit: '식' }] });
  const del = (id: string) => onChange({ quantities: data.quantities.filter(q => q.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ quantities: data.quantities.map(q => q.id === id ? { ...q, [field]: val } : q) });

  const handleExcel = async (file: File) => {
    try {
      const rows = await readExcelFile(file);
      if (rows.length < 1) { alert('데이터가 없습니다.'); return; }
      const h = rows[0].map(c => String(c ?? '').trim().toLowerCase());
      const hasHeader = ['공종', '위치', '수량'].some(k => h.includes(k));
      const dataRows = hasHeader ? rows.slice(1) : rows;
      let wtIdx = xFindCol(h, '공종', '공종명', 'worktype'); if (wtIdx < 0) wtIdx = 0;
      let locIdx = xFindCol(h, '위치', 'location'); if (locIdx < 0) locIdx = 1;
      let qtyIdx = xFindCol(h, '수량', 'qty', 'quantity'); if (qtyIdx < 0) qtyIdx = 2;
      let unitIdx = xFindCol(h, '단위', 'unit'); if (unitIdx < 0) unitIdx = 3;
      const added = dataRows
        .map(row => ({ id: crypto.randomUUID(), workType: xCell(row, wtIdx), location: xCell(row, locIdx), quantity: xFloat(row, qtyIdx), unit: xCell(row, unitIdx) || '식' }))
        .filter(r => r.workType);
      if (added.length === 0) { alert('공종 데이터를 찾을 수 없습니다.'); return; }
      onChange({ quantities: [...data.quantities, ...added] });
      alert(`${added.length}개 항목이 추가되었습니다.`);
    } catch { alert('엑셀 파일을 읽는 중 오류가 발생했습니다.'); }
  };

  // 공종별 합계
  const grouped = useMemo(() => {
    const g: Record<string, number> = {};
    data.quantities.forEach(q => { g[q.workType] = (g[q.workType] || 0) + q.quantity; });
    return g;
  }, [data.quantities]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">물량내역서</h3>
        <div className="flex gap-2 no-print">
          <ExcelImportBtn onFile={handleExcel} />
          <Button variant="outline" size="sm" className="gap-1" onClick={add}><Plus className="h-3.5 w-3.5" /> 추가</Button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">헤더 구성: <span className="font-mono bg-gray-100 px-1 rounded">공종 | 위치 | 수량 | 단위</span></p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-yellow-50 border">
            <th className="border p-2 w-12">No</th>
            <th className="border p-2">공종</th>
            <th className="border p-2">위치</th>
            <th className="border p-2 w-20">수량</th>
            <th className="border p-2 w-16">단위</th>
            <th className="border p-2 w-16 no-print"></th>
          </tr>
        </thead>
        <tbody>
          {data.quantities.map((q, i) => (
            <tr key={q.id} className="border hover:bg-gray-50">
              <td className="border p-1 text-center text-gray-500">{i + 1}</td>
              <td className="border p-1"><TextInput value={q.workType} onChange={v => upd(q.id, 'workType', v)} /></td>
              <td className="border p-1"><TextInput value={q.location} onChange={v => upd(q.id, 'location', v)} /></td>
              <td className="border p-1"><NumInput value={q.quantity} onChange={v => upd(q.id, 'quantity', v)} /></td>
              <td className="border p-1"><TextInput value={q.unit} onChange={v => upd(q.id, 'unit', v)} /></td>
              <td className="border p-1 text-center no-print">
                <button className="text-red-500 hover:text-red-700" onClick={() => del(q.id)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {Object.keys(grouped).length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold text-sm mb-2">📊 산출집계표</h4>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="bg-orange-50 border">
              <th className="border p-2">공종</th><th className="border p-2 w-28">합계 수량</th>
            </tr></thead>
            <tbody>
              {Object.entries(grouped).filter(([k]) => k).map(([workType, total]) => (
                <tr key={workType} className="border">
                  <td className="border p-2">{workType}</td>
                  <td className="border p-2 text-right font-medium">{fmt(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════ Sheet: 산출집계표 ════════════════════ */
function SummarySheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = () => onChange({ summaryItems: [...(data.summaryItems ?? []), { id: crypto.randomUUID(), category: '', name: '', spec: '', unit: '식', quantity: 0, unitPrice: 0 }] });
  const del = (id: string) => onChange({ summaryItems: (data.summaryItems ?? []).filter(s => s.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ summaryItems: (data.summaryItems ?? []).map(s => s.id === id ? { ...s, [field]: val } : s) });

  const handleExcel = async (file: File) => {
    try {
      const rows = await readExcelFile(file);
      if (rows.length < 1) { alert('데이터가 없습니다.'); return; }
      const h = rows[0].map(c => String(c ?? '').trim().toLowerCase());
      const hasHeader = ['공종', '항목명', '수량', '단가'].some(k => h.includes(k));
      const dataRows = hasHeader ? rows.slice(1) : rows;
      let catIdx = xFindCol(h, '공종', '공종명', 'category'); if (catIdx < 0) catIdx = 0;
      let nameIdx = xFindCol(h, '항목명', '품명', 'name'); if (nameIdx < 0) nameIdx = 1;
      let specIdx = xFindCol(h, '규격', 'spec'); if (specIdx < 0) specIdx = 2;
      let unitIdx = xFindCol(h, '단위', 'unit'); if (unitIdx < 0) unitIdx = 3;
      let qtyIdx = xFindCol(h, '수량', 'qty'); if (qtyIdx < 0) qtyIdx = 4;
      let priceIdx = xFindCol(h, '단가', '단가(원)', 'price'); if (priceIdx < 0) priceIdx = 5;
      const added = dataRows
        .map(row => ({
          id: crypto.randomUUID(),
          category: xCell(row, catIdx),
          name: xCell(row, nameIdx),
          spec: xCell(row, specIdx),
          unit: xCell(row, unitIdx) || '식',
          quantity: xFloat(row, qtyIdx),
          unitPrice: xNum(row, priceIdx),
        }))
        .filter(r => r.name);
      if (added.length === 0) { alert('항목명 데이터를 찾을 수 없습니다.'); return; }
      onChange({ summaryItems: [...(data.summaryItems ?? []), ...added] });
      alert(`${added.length}개 항목이 추가되었습니다.`);
    } catch { alert('엑셀 파일을 읽는 중 오류가 발생했습니다.'); }
  };

  const items = data.summaryItems ?? [];
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">산출집계표</h3>
        <div className="flex gap-2 no-print">
          <ExcelImportBtn onFile={handleExcel} />
          <Button variant="outline" size="sm" className="gap-1" onClick={add}><Plus className="h-3.5 w-3.5" /> 추가</Button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">헤더 구성: <span className="font-mono bg-gray-100 px-1 rounded">공종 | 항목명 | 규격 | 단위 | 수량 | 단가</span></p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-orange-50 border">
            <th className="border p-2 w-10">No</th>
            <th className="border p-2 w-28">공종</th>
            <th className="border p-2">항목명</th>
            <th className="border p-2 w-24">규격</th>
            <th className="border p-2 w-14">단위</th>
            <th className="border p-2 w-20">수량</th>
            <th className="border p-2 w-28">단가(원)</th>
            <th className="border p-2 w-28">금액(원)</th>
            <th className="border p-2 w-14 no-print"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className="border hover:bg-gray-50">
              <td className="border p-1 text-center text-gray-500">{i + 1}</td>
              <td className="border p-1"><TextInput value={item.category} onChange={v => upd(item.id, 'category', v)} /></td>
              <td className="border p-1"><TextInput value={item.name} onChange={v => upd(item.id, 'name', v)} /></td>
              <td className="border p-1"><TextInput value={item.spec} onChange={v => upd(item.id, 'spec', v)} /></td>
              <td className="border p-1"><TextInput value={item.unit} onChange={v => upd(item.id, 'unit', v)} /></td>
              <td className="border p-1"><NumInput value={item.quantity} onChange={v => upd(item.id, 'quantity', v)} /></td>
              <td className="border p-1"><NumInput value={item.unitPrice} onChange={v => upd(item.id, 'unitPrice', v)} /></td>
              <td className="border p-1 text-right pr-3 font-medium">{fmt(item.quantity * item.unitPrice)}</td>
              <td className="border p-1 text-center no-print">
                <button className="text-red-500 hover:text-red-700" onClick={() => del(item.id)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-bold">
            <td colSpan={7} className="border p-2 text-center">합계</td>
            <td className="border p-2 text-right pr-3">{fmt(total)}</td>
            <td className="border no-print"></td>
          </tr>
        </tfoot>
      </table>
      {items.length === 0 && <p className="text-gray-400 text-center py-8 text-sm">항목을 추가하거나 엑셀 파일을 불러오세요.</p>}
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
      amount = isNaN(pct) ? 0 : Math.round(runningTotal * pct / 100);
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

  const categories: { key: 'material' | 'labor' | 'expense'; label: string; bg: string; hdrBg: string }[] = [
    { key: 'material', label: '재료비',      bg: 'bg-green-50',  hdrBg: 'bg-green-100' },
    { key: 'labor',    label: '노무비(직접)', bg: 'bg-blue-50',   hdrBg: 'bg-blue-100'  },
    { key: 'expense',  label: '경비(직접)',   bg: 'bg-orange-50', hdrBg: 'bg-orange-100' },
  ];

  const amountMap = computeEstimateAmounts(data.estimateItems);
  // 총 컬럼 수: 연번+품명+규격+단위+수량 + 재료비×2 + 노무비×2 + 경비×2 + 계 + 비고 + del = 14
  const COLS = 14;

  const renderCell = (item: DesignEstimateItem, cat: typeof categories[0]) => {
    if (cat.key === 'material') {
      const expr = item.unitPriceExpr ?? String(item.unitPrice || '');
      const isPercent = expr.trim().endsWith('%');
      // % 기준: 해당 행 이전 모든 행의 재료비 금액 누적합
      const baseAmount = (() => {
        let t = 0;
        for (const e of data.estimateItems) {
          if (e.id === item.id) break;
          t += e.quantity * e.unitPrice;
        }
        return t;
      })();
      const computedUnitPrice = isPercent
        ? (() => { const pct = parseFloat(expr.slice(0, -1)); return isNaN(pct) ? 0 : Math.round(baseAmount * pct / 100 / (item.quantity || 1)); })()
        : item.unitPrice;
      const amount = item.quantity * computedUnitPrice;
      return (
        <>
          <td className="border p-1">
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className={`w-full px-2 py-1 border rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 ${isPercent ? 'bg-purple-50 text-purple-700' : ''}`}
                defaultValue={expr}
                key={expr}
                onBlur={e => {
                  const val = e.target.value.trim();
                  if (val.endsWith('%')) {
                    const pct = parseFloat(val.slice(0, -1));
                    const computed = isNaN(pct) ? 0 : Math.round(baseAmount * pct / 100 / (item.quantity || 1));
                    onChange({ estimateItems: data.estimateItems.map(ei => ei.id === item.id ? { ...ei, unitPriceExpr: val, unitPrice: computed } : ei) });
                  } else {
                    const num = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
                    onChange({ estimateItems: data.estimateItems.map(ei => ei.id === item.id ? { ...ei, unitPriceExpr: '', unitPrice: num } : ei) });
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
              const newUnitPrice = item.quantity > 0 ? Math.round(v / item.quantity) : 0;
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">설계내역서</h3>
        <Button variant="outline" size="sm" className="gap-1 no-print" onClick={() => add('material')}>
          <Plus className="h-3.5 w-3.5" /> 추가
        </Button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1 w-10 align-middle" rowSpan={2}>연번</th>
            <th className="border p-1 w-[180px] align-middle" rowSpan={2}>품명</th>
            <th className="border p-1 w-[200px] align-middle" rowSpan={2}>규격</th>
            <th className="border p-1 w-14 align-middle" rowSpan={2}>단위</th>
            <th className="border p-1 w-16 align-middle" rowSpan={2}>수량</th>
            <th className="border p-1 text-center bg-green-50" colSpan={2}>재료비</th>
            <th className="border p-1 text-center bg-blue-50" colSpan={2}>노무비</th>
            <th className="border p-1 text-center bg-orange-50" colSpan={2}>경비</th>
            <th className="border p-1 w-28 align-middle" rowSpan={2}>계</th>
            <th className="border p-1 w-20 align-middle" rowSpan={2}>비고</th>
            <th className="border p-1 w-10 align-middle no-print" rowSpan={2}></th>
          </tr>
          <tr className="bg-gray-100">
            <th className="border p-1 w-24 bg-green-50">단가</th>
            <th className="border p-1 w-28 bg-green-50">금액</th>
            <th className="border p-1 w-24 bg-blue-50">단가</th>
            <th className="border p-1 w-28 bg-blue-50">금액</th>
            <th className="border p-1 w-24 bg-orange-50">단가</th>
            <th className="border p-1 w-28 bg-orange-50">금액</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-bold bg-gray-200 text-sm">
            <td colSpan={5} className="border p-1 text-center">합 계</td>
            <td colSpan={2} className="border p-1 text-right pr-2 bg-green-100">
              {fmt(data.estimateItems.reduce((s, e) => s + e.quantity * e.unitPrice, 0))}
            </td>
            <td colSpan={2} className="border p-1 text-right pr-2 bg-blue-100">
              {fmt(data.estimateItems.reduce((s, e) => s + e.quantity * (e.labUnitPrice ?? 0), 0))}
            </td>
            <td colSpan={2} className="border p-1 text-right pr-2 bg-orange-100">
              {fmt(data.estimateItems.reduce((s, e) => s + (e.expAmount != null ? e.expAmount : e.quantity * (e.expUnitPrice ?? 0)), 0))}
            </td>
            <td className="border p-1 text-right pr-2">
              {fmt(data.estimateItems.reduce((s, e) => s + e.quantity * (e.unitPrice + (e.labUnitPrice ?? 0)) + (e.expAmount != null ? e.expAmount : e.quantity * (e.expUnitPrice ?? 0)), 0))}
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
                        <ItemNameCell
                          value={item.name}
                          onChange={v => upd(item.id, 'name', v)}
                          onSelect={selected => onChange({
                            estimateItems: data.estimateItems.map(e =>
                              e.id === item.id ? { ...e, name: selected.name, spec: selected.spec ?? '', unit: (selected as any).unit ?? e.unit, unitPrice: selected.price ?? e.unitPrice } : e
                            ),
                          })}
                        />
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
                        {fmt(item.quantity * item.unitPrice + item.quantity * (item.labUnitPrice ?? 0) + (item.expAmount != null ? item.expAmount : item.quantity * (item.expUnitPrice ?? 0)))}
                      </td>
                      <td className="border p-1"><TextInput value={item.memo ?? ''} onChange={v => upd(item.id, 'memo', v)} /></td>
                      <td className="border p-1 text-center no-print">
                        <button className="text-red-400" onClick={() => del(item.id)}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════ Sheet: 원가계산서 ════════════════════ */
function CostCalcSheet({ data }: { data: ProjectData }) {
  const c = useMemo(() => calcCost(data), [data]);

  const rows: { label: string; formula: string; value: number; bold?: boolean; bg?: string }[] = [
    { label: '재료비', formula: '설계내역서 재료비 합계', value: c.materialCost },
    { label: '직접노무비', formula: '설계내역서 노무비 합계', value: c.directLabor },
    { label: '간접노무비', formula: '직접노무비 × 15%', value: c.indirectLabor },
    { label: '노무비 합계', formula: '직접 + 간접', value: c.totalLabor, bold: true, bg: 'bg-blue-50' },
    { label: '직접경비', formula: '설계내역서 경비 합계', value: c.expenseDirect },
    { label: '기타경비', formula: '(재료비+노무비) × 4.6%', value: c.otherExpenses },
    { label: '산재보험료', formula: '노무비 × 3.56%', value: c.industrialAccident },
    { label: '산업안전보건관리비', formula: '(재료비+직접노무비) × 2.07%', value: c.safetyManagement },
    { label: '고용보험료', formula: '노무비 × 1.01%', value: c.employmentInsurance },
    { label: '경비 합계', formula: '직접경비 + 간접경비', value: c.totalExpenses, bold: true, bg: 'bg-orange-50' },
    { label: '순공사비', formula: '재료비 + 노무비 + 경비', value: c.subtotal, bold: true, bg: 'bg-gray-100' },
    { label: '일반관리비', formula: '(재료비+노무비+경비) × 8%', value: c.generalAdmin },
    { label: '이윤', formula: '(노무비+경비+일반관리비) × 15%', value: c.profit },
    { label: '총원가', formula: '순공사비 + 일반관리비 + 이윤', value: c.totalCost, bold: true, bg: 'bg-yellow-50' },
    { label: '부가가치세', formula: '총원가 × 10%', value: c.vat },
    { label: '도급공사비', formula: '총원가 + 부가가치세', value: c.total, bold: true, bg: 'bg-purple-50' },
  ];

  return (
    <div>
      <h3 className="font-bold text-lg mb-3">원가계산서</h3>
      <p className="text-xs text-gray-500 mb-3">설계내역서 데이터를 기반으로 자동 계산됩니다.</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 border">
            <th className="border p-2 text-left">항목</th>
            <th className="border p-2 text-left">산출근거</th>
            <th className="border p-2 w-36 text-right">금액(원)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn('border', r.bg)}>
              <td className={cn('border p-2', r.bold && 'font-bold')}>{r.label}</td>
              <td className="border p-2 text-xs text-gray-500">{r.formula}</td>
              <td className={cn('border p-2 text-right pr-3', r.bold && 'font-bold text-blue-800')}>{fmt(r.value)}</td>
            </tr>
          ))}
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
    if (saved) setData(saved);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      // 빈 문자열/0 기본값 필드 제거로 용량 절약
      const slim: ProjectData = {
        ...data,
        estimateItems: data.estimateItems.map(e => {
          const o: Record<string, unknown> = { id: e.id, category: e.category, name: e.name, spec: e.spec, unit: e.unit, quantity: e.quantity, unitPrice: e.unitPrice };
          if (e.quantityExpr && e.quantityExpr !== String(e.quantity)) o.quantityExpr = e.quantityExpr;
          if (e.unitPriceExpr) o.unitPriceExpr = e.unitPriceExpr;
          if (e.labUnitPrice) o.labUnitPrice = e.labUnitPrice;
          if (e.expUnitPrice) o.expUnitPrice = e.expUnitPrice;
          return o as unknown as DesignEstimateItem;
        }),
        materials: data.materials.map(m => {
          const o: Record<string, unknown> = { id: m.id, name: m.name, spec: m.spec, unit: m.unit, unitPrice: m.unitPrice, quantity: m.quantity };
          if (m.quote1) o.quote1 = m.quote1;
          if (m.quote2) o.quote2 = m.quote2;
          if (m.quote3) o.quote3 = m.quote3;
          return o as unknown as Material;
        }),
      };
      setStoredValue(STORAGE_KEY, slim);
    }, 500);
    return () => clearTimeout(timer);
  }, [data, loaded]);

  const updateData = useCallback((partial: Partial<ProjectData>) => {
    setData(prev => ({ ...prev, ...partial }));
  }, []);

  const handleExportCSV = () => {
    const cost = calcCost(data);
    const lines = [
      ['항목', '금액'],
      ['재료비', cost.materialCost],
      ['직접노무비', cost.directLabor],
      ['간접노무비', cost.indirectLabor],
      ['노무비합계', cost.totalLabor],
      ['경비합계', cost.totalExpenses],
      ['일반관리비', cost.generalAdmin],
      ['이윤', cost.profit],
      ['총원가', cost.totalCost],
      ['부가가치세', cost.vat],
      ['도급공사비', cost.total],
    ];
    const csv = '\uFEFF' + lines.map(l => l.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${data.projectName}_원가계산서.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" /> 설계내역서
          </h2>
          <input className="border rounded px-2 py-1 text-sm font-medium" value={data.projectName}
            onChange={e => updateData({ projectName: e.target.value })} />
          <input type="number" className="border rounded px-2 py-1 text-sm w-20" value={data.year}
            onChange={e => updateData({ year: parseInt(e.target.value) || new Date().getFullYear() })} />
          <span className="text-sm text-gray-500">년</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5" /> CSV 내보내기
          </Button>
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
        {activeSheet === 'labor' && <LaborSheet data={data} onChange={updateData} />}
        {activeSheet === 'material' && <MaterialSheet data={data} onChange={updateData} />}
        {activeSheet === 'unit-cost' && <UnitCostSheet data={data} onChange={updateData} />}
        {activeSheet === 'quantity' && <QuantitySheet data={data} onChange={updateData} />}
        {activeSheet === 'estimate' && <EstimateSheet data={data} onChange={updateData} />}
        {activeSheet === 'cost-calc' && <CostCalcSheet data={data} />}
        {activeSheet === 'summary' && <SummarySheet data={data} onChange={updateData} />}
        {activeSheet === 'diagram' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400">
            <p className="text-lg font-semibold">구성도</p>
            <p className="text-sm mt-2">준비 중입니다.</p>
          </div>
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
