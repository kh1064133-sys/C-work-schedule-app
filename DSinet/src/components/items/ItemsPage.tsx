'use client';

import { useState, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Image, Camera, FolderOpen, FileSpreadsheet, X, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from '@/hooks/useItems';
import { cn } from '@/lib/utils';
import type { Item, ItemInput } from '@/types';

interface ExcelRow {
  name: string;
  spec: string;
  unit: string;
  price: number | undefined;
  memo: string;
  selected: boolean;
}

export function ItemsPage() {
  const { data: items = [], isLoading } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  // 파일 입력 ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

  // 엑셀 미리보기 상태
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState<ItemInput>({
    name: '',
    spec: '',
    price: undefined,
    photo_url: '',
    memo: '',
  });

  // 검색
  const filteredItems = items.filter((item: Item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.memo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 모달 열기 (등록)
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      spec: '',
      price: undefined,
      photo_url: '',
      memo: '',
    });
    setPreviewImage(null);
    setPriceInput('');
    setIsModalOpen(true);
  };

  // 모달 열기 (수정)
  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      spec: item.spec || '',
      price: item.price || undefined,
      photo_url: item.photo_url || '',
      memo: item.memo || '',
    });
    setPriceInput(item.price ? item.price.toLocaleString() : '');
    setPreviewImage(item.photo_url || null);
    setIsModalOpen(true);
  };

  // 저장
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('품목명을 입력해주세요.');
      return;
    }

    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          ...formData,
        });
      } else {
        await createItem.mutateAsync(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 삭제
  const handleDelete = async (item: Item) => {
    if (!confirm(`'${item.name}' 품목을 삭제하시겠습니까?`)) return;
    
    try {
      await deleteItem.mutateAsync(item.id);
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 이미지 URL 변경
  const handleImageUrlChange = (url: string) => {
    setFormData({ ...formData, photo_url: url });
    setPreviewImage(url || null);
  };

  // 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일을 Base64 데이터 URL로 변환
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setFormData({ ...formData, photo_url: dataUrl });
        setPreviewImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    // input 초기화 (같은 파일 다시 선택 가능하도록)
    e.target.value = '';
  };

  // 엑셀 파일 파싱
  const handleExcelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];

      // 헤더 포함 raw 배열로 읽기
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (raw.length < 2) { alert('데이터가 없습니다.'); return; }

      const headerRow = raw[0].map(h => String(h ?? '').trim().toLowerCase());
      const dataRows = raw.slice(1);

      const findCol = (candidates: string[]): number => {
        for (const c of candidates) {
          const idx = headerRow.findIndex(h => h === c);
          if (idx >= 0) return idx;
        }
        return -1;
      };

      // 헤더 기반 컬럼 인덱스 찾기
      let nameIdx = findCol(['품목명', 'name', '품 목 명', '품목']);
      let specIdx = findCol(['규격', 'spec', '규 격']);
      let unitIdx = findCol(['단위', 'unit', '단 위']);
      let priceIdx = findCol(['단가', 'price', '가격', '단 가']);
      let memoIdx = findCol(['메모', 'memo', '비고', 'note']);

      // 헤더 매칭 실패 시 컬럼 위치 기반 fallback (1열=품목명, 2열=규격, 3열=단위, 4열=단가, 5열=메모)
      const noHeader = nameIdx === -1;
      if (noHeader) {
        nameIdx = 0; specIdx = 1; unitIdx = 2; priceIdx = 3; memoIdx = 4;
      }

      const getCell = (row: unknown[], idx: number) =>
        idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';

      // 헤더 행이 실제로 헤더가 아니라 데이터인 경우 포함
      const allRows = noHeader ? raw : dataRows;

      const parsed: ExcelRow[] = allRows.map((row) => {
        const priceRaw = getCell(row, priceIdx);
        const priceNum = parseInt(priceRaw.replace(/[^0-9]/g, ''), 10);
        return {
          name: getCell(row, nameIdx),
          spec: getCell(row, specIdx),
          unit: getCell(row, unitIdx),
          price: isNaN(priceNum) ? undefined : priceNum,
          memo: getCell(row, memoIdx),
          selected: true,
        };
      }).filter(r => r.name);

      if (parsed.length === 0) {
        alert('품목명 데이터를 찾을 수 없습니다.\n엑셀 첫 행에 헤더(품목명, 규격, 단가, 메모)가 있는지 확인해주세요.');
        return;
      }

      setExcelRows(parsed);
      setIsExcelModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // 엑셀 선택 항목 일괄 등록
  const handleExcelImport = async () => {
    const targets = excelRows.filter(r => r.selected);
    if (targets.length === 0) { alert('선택된 항목이 없습니다.'); return; }

    // 기존 품목과 중복 제거 (이름 + 규격 동일 시 스킵)
    const newTargets = targets.filter(row =>
      !items.some((item: Item) =>
        item.name === row.name && (item.spec ?? '') === (row.spec ?? '')
      )
    );

    if (newTargets.length === 0) {
      alert(`선택한 ${targets.length}건이 모두 이미 등록된 항목입니다.`);
      return;
    }

    const skipCount = targets.length - newTargets.length;
    setIsImporting(true);
    try {
      for (const row of newTargets) {
        await createItem.mutateAsync({ name: row.name, spec: row.spec || undefined, unit: row.unit || undefined, price: row.price, memo: row.memo || undefined });
      }
      setIsExcelModalOpen(false);
      setExcelRows([]);
      alert(`${newTargets.length}건 등록 완료${skipCount > 0 ? ` (중복 ${skipCount}건 제외)` : ''}`);
    } catch (err) {
      console.error(err);
      alert('일부 항목 등록에 실패했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="h-5 w-5" />
          품목 관리
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => excelInputRef.current?.click()} className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            엑셀 불러오기
          </Button>
          <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelSelect} />
          <Button onClick={handleOpenAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            품목 등록
          </Button>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="품목명, 메모 검색..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
          />
        </div>
      </div>

      {/* 통계 */}
      <div className="flex gap-4 text-sm">
        <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium">
          전체: <span className="font-bold">{items.length}건</span>
        </span>
        <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-medium">
          검색결과: <span className="font-bold">{filteredItems.length}건</span>
        </span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto -mx-2 sm:mx-0 max-h-[calc(100vh-280px)] overflow-y-auto">
        <table className="w-full min-w-[500px]">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs sm:text-sm font-semibold text-gray-700">
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-14 sm:w-20">사진</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">품목명</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">규격</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right whitespace-nowrap">단가</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">메모</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-20 sm:w-24">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '등록된 품목이 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item: Item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex justify-center">
                      {item.photo_url ? (
                        <img
                          src={item.photo_url}
                          alt={item.name}
                          className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Image className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-sm sm:text-base">{item.name}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-500 text-xs sm:text-sm">{item.spec || '-'}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-green-600 font-medium text-sm sm:text-base whitespace-nowrap">
                    {item.price ? `${item.price.toLocaleString()}원` : '-'}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-500 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px]">
                    {item.memo}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                      >
                        <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 m-4">
            <h3 className="text-lg font-bold mb-4">
              {editingItem ? '품목 수정' : '품목 등록'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  품목명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="품목명 입력"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  규격
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.spec || ''}
                  onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                  placeholder="규격 입력 (예: 100x200mm)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  단가
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-right"
                    value={priceInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9\-]/g, '');
                      if (raw === '' || raw === '-') {
                        setPriceInput(raw);
                        setFormData({ ...formData, price: undefined });
                        return;
                      }
                      const parsed = parseInt(raw, 10);
                      if (!isNaN(parsed)) {
                        setPriceInput(parsed.toLocaleString());
                        setFormData({ ...formData, price: parsed });
                      }
                    }}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">원</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사진
                </label>
                
                {/* 숨겨진 파일 입력 */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                {/* 버튼들 */}
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FolderOpen className="h-4 w-4" />
                    폴더에서 선택
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 lg:hidden"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    사진 촬영
                  </Button>
                </div>
                
                {/* URL 입력 (대안) */}
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  value={formData.photo_url?.startsWith('data:') ? '' : formData.photo_url}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  placeholder="또는 이미지 URL 직접 입력"
                />
                
                {/* 미리보기 */}
                {previewImage && (
                  <div className="mt-2 flex justify-center relative">
                    <img
                      src={previewImage}
                      alt="미리보기"
                      className="w-32 h-32 object-cover rounded-lg"
                      onError={(e) => {
                        setPreviewImage(null);
                      }}
                    />
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                      onClick={() => {
                        setPreviewImage(null);
                        setFormData({ ...formData, photo_url: '' });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메모
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={3}
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="메모 입력"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleSave}>
                {editingItem ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 미리보기 모달 */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">엑셀 불러오기 미리보기</h3>
              <button onClick={() => setIsExcelModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b bg-gray-50 text-sm text-gray-600">
              엑셀 열 이름: <span className="font-mono bg-white px-1 rounded border">품목명</span>, <span className="font-mono bg-white px-1 rounded border">규격</span>, <span className="font-mono bg-white px-1 rounded border">단위</span>, <span className="font-mono bg-white px-1 rounded border">단가</span> 순서로 매핑됩니다.
              <span className="ml-2 text-blue-600">총 {excelRows.length}건 / 선택 {excelRows.filter(r => r.selected).length}건</span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 w-8">
                      <input type="checkbox"
                        checked={excelRows.every(r => r.selected)}
                        onChange={e => setExcelRows(rows => rows.map(r => ({ ...r, selected: e.target.checked })))}
                      />
                    </th>
                    <th className="p-2 text-left">품목명</th>
                    <th className="p-2 text-left">규격</th>
                    <th className="p-2 text-left">단위</th>
                    <th className="p-2 text-right">단가</th>
                  </tr>
                </thead>
                <tbody>
                  {excelRows.map((row, i) => (
                    <tr key={i} className={`border-b ${row.selected ? '' : 'opacity-40'}`}>
                      <td className="p-2 text-center">
                        <input type="checkbox" checked={row.selected}
                          onChange={e => setExcelRows(rows => rows.map((r, ri) => ri === i ? { ...r, selected: e.target.checked } : r))}
                        />
                      </td>
                      <td className="p-2 font-medium">{row.name}</td>
                      <td className="p-2 text-gray-500">{row.spec}</td>
                      <td className="p-2 text-gray-500">{row.unit}</td>
                      <td className="p-2 text-right text-green-600">{row.price !== undefined ? row.price.toLocaleString() + '원' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setIsExcelModalOpen(false)}>취소</Button>
              <Button onClick={handleExcelImport} disabled={isImporting} className="gap-2 bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4" />
                {isImporting ? '등록 중...' : `선택 항목 등록 (${excelRows.filter(r => r.selected).length}건)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
