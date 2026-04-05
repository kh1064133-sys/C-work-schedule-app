'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, Download, Save, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getStoredValue, setStoredValue } from '@/lib/storage';

/* ════════════════════════ Types ════════════════════════ */
interface LaborRate {
  id: string;
  type: string;    // 직종명 e.g. '전기공','배관공'
  dailyRate: number;
}

interface Material {
  id: string;
  name: string;
  spec: string;
  unit: string;
  unitPrice: number;
  quantity: number;
}

interface UnitCostWorker {
  laborType: string;
  count: number;
  days: number;
}

interface UnitCostMaterial {
  materialName: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

interface UnitCost {
  id: string;
  workType: string;
  workers: UnitCostWorker[];
  materials: UnitCostMaterial[];
}

interface QuantityItem {
  id: string;
  workType: string;          // 일위대가 공종 참조
  location: string;          // 위치
  quantity: number;
  unit: string;
}

interface DesignEstimateItem {
  id: string;
  category: 'material' | 'labor' | 'expense';
  name: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

interface ProjectData {
  projectName: string;
  year: number;
  laborRates: LaborRate[];
  materials: Material[];
  unitCosts: UnitCost[];
  quantities: QuantityItem[];
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
      { id: crypto.randomUUID(), name: 'PVC관', spec: 'Ø50mm', unit: 'm', unitPrice: 3500, quantity: 0 },
    ],
    unitCosts: [],
    quantities: [],
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

/* ─── 공통 편집 입력 ─── */
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

function TextInput({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <input type="text" className={cn('w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300', className)}
      value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  );
}

/* ════════════════════ Sheet: 노임단가표 ════════════════════ */
function LaborSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = () => onChange({ laborRates: [...data.laborRates, { id: crypto.randomUUID(), type: '', dailyRate: 0 }] });
  const del = (id: string) => onChange({ laborRates: data.laborRates.filter(r => r.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ laborRates: data.laborRates.map(r => r.id === id ? { ...r, [field]: val } : r) });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">노임단가표 ({data.year}년)</h3>
        <Button variant="outline" size="sm" className="gap-1" onClick={add}><Plus className="h-3.5 w-3.5" /> 추가</Button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-blue-50 border">
            <th className="border p-2 w-12">No</th>
            <th className="border p-2">직종명</th>
            <th className="border p-2 w-40">일당(원)</th>
            <th className="border p-2 w-16 no-print"></th>
          </tr>
        </thead>
        <tbody>
          {data.laborRates.map((r, i) => (
            <tr key={r.id} className="border hover:bg-gray-50">
              <td className="border p-1 text-center text-gray-500">{i + 1}</td>
              <td className="border p-1"><TextInput value={r.type} onChange={v => upd(r.id, 'type', v)} /></td>
              <td className="border p-1"><NumInput value={r.dailyRate} onChange={v => upd(r.id, 'dailyRate', v)} /></td>
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
  const add = () => onChange({ materials: [...data.materials, { id: crypto.randomUUID(), name: '', spec: '', unit: '개', unitPrice: 0, quantity: 0 }] });
  const del = (id: string) => onChange({ materials: data.materials.filter(m => m.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ materials: data.materials.map(m => m.id === id ? { ...m, [field]: val } : m) });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">자재단가표</h3>
        <Button variant="outline" size="sm" className="gap-1" onClick={add}><Plus className="h-3.5 w-3.5" /> 추가</Button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-green-50 border">
            <th className="border p-2 w-12">No</th>
            <th className="border p-2">자재명</th>
            <th className="border p-2 w-28">규격</th>
            <th className="border p-2 w-16">단위</th>
            <th className="border p-2 w-28">단가(원)</th>
            <th className="border p-2 w-20">수량</th>
            <th className="border p-2 w-28">금액(원)</th>
            <th className="border p-2 w-16 no-print"></th>
          </tr>
        </thead>
        <tbody>
          {data.materials.map((m, i) => (
            <tr key={m.id} className="border hover:bg-gray-50">
              <td className="border p-1 text-center text-gray-500">{i + 1}</td>
              <td className="border p-1"><TextInput value={m.name} onChange={v => upd(m.id, 'name', v)} /></td>
              <td className="border p-1"><TextInput value={m.spec} onChange={v => upd(m.id, 'spec', v)} /></td>
              <td className="border p-1"><TextInput value={m.unit} onChange={v => upd(m.id, 'unit', v)} /></td>
              <td className="border p-1"><NumInput value={m.unitPrice} onChange={v => upd(m.id, 'unitPrice', v)} /></td>
              <td className="border p-1"><NumInput value={m.quantity} onChange={v => upd(m.id, 'quantity', v)} /></td>
              <td className="border p-1 text-right pr-3 font-medium">{fmt(m.unitPrice * m.quantity)}</td>
              <td className="border p-1 text-center no-print">
                <button className="text-red-500 hover:text-red-700" onClick={() => del(m.id)}>✕</button>
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td colSpan={6} className="border p-2 text-center">합계</td>
            <td className="border p-2 text-right pr-3">{fmt(data.materials.reduce((s, m) => s + m.unitPrice * m.quantity, 0))}</td>
            <td className="border no-print"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════ Sheet: 일위대가표 ════════════════════ */
function UnitCostSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const addUC = () => onChange({
    unitCosts: [...data.unitCosts, { id: crypto.randomUUID(), workType: '', workers: [], materials: [] }]
  });
  const delUC = (id: string) => onChange({ unitCosts: data.unitCosts.filter(u => u.id !== id) });
  const updUC = (id: string, partial: Partial<UnitCost>) =>
    onChange({ unitCosts: data.unitCosts.map(u => u.id === id ? { ...u, ...partial } : u) });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">일위대가표</h3>
        <Button variant="outline" size="sm" className="gap-1" onClick={addUC}><Plus className="h-3.5 w-3.5" /> 공종 추가</Button>
      </div>
      {data.unitCosts.length === 0 && <p className="text-gray-400 text-center py-8">공종을 추가하세요.</p>}
      {data.unitCosts.map((uc, i) => {
        const laborTotal = uc.workers.reduce((s, w) => {
          const rate = data.laborRates.find(l => l.type === w.laborType)?.dailyRate || 0;
          return s + rate * w.count * w.days;
        }, 0);
        const matTotal = uc.materials.reduce((s, m) => s + m.unitPrice * m.quantity, 0);
        return (
          <div key={uc.id} className="border rounded-lg p-3 mb-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-gray-500">{i + 1}.</span>
              <TextInput value={uc.workType} onChange={v => updUC(uc.id, { workType: v })} placeholder="공종명" className="font-bold" />
              <button className="text-red-500 text-sm hover:text-red-700 no-print" onClick={() => delUC(uc.id)}>삭제</button>
            </div>
            {/* 노무 */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-700">노무비</span>
                <button className="text-xs text-blue-600 no-print" onClick={() => updUC(uc.id, { workers: [...uc.workers, { laborType: '', count: 1, days: 1 }] })}>+ 인원</button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-blue-50">
                  <th className="border p-1">직종</th><th className="border p-1 w-16">인원</th><th className="border p-1 w-16">일수</th><th className="border p-1 w-24">단가</th><th className="border p-1 w-24">금액</th><th className="border p-1 w-10 no-print"></th>
                </tr></thead>
                <tbody>
                  {uc.workers.map((w, wi) => {
                    const rate = data.laborRates.find(l => l.type === w.laborType)?.dailyRate || 0;
                    return (
                      <tr key={wi}>
                        <td className="border p-1">
                          <select className="w-full border rounded px-1 py-0.5 text-xs" value={w.laborType}
                            onChange={e => { const nw = [...uc.workers]; nw[wi] = { ...w, laborType: e.target.value }; updUC(uc.id, { workers: nw }); }}>
                            <option value="">선택</option>
                            {data.laborRates.map(l => <option key={l.id} value={l.type}>{l.type}</option>)}
                          </select>
                        </td>
                        <td className="border p-1"><NumInput value={w.count} onChange={v => { const nw = [...uc.workers]; nw[wi] = { ...w, count: v }; updUC(uc.id, { workers: nw }); }} /></td>
                        <td className="border p-1"><NumInput value={w.days} onChange={v => { const nw = [...uc.workers]; nw[wi] = { ...w, days: v }; updUC(uc.id, { workers: nw }); }} /></td>
                        <td className="border p-1 text-right">{fmt(rate)}</td>
                        <td className="border p-1 text-right font-medium">{fmt(rate * w.count * w.days)}</td>
                        <td className="border p-1 text-center no-print"><button className="text-red-400" onClick={() => { const nw = uc.workers.filter((_, ii) => ii !== wi); updUC(uc.id, { workers: nw }); }}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-right text-xs font-bold mt-1 text-blue-700">노무비 소계: {fmt(laborTotal)}원</div>
            </div>
            {/* 자재 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-green-700">재료비</span>
                <button className="text-xs text-green-600 no-print" onClick={() => updUC(uc.id, { materials: [...uc.materials, { materialName: '', spec: '', unit: '개', quantity: 1, unitPrice: 0 }] })}>+ 자재</button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-green-50">
                  <th className="border p-1">자재명</th><th className="border p-1 w-20">규격</th><th className="border p-1 w-12">단위</th><th className="border p-1 w-16">수량</th><th className="border p-1 w-24">단가</th><th className="border p-1 w-24">금액</th><th className="border p-1 w-10 no-print"></th>
                </tr></thead>
                <tbody>
                  {uc.materials.map((m, mi) => (
                    <tr key={mi}>
                      <td className="border p-1"><TextInput value={m.materialName} onChange={v => { const nm = [...uc.materials]; nm[mi] = { ...m, materialName: v }; updUC(uc.id, { materials: nm }); }} /></td>
                      <td className="border p-1"><TextInput value={m.spec} onChange={v => { const nm = [...uc.materials]; nm[mi] = { ...m, spec: v }; updUC(uc.id, { materials: nm }); }} /></td>
                      <td className="border p-1"><TextInput value={m.unit} onChange={v => { const nm = [...uc.materials]; nm[mi] = { ...m, unit: v }; updUC(uc.id, { materials: nm }); }} /></td>
                      <td className="border p-1"><NumInput value={m.quantity} onChange={v => { const nm = [...uc.materials]; nm[mi] = { ...m, quantity: v }; updUC(uc.id, { materials: nm }); }} /></td>
                      <td className="border p-1"><NumInput value={m.unitPrice} onChange={v => { const nm = [...uc.materials]; nm[mi] = { ...m, unitPrice: v }; updUC(uc.id, { materials: nm }); }} /></td>
                      <td className="border p-1 text-right font-medium">{fmt(m.unitPrice * m.quantity)}</td>
                      <td className="border p-1 text-center no-print"><button className="text-red-400" onClick={() => { const nm = uc.materials.filter((_, ii) => ii !== mi); updUC(uc.id, { materials: nm }); }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right text-xs font-bold mt-1 text-green-700">재료비 소계: {fmt(matTotal)}원</div>
            </div>
            <div className="text-right text-sm font-bold mt-2 border-t pt-1">일위대가 합계: {fmt(laborTotal + matTotal)}원</div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════ Sheet: 물량내역서 ════════════════════ */
function QuantitySheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = () => onChange({ quantities: [...data.quantities, { id: crypto.randomUUID(), workType: '', location: '', quantity: 0, unit: '식' }] });
  const del = (id: string) => onChange({ quantities: data.quantities.filter(q => q.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ quantities: data.quantities.map(q => q.id === id ? { ...q, [field]: val } : q) });

  // 공종별 합계
  const grouped = useMemo(() => {
    const g: Record<string, number> = {};
    data.quantities.forEach(q => {
      g[q.workType] = (g[q.workType] || 0) + q.quantity;
    });
    return g;
  }, [data.quantities]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">물량내역서</h3>
        <Button variant="outline" size="sm" className="gap-1" onClick={add}><Plus className="h-3.5 w-3.5" /> 추가</Button>
      </div>
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

/* ════════════════════ Sheet: 설계내역서 ════════════════════ */
function EstimateSheet({ data, onChange }: { data: ProjectData; onChange: (d: Partial<ProjectData>) => void }) {
  const add = (category: 'material' | 'labor' | 'expense') =>
    onChange({ estimateItems: [...data.estimateItems, { id: crypto.randomUUID(), category, name: '', spec: '', unit: '식', quantity: 1, unitPrice: 0 }] });
  const del = (id: string) => onChange({ estimateItems: data.estimateItems.filter(e => e.id !== id) });
  const upd = (id: string, field: string, val: string | number) =>
    onChange({ estimateItems: data.estimateItems.map(e => e.id === id ? { ...e, [field]: val } : e) });

  const categories: { key: 'material' | 'labor' | 'expense'; label: string; bg: string }[] = [
    { key: 'material', label: '재료비', bg: 'bg-green-50' },
    { key: 'labor', label: '노무비 (직접)', bg: 'bg-blue-50' },
    { key: 'expense', label: '경비 (직접)', bg: 'bg-orange-50' },
  ];

  return (
    <div>
      <h3 className="font-bold text-lg mb-3">설계내역서</h3>
      {categories.map(cat => {
        const items = data.estimateItems.filter(e => e.category === cat.key);
        const subtotal = items.reduce((s, e) => s + e.quantity * e.unitPrice, 0);
        return (
          <div key={cat.key} className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-bold px-2 py-0.5 rounded ${cat.bg}`}>{cat.label}</span>
              <button className="text-xs text-blue-600 no-print" onClick={() => add(cat.key)}>+ 추가</button>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead><tr className={`${cat.bg} border`}>
                <th className="border p-1 w-10">No</th><th className="border p-1 w-56">항목명</th><th className="border p-1">규격</th>
                <th className="border p-1 w-14">단위</th><th className="border p-1 w-16">수량</th><th className="border p-1 w-24">단가</th>
                <th className="border p-1 w-28">금액</th><th className="border p-1 w-10 no-print"></th>
              </tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} className="border hover:bg-gray-50">
                    <td className="border p-1 text-center text-gray-400">{i + 1}</td>
                    <td className="border p-1"><TextInput value={item.name} onChange={v => upd(item.id, 'name', v)} /></td>
                    <td className="border p-1"><TextInput value={item.spec} onChange={v => upd(item.id, 'spec', v)} /></td>
                    <td className="border p-1"><TextInput value={item.unit} onChange={v => upd(item.id, 'unit', v)} /></td>
                    <td className="border p-1"><NumInput value={item.quantity} onChange={v => upd(item.id, 'quantity', v)} /></td>
                    <td className="border p-1"><NumInput value={item.unitPrice} onChange={v => upd(item.id, 'unitPrice', v)} /></td>
                    <td className="border p-1 text-right pr-2 font-medium">{fmt(item.quantity * item.unitPrice)}</td>
                    <td className="border p-1 text-center no-print"><button className="text-red-400" onClick={() => del(item.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="font-bold bg-gray-50">
                <td colSpan={6} className="border p-1 text-center">{cat.label} 소계</td>
                <td className="border p-1 text-right pr-2">{fmt(subtotal)}</td>
                <td className="border no-print"></td>
              </tr></tfoot>
            </table>
          </div>
        );
      })}
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
    const timer = setTimeout(() => setStoredValue(STORAGE_KEY, data), 500);
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
        {activeSheet === 'summary' && (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400">
            <p className="text-lg font-semibold">산출집계표</p>
            <p className="text-sm mt-2">준비 중입니다.</p>
          </div>
        )}
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
