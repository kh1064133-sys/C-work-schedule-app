'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, Car, Wrench, Fuel, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useMaintenanceRecords, useUpsertMaintenance, useDeleteMaintenance,
  useFuelRecords, useUpsertFuel, useDeleteFuel,
} from '@/hooks/useVehicle';
import { cn } from '@/lib/utils';
import type { MaintenanceCategory, VehicleMaintenance, FuelRecord } from '@/types';
import { MAINTENANCE_CATEGORY_LABELS } from '@/types';

type VehicleTab = 'info' | 'maintenance' | 'fuel' | 'insurance';

const VEHICLE_INFO_KEY = 'vehicle_info';
const VEHICLE_INSURANCE_KEY = 'vehicle_insurance';

function loadVehicleInfo() {
  if (typeof window === 'undefined') return { plate: '', model: '' };
  try {
    const saved = localStorage.getItem(VEHICLE_INFO_KEY);
    return saved ? JSON.parse(saved) : { plate: '', model: '' };
  } catch { return { plate: '', model: '' }; }
}

const CATEGORIES: { value: MaintenanceCategory; label: string }[] = [
  { value: 'engine_oil', label: '엔진오일' },
  { value: 'tire', label: '타이어' },
  { value: 'brake', label: '브레이크' },
  { value: 'battery', label: '배터리' },
  { value: 'etc', label: '기타' },
];

// ===== 차량정보 탭 =====
function VehicleInfoTab() {
  const [info, setInfo] = useState({ plate: '', model: '' });

  useEffect(() => {
    setInfo(loadVehicleInfo());
  }, []);

  const save = (field: string, value: string) => {
    const next = { ...info, [field]: value };
    setInfo(next);
    localStorage.setItem(VEHICLE_INFO_KEY, JSON.stringify(next));
  };

  return (
    <div className="max-w-md mx-auto space-y-6 py-4">
      <div className="flex items-center gap-3 mb-6">
        <Car className="w-8 h-8 text-blue-600" />
        <h3 className="text-lg font-bold">차량 정보</h3>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">차량번호</label>
          <input type="text" className="w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            placeholder="예: 12가 3456"
            value={info.plate}
            onChange={e => save('plate', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">차종</label>
          <input type="text" className="w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            placeholder="예: 현대 스타리아"
            value={info.model}
            onChange={e => save('model', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ===== 보험/세금 탭 =====
function InsuranceTab() {
  const [info, setInfo] = useState({
    insurance_expiry: '', insurance_company: '', insurance_cost: '',
    car_tax_date: '', inspection_expiry: '', license_inspection_expiry: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(VEHICLE_INSURANCE_KEY);
      if (saved) setInfo(JSON.parse(saved));
    } catch {}
  }, []);

  const save = (field: string, value: string) => {
    const next = { ...info, [field]: value };
    setInfo(next);
    localStorage.setItem(VEHICLE_INSURANCE_KEY, JSON.stringify(next));
  };

  const isExpiringSoon = (dateStr: string) => {
    if (!dateStr) return false;
    const diff = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };

  const isExpired = (dateStr: string) => {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
  };

  return (
    <div className="max-w-md mx-auto space-y-6 py-4">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-indigo-600" />
        <h3 className="text-lg font-bold">보험 / 세금</h3>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">보험만기일</label>
          <input type="date" className={cn('w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400',
            isExpired(info.insurance_expiry) && 'border-red-500 bg-red-50',
            isExpiringSoon(info.insurance_expiry) && !isExpired(info.insurance_expiry) && 'border-amber-500 bg-amber-50',
          )}
            value={info.insurance_expiry}
            onChange={e => save('insurance_expiry', e.target.value)}
          />
          {isExpired(info.insurance_expiry) && <p className="text-xs text-red-500 mt-1">⚠️ 보험이 만료되었습니다!</p>}
          {isExpiringSoon(info.insurance_expiry) && !isExpired(info.insurance_expiry) && <p className="text-xs text-amber-600 mt-1">⚠️ 보험 만기일이 임박했습니다</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">보험사</label>
          <input type="text" className="w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="예: 삼성화재"
            value={info.insurance_company}
            onChange={e => save('insurance_company', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">보험료</label>
          <input type="text" className="w-full px-4 py-3 border rounded-lg text-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="0"
            value={info.insurance_cost ? parseInt(info.insurance_cost.replace(/[^0-9]/g, ''), 10).toLocaleString() : ''}
            onChange={e => save('insurance_cost', e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">자동차세 납부일</label>
          <input type="date" className="w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={info.car_tax_date}
            onChange={e => save('car_tax_date', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">검사만기일</label>
          <input type="date" className={cn('w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400',
            isExpired(info.inspection_expiry) && 'border-red-500 bg-red-50',
            isExpiringSoon(info.inspection_expiry) && !isExpired(info.inspection_expiry) && 'border-amber-500 bg-amber-50',
          )}
            value={info.inspection_expiry}
            onChange={e => save('inspection_expiry', e.target.value)}
          />
          {isExpired(info.inspection_expiry) && <p className="text-xs text-red-500 mt-1">⚠️ 검사기간이 만료되었습니다!</p>}
          {isExpiringSoon(info.inspection_expiry) && !isExpired(info.inspection_expiry) && <p className="text-xs text-amber-600 mt-1">⚠️ 검사 만기일이 임박했습니다</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">운전면허 적성검사기간</label>
          <input type="date" className={cn('w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400',
            isExpired(info.license_inspection_expiry) && 'border-red-500 bg-red-50',
            isExpiringSoon(info.license_inspection_expiry) && !isExpired(info.license_inspection_expiry) && 'border-amber-500 bg-amber-50',
          )}
            value={info.license_inspection_expiry}
            onChange={e => save('license_inspection_expiry', e.target.value)}
          />
          {isExpired(info.license_inspection_expiry) && <p className="text-xs text-red-500 mt-1">⚠️ 적성검사기간이 만료되었습니다!</p>}
          {isExpiringSoon(info.license_inspection_expiry) && !isExpired(info.license_inspection_expiry) && <p className="text-xs text-amber-600 mt-1">⚠️ 적성검사 만기일이 임박했습니다</p>}
        </div>
      </div>
    </div>
  );
}

// ===== 정비이력 탭 =====
function MaintenanceTab() {
  const { data: records = [], isLoading } = useMaintenanceRecords();
  const upsert = useUpsertMaintenance();
  const remove = useDeleteMaintenance();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'engine_oil' as MaintenanceCategory,
    shop: '',
    cost: '',
    mileage: '',
    memo: '',
  });

  const resetForm = () => {
    setForm({ date: new Date().toISOString().split('T')[0], category: 'engine_oil', shop: '', cost: '', mileage: '', memo: '' });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (r: VehicleMaintenance) => {
    setForm({
      date: r.date,
      category: r.category,
      shop: r.shop || '',
      cost: r.cost.toString(),
      mileage: r.mileage?.toString() || '',
      memo: r.memo || '',
    });
    setEditId(r.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const cost = parseInt(form.cost.replace(/[^0-9]/g, ''), 10) || 0;
    const mileage = form.mileage ? parseInt(form.mileage.replace(/[^0-9]/g, ''), 10) : null;
    upsert.mutate({
      ...(editId ? { id: editId } : {}),
      date: form.date,
      category: form.category,
      shop: form.shop || null,
      cost,
      mileage,
      memo: form.memo || null,
    }, { onSuccess: resetForm });
  };

  const handleDelete = (id: string) => {
    if (confirm('삭제하시겠습니까?')) remove.mutate(id);
  };

  const totalCost = useMemo(() => records.reduce((sum, r) => sum + r.cost, 0), [records]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-orange-600" />
          <h3 className="font-bold">정비이력</h3>
          <span className="text-xs text-gray-500">({records.length}건 / 총 {totalCost.toLocaleString()}원)</span>
        </div>
        <Button size="sm" className="text-xs h-8 gap-1" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" /> 등록
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">정비일자</label>
              <input type="date" className="w-full px-3 py-2 border rounded-md text-sm" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">정비구분</label>
              <select className="w-full px-3 py-2 border rounded-md text-sm bg-white" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as MaintenanceCategory })}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">정비업체</label>
              <input type="text" className="w-full px-3 py-2 border rounded-md text-sm" placeholder="정비업체명" value={form.shop} onChange={e => setForm({ ...form, shop: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">정비금액</label>
              <input type="text" className="w-full px-3 py-2 border rounded-md text-sm text-right" placeholder="0"
                value={form.cost ? parseInt(form.cost.replace(/[^0-9]/g, ''), 10).toLocaleString() : ''}
                onChange={e => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">주행거리 (km)</label>
              <input type="text" className="w-full px-3 py-2 border rounded-md text-sm text-right" placeholder="0"
                value={form.mileage ? parseInt(form.mileage.replace(/[^0-9]/g, ''), 10).toLocaleString() : ''}
                onChange={e => setForm({ ...form, mileage: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">메모</label>
              <input type="text" className="w-full px-3 py-2 border rounded-md text-sm" placeholder="메모" value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm}>취소</Button>
            <Button size="sm" onClick={handleSubmit}>{editId ? '수정' : '등록'}</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-gray-400">정비 기록이 없습니다</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* PC 헤더 */}
          <div className="hidden lg:grid grid-cols-[100px_80px_1fr_100px_100px_1fr_50px] gap-2 px-3 py-2 bg-gray-100 text-xs font-medium text-gray-600">
            <span>정비일자</span><span>구분</span><span>정비업체</span><span className="text-right">금액</span><span className="text-right">주행거리</span><span>메모</span><span></span>
          </div>
          {records.map(r => (
            <div key={r.id}>
              {/* PC 행 */}
              <div className="hidden lg:grid grid-cols-[100px_80px_1fr_100px_100px_1fr_50px] gap-2 px-3 py-2 border-b items-center text-sm hover:bg-gray-50 cursor-pointer"
                onClick={() => handleEdit(r)}
              >
                <span className="text-gray-600">{r.date}</span>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full text-center',
                  r.category === 'engine_oil' && 'bg-amber-100 text-amber-700',
                  r.category === 'tire' && 'bg-gray-100 text-gray-700',
                  r.category === 'brake' && 'bg-red-100 text-red-700',
                  r.category === 'battery' && 'bg-green-100 text-green-700',
                  r.category === 'etc' && 'bg-blue-100 text-blue-700',
                )}>{MAINTENANCE_CATEGORY_LABELS[r.category]}</span>
                <span>{r.shop || '-'}</span>
                <span className="text-right font-medium">{r.cost.toLocaleString()}원</span>
                <span className="text-right text-gray-500">{r.mileage ? `${r.mileage.toLocaleString()}km` : '-'}</span>
                <span className="text-gray-500 truncate">{r.memo || '-'}</span>
                <button onClick={e => { e.stopPropagation(); handleDelete(r.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              {/* 모바일 카드 */}
              <div className="lg:hidden p-3 border-b hover:bg-gray-50" onClick={() => handleEdit(r)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{r.date}</span>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                    r.category === 'engine_oil' && 'bg-amber-100 text-amber-700',
                    r.category === 'tire' && 'bg-gray-100 text-gray-700',
                    r.category === 'brake' && 'bg-red-100 text-red-700',
                    r.category === 'battery' && 'bg-green-100 text-green-700',
                    r.category === 'etc' && 'bg-blue-100 text-blue-700',
                  )}>{MAINTENANCE_CATEGORY_LABELS[r.category]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.shop || '-'}</span>
                  <span className="font-bold text-orange-600">{r.cost.toLocaleString()}원</span>
                </div>
                {(r.mileage || r.memo) && (
                  <div className="text-xs text-gray-400 mt-1">
                    {r.mileage && <span>{r.mileage.toLocaleString()}km</span>}
                    {r.mileage && r.memo && <span> · </span>}
                    {r.memo && <span>{r.memo}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 주유관리 탭 =====
function FuelTab() {
  const { data: records = [], isLoading } = useFuelRecords();
  const upsert = useUpsertFuel();
  const remove = useDeleteFuel();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    cost: '',
    mileage: '',
  });

  const resetForm = () => {
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', cost: '', mileage: '' });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (r: FuelRecord) => {
    setForm({
      date: r.date,
      amount: r.amount.toString(),
      cost: r.cost.toString(),
      mileage: r.mileage?.toString() || '',
    });
    setEditId(r.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const amount = parseFloat(form.amount) || 0;
    const cost = parseInt(form.cost.replace(/[^0-9]/g, ''), 10) || 0;
    const mileage = form.mileage ? parseInt(form.mileage.replace(/[^0-9]/g, ''), 10) : null;
    upsert.mutate({
      ...(editId ? { id: editId } : {}),
      date: form.date,
      amount,
      cost,
      mileage,
    }, { onSuccess: resetForm });
  };

  const handleDelete = (id: string) => {
    if (confirm('삭제하시겠습니까?')) remove.mutate(id);
  };

  const totalCost = useMemo(() => records.reduce((sum, r) => sum + r.cost, 0), [records]);
  const totalAmount = useMemo(() => records.reduce((sum, r) => sum + r.amount, 0), [records]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fuel className="w-5 h-5 text-green-600" />
          <h3 className="font-bold">주유관리</h3>
          <span className="text-xs text-gray-500">({records.length}건 / {totalAmount.toFixed(1)}L / 총 {totalCost.toLocaleString()}원)</span>
        </div>
        <Button size="sm" className="text-xs h-8 gap-1" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" /> 등록
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">주유일자</label>
              <input type="date" className="w-full px-3 py-2 border rounded-md text-sm" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">주유량 (L)</label>
              <input type="text" className="w-full px-3 py-2 border rounded-md text-sm text-right" placeholder="0"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">주유금액</label>
              <input type="text" className="w-full px-3 py-2 border rounded-md text-sm text-right" placeholder="0"
                value={form.cost ? parseInt(form.cost.replace(/[^0-9]/g, ''), 10).toLocaleString() : ''}
                onChange={e => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">주행거리 (km)</label>
              <input type="text" className="w-full px-3 py-2 border rounded-md text-sm text-right" placeholder="0"
                value={form.mileage ? parseInt(form.mileage.replace(/[^0-9]/g, ''), 10).toLocaleString() : ''}
                onChange={e => setForm({ ...form, mileage: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm}>취소</Button>
            <Button size="sm" onClick={handleSubmit}>{editId ? '수정' : '등록'}</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-gray-400">주유 기록이 없습니다</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* PC 헤더 */}
          <div className="hidden lg:grid grid-cols-[100px_80px_100px_100px_50px] gap-2 px-3 py-2 bg-gray-100 text-xs font-medium text-gray-600">
            <span>주유일자</span><span className="text-right">주유량</span><span className="text-right">금액</span><span className="text-right">주행거리</span><span></span>
          </div>
          {records.map(r => (
            <div key={r.id}>
              {/* PC 행 */}
              <div className="hidden lg:grid grid-cols-[100px_80px_100px_100px_50px] gap-2 px-3 py-2 border-b items-center text-sm hover:bg-gray-50 cursor-pointer"
                onClick={() => handleEdit(r)}
              >
                <span className="text-gray-600">{r.date}</span>
                <span className="text-right">{r.amount}L</span>
                <span className="text-right font-medium">{r.cost.toLocaleString()}원</span>
                <span className="text-right text-gray-500">{r.mileage ? `${r.mileage.toLocaleString()}km` : '-'}</span>
                <button onClick={e => { e.stopPropagation(); handleDelete(r.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              {/* 모바일 카드 */}
              <div className="lg:hidden p-3 border-b hover:bg-gray-50" onClick={() => handleEdit(r)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{r.date}</span>
                  <span className="text-xs text-gray-500">{r.amount}L</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-green-600">{r.cost.toLocaleString()}원</span>
                  <span className="text-sm text-gray-500">{r.mileage ? `${r.mileage.toLocaleString()}km` : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 메인 페이지 =====
export function VehiclePage() {
  const [activeTab, setActiveTab] = useState<VehicleTab>('info');

  const tabs: { id: VehicleTab; label: string; icon: typeof Car }[] = [
    { id: 'info', label: '차량정보', icon: Car },
    { id: 'insurance', label: '보험/세금', icon: Shield },
    { id: 'maintenance', label: '정비이력', icon: Wrench },
    { id: 'fuel', label: '주유관리', icon: Fuel },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">🚗 차량유지관리</h2>

      {/* 탭 버튼 */}
      <div className="flex border-b">
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'info' && <VehicleInfoTab />}
      {activeTab === 'insurance' && <InsuranceTab />}
      {activeTab === 'maintenance' && <MaintenanceTab />}
      {activeTab === 'fuel' && <FuelTab />}
    </div>
  );
}
