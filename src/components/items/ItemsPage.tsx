'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Image as ImageIcon, Paperclip, Download, Upload, X, GripVertical, Camera, FolderOpen, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, useUploadItemManual, useUpdateItemSortOrder } from '@/hooks/useItems';
import type { Item, ItemCategory, ItemInput } from '@/types';

const ITEM_CATEGORY_VALUES: ItemCategory[] = ['product', 'part', 'service', 'etc'];

function isImportRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeItemCategory(value: unknown): ItemCategory | undefined {
  return ITEM_CATEGORY_VALUES.includes(value as ItemCategory) ? value as ItemCategory : undefined;
}

function normalizePrice(value: unknown): number {
  const price = Number(value || 0);
  return Number.isFinite(price) ? price : 0;
}

function getManualFileName(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').pop() || '제품 매뉴얼');
  } catch {
    return url.split('/').pop() || '제품 매뉴얼';
  }
}

export function ItemsPage() {
  const { data: items = [], isLoading } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const uploadItemManual = useUploadItemManual();
  const updateItemSortOrder = useUpdateItemSortOrder();

  // 파일 입력 ref
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const specFileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedManualFile, setSelectedManualFile] = useState<File | null>(null);
  const [selectedSpecFile, setSelectedSpecFile] = useState<File | null>(null);
  const [manualViewer, setManualViewer] = useState<{ url: string; name: string } | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [isSortMode, setIsSortMode] = useState(false);
  const [orderedItems, setOrderedItems] = useState<Item[]>([]);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const draggingItemIdRef = useRef<string | null>(null);
  const dragOverItemIdRef = useRef<string | null>(null);
  const dragModeRef = useRef<'mouse' | 'touch' | null>(null);
  const orderedItemsRef = useRef<Item[]>([]);

  // 폼 상태
  const [formData, setFormData] = useState<ItemInput>({
    name: '',
    price: undefined,
    photo_url: '',
    manual_url: '',
    spec_url: '',
    memo: '',
  });

  useEffect(() => {
    if (items && items.length > 0) {
      setOrderedItems(items);
      orderedItemsRef.current = items;
    }
  }, [items]);

  const handleExportItems = () => {
    const exportRows = items.map(({ name, price, category, memo, photo_url, manual_url, spec_url }) => ({
      name,
      price,
      category,
      memo,
      photo_url,
      manual_url,
      spec_url,
    }));
    const payload = {
      kind: 'schedule-app-items',
      exportedAt: new Date().toISOString(),
      count: exportRows.length,
      data: exportRows,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-app-items-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportItems = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const rows = Array.isArray(parsed) ? parsed : parsed.data;
      if (!Array.isArray(rows)) {
        alert('품목 파일 형식이 올바르지 않습니다.');
        return;
      }

      const inputs: ItemInput[] = rows
        .filter(isImportRecord)
        .map((row, index) => ({
          name: String(row.name || '').trim(),
          price: normalizePrice(row.price),
          category: normalizeItemCategory(row.category),
          memo: String(row.memo || ''),
          photo_url: String(row.photo_url || ''),
          manual_url: String(row.manual_url || ''),
          spec_url: String(row.spec_url || ''),
          sort_order: items.length + index,
        }))
        .filter(row => row.name);

      if (inputs.length === 0) {
        alert('불러올 품목 데이터가 없습니다.');
        return;
      }
      if (!confirm(`${inputs.length}건의 품목을 기존 데이터에 추가할까요?`)) return;

      let successCount = 0;
      let failCount = 0;
      for (const input of inputs) {
        try {
          await createItem.mutateAsync(input);
          successCount += 1;
        } catch (error) {
          console.error('품목 항목 불러오기 실패:', input, error);
          failCount += 1;
        }
      }
      alert(`품목 불러오기 완료\n성공: ${successCount}건\n실패: ${failCount}건`);
    } catch (error) {
      console.error('품목 불러오기 실패:', error);
      alert('품목 불러오기에 실패했습니다.');
    }
  };

  // 검색
  const filteredItems = items.filter((item: Item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.memo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedItems = isSortMode ? orderedItems : filteredItems;

  const persistItemOrder = async (nextItems: Item[]) => {
    try {
      await updateItemSortOrder.mutateAsync(nextItems.map((item, index) => ({
        id: item.id,
        sort_order: index,
      })));
    } catch (error) {
      console.error('품목 순서 저장 실패:', error);
      alert('품목 순서 저장에 실패했습니다.');
      setOrderedItems(items);
    }
  };

  const moveDraggedItem = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    setOrderedItems((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      orderedItemsRef.current = next;
      return next;
    });
  };

  const updateDragOverByPoint = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const row = target?.closest('[data-item-row-id]') as HTMLElement | null;
    const targetId = row?.dataset.itemRowId || null;
    if (!targetId || targetId === dragOverItemIdRef.current) return;

    dragOverItemIdRef.current = targetId;
    setDragOverItemId(targetId);

    if (draggingItemIdRef.current && draggingItemIdRef.current !== targetId) {
      moveDraggedItem(draggingItemIdRef.current, targetId);
    }
  };

  const finishDrag = () => {
    const sourceId = draggingItemIdRef.current;
    const nextItems = orderedItemsRef.current;
    draggingItemIdRef.current = null;
    dragOverItemIdRef.current = null;
    dragModeRef.current = null;
    setDraggingItemId(null);
    setDragOverItemId(null);

    if (sourceId) {
      void persistItemOrder(nextItems);
    }
  };

  const startDrag = (itemId: string, mode: 'mouse' | 'touch') => {
    if (!isSortMode) return;
    draggingItemIdRef.current = itemId;
    dragOverItemIdRef.current = itemId;
    dragModeRef.current = mode;
    setDraggingItemId(itemId);
    setDragOverItemId(itemId);
  };

  useEffect(() => {
    if (!draggingItemId) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (dragModeRef.current !== 'mouse') return;
      event.preventDefault();
      updateDragOverByPoint(event.clientX, event.clientY);
    };
    const handleMouseUp = () => {
      if (dragModeRef.current === 'mouse') finishDrag();
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (dragModeRef.current !== 'touch') return;
      event.preventDefault();
      const touch = event.touches[0];
      if (touch) updateDragOverByPoint(touch.clientX, touch.clientY);
    };
    const handleTouchEnd = () => {
      if (dragModeRef.current === 'touch') finishDrag();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
    // Drag handlers read current refs; re-registering on every helper recreation is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingItemId, orderedItems]);

  // 모달 열기 (등록)
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      price: undefined,
      photo_url: '',
      manual_url: '',
      spec_url: '',
      memo: '',
    });
    setPreviewImage(null);
    setSelectedManualFile(null);
    setSelectedSpecFile(null);
    setPriceInput('');
    setIsModalOpen(true);
  };

  // 모달 열기 (수정)
  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price || undefined,
      photo_url: item.photo_url || '',
      manual_url: item.manual_url || '',
      spec_url: item.spec_url || '',
      memo: item.memo || '',
    });
    setPriceInput(item.price ? item.price.toLocaleString() : '');
    setPreviewImage(item.photo_url || null);
    setSelectedManualFile(null);
    setSelectedSpecFile(null);
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
        const manualUrl = selectedManualFile
          ? await uploadItemManual.mutateAsync({ file: selectedManualFile, itemId: editingItem.id, kind: 'manual' })
          : formData.manual_url || '';
        const specUrl = selectedSpecFile
          ? await uploadItemManual.mutateAsync({ file: selectedSpecFile, itemId: editingItem.id, kind: 'spec' })
          : formData.spec_url || '';

        await updateItem.mutateAsync({
          id: editingItem.id,
          ...formData,
          manual_url: manualUrl,
          spec_url: specUrl,
        });
      } else {
        const createdItem = await createItem.mutateAsync({
          ...formData,
          manual_url: selectedManualFile ? '' : formData.manual_url,
          spec_url: selectedSpecFile ? '' : formData.spec_url,
          sort_order: items.length,
        });

        if (selectedManualFile || selectedSpecFile) {
          const manualUrl = selectedManualFile
            ? await uploadItemManual.mutateAsync({ file: selectedManualFile, itemId: createdItem.id, kind: 'manual' })
            : createdItem.manual_url || '';
          const specUrl = selectedSpecFile
            ? await uploadItemManual.mutateAsync({ file: selectedSpecFile, itemId: createdItem.id, kind: 'spec' })
            : createdItem.spec_url || '';
          await updateItem.mutateAsync({
            id: createdItem.id,
            name: createdItem.name,
            price: createdItem.price,
            category: createdItem.category || undefined,
            memo: createdItem.memo || '',
            photo_url: createdItem.photo_url || '',
            manual_url: manualUrl,
            spec_url: specUrl,
            sort_order: createdItem.sort_order || items.length,
          });
        }
      }
      setSelectedManualFile(null);
      setSelectedSpecFile(null);
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

  // 제품사진 파일 선택 처리 (기존 기능)
  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setFormData({ ...formData, photo_url: dataUrl });
        setPreviewImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // 매뉴얼 파일 선택 처리
  const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedManualFile(file);
      setFormData({ ...formData, manual_url: '' });
    }
    e.target.value = '';
  };

  const handleSpecFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedSpecFile(file);
      setFormData({ ...formData, spec_url: '' });
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="h-5 w-5" />
          품목 관리
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportItems} variant="outline" className="gap-1.5" size="sm">
            <Download className="h-4 w-4" />
            외부저장
          </Button>
          <Button onClick={() => importFileRef.current?.click()} variant="outline" className="gap-1.5" size="sm">
            <Upload className="h-4 w-4" />
            불러오기
          </Button>
          <Button
            onClick={() => {
              setIsSortMode((value) => !value);
              setSearchTerm('');
              setOrderedItems(items);
              orderedItemsRef.current = items;
            }}
            variant={isSortMode ? 'default' : 'outline'}
            className="gap-1.5"
            size="sm"
          >
            <GripVertical className="h-4 w-4" />
            {isSortMode ? '순서 완료' : '순서 변경'}
          </Button>
          <Button onClick={handleOpenAdd} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            품목 등록
          </Button>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportItems}
          />
        </div>
      </div>

      {/* 검색 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={isSortMode ? '순서 변경 중에는 전체 목록이 표시됩니다' : '품목명, 메모 검색...'}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={searchTerm}
            disabled={isSortMode}
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
          {isSortMode ? '정렬목록' : '검색결과'}: <span className="font-bold">{displayedItems.length}건</span>
        </span>
        {isSortMode && (
          <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg font-medium">
            핸들을 잡고 위아래로 이동
          </span>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto -mx-2 sm:mx-0 max-h-[calc(100vh-280px)] overflow-y-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs sm:text-sm font-semibold text-gray-700">
              {isSortMode && <th className="px-1 sm:px-2 py-2 sm:py-3 text-center w-10">순서</th>}
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-14 sm:w-20">사진</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">품목명</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right whitespace-nowrap">단가</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-16">매뉴얼</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-16">규격</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">메모</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-20 sm:w-24">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={isSortMode ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : displayedItems.length === 0 ? (
              <tr>
                <td colSpan={isSortMode ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '등록된 품목이 없습니다.'}
                </td>
              </tr>
            ) : (
              displayedItems.map((item: Item) => (
                <tr
                  key={item.id}
                  data-item-row-id={item.id}
                  className="border-b hover:bg-gray-50"
                  style={{
                    opacity: draggingItemId === item.id ? 0.55 : 1,
                    boxShadow: draggingItemId === item.id ? '0 8px 20px rgba(0,0,0,0.18)' : undefined,
                    backgroundColor: dragOverItemId === item.id ? '#EFF6FF' : undefined,
                    transition: draggingItemId ? 'none' : 'background-color 0.15s, opacity 0.15s',
                  }}
                >
                  {isSortMode && (
                    <td className="px-1 sm:px-2 py-2 sm:py-3 text-center">
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          startDrag(item.id, 'mouse');
                        }}
                        onTouchStart={(event) => {
                          event.preventDefault();
                          const touch = event.touches[0];
                          if (touch) startDrag(item.id, 'touch');
                        }}
                        style={{
                          width: 32,
                          height: 36,
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          background: '#fff',
                          color: '#6b7280',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'grab',
                          touchAction: 'none',
                        }}
                        title="드래그하여 순서 변경"
                      >
                        <GripVertical style={{ width: 18, height: 18 }} />
                      </button>
                    </td>
                  )}
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
                          <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-sm sm:text-base">{item.name}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-green-600 font-medium text-sm sm:text-base whitespace-nowrap">
                    {item.price ? `${item.price.toLocaleString()}원` : '-'}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                    {item.manual_url ? (
                      <button
                        type="button"
                        onClick={() => setManualViewer({ url: item.manual_url || '', name: getManualFileName(item.manual_url) || item.name })}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: '1px solid #dbeafe',
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="매뉴얼 보기"
                      >
                        <Paperclip style={{ width: 18, height: 18 }} />
                      </button>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 12 }}>-</span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                    {item.spec_url ? (
                      <button
                        type="button"
                        onClick={() => setManualViewer({ url: item.spec_url || '', name: getManualFileName(item.spec_url) || item.name })}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: '1px solid #fed7aa',
                          background: '#fff7ed',
                          color: '#ea580c',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="규격 보기"
                      >
                        <Ruler style={{ width: 18, height: 18 }} />
                      </button>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 12 }}>-</span>
                    )}
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
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 m-4"
            style={{ maxHeight: '92vh', overflowY: 'auto' }}
          >
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
                  제품사진
                </label>

                <input
                  type="file"
                  ref={photoFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoFileSelect}
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoFileSelect}
                />

                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => photoFileInputRef.current?.click()}
                  >
                    <FolderOpen className="h-4 w-4" />
                    첨부
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 lg:hidden"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    사진촬영
                  </Button>
                </div>

                {previewImage && (
                  <div className="mt-2 flex justify-center relative">
                    <img
                      src={previewImage}
                      alt="미리보기"
                      className="w-32 h-32 object-cover rounded-lg"
                      onError={() => {
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
                  제품 매뉴얼
                </label>

                <input
                  type="file"
                  ref={manualFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleManualFileSelect}
                />

                <button
                  type="button"
                  onClick={() => manualFileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px dashed #2563eb',
                    borderRadius: 8,
                    background: '#eff6ff',
                    color: '#2563eb',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Paperclip style={{ width: 16, height: 16 }} />
                  매뉴얼 첨부
                </button>

                {(selectedManualFile || formData.manual_url) && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.manual_url) {
                          setManualViewer({
                            url: formData.manual_url,
                            name: getManualFileName(formData.manual_url) || formData.name || '제품 매뉴얼',
                          });
                        }
                      }}
                      disabled={Boolean(selectedManualFile)}
                      style={{
                        minWidth: 0,
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        color: formData.manual_url && !selectedManualFile ? '#2563eb' : '#374151',
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: formData.manual_url && !selectedManualFile ? 'pointer' : 'default',
                      }}
                      title={selectedManualFile?.name || getManualFileName(formData.manual_url)}
                    >
                      {selectedManualFile?.name || getManualFileName(formData.manual_url)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedManualFile(null);
                        setFormData({ ...formData, manual_url: '' });
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        border: 'none',
                        background: '#ef4444',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="매뉴얼 삭제"
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제품규격
                </label>

                <input
                  type="file"
                  ref={specFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleSpecFileSelect}
                />

                <button
                  type="button"
                  onClick={() => specFileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px dashed #ea580c',
                    borderRadius: 8,
                    background: '#fff7ed',
                    color: '#ea580c',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Ruler style={{ width: 16, height: 16 }} />
                  규격 첨부
                </button>

                {(selectedSpecFile || formData.spec_url) && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.spec_url) {
                          setManualViewer({
                            url: formData.spec_url,
                            name: getManualFileName(formData.spec_url) || formData.name || '제품규격',
                          });
                        }
                      }}
                      disabled={Boolean(selectedSpecFile)}
                      style={{
                        minWidth: 0,
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        color: formData.spec_url && !selectedSpecFile ? '#ea580c' : '#374151',
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: formData.spec_url && !selectedSpecFile ? 'pointer' : 'default',
                      }}
                      title={selectedSpecFile?.name || getManualFileName(formData.spec_url)}
                    >
                      {selectedSpecFile?.name || getManualFileName(formData.spec_url)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSpecFile(null);
                        setFormData({ ...formData, spec_url: '' });
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        border: 'none',
                        background: '#ef4444',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="규격 삭제"
                    >
                      <X style={{ width: 14, height: 14 }} />
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
              <Button onClick={handleSave} disabled={createItem.isPending || updateItem.isPending || uploadItemManual.isPending}>
                {createItem.isPending || updateItem.isPending || uploadItemManual.isPending
                  ? '저장 중...'
                  : editingItem ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 매뉴얼 보기 팝업 */}
      {manualViewer && (
        <div
          onClick={() => setManualViewer(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setManualViewer(null)}
            style={{
              position: 'fixed',
              top: 12,
              right: 12,
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.35)',
              background: 'rgba(0,0,0,0.45)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 100000,
            }}
            title="닫기"
          >
            <X style={{ width: 22, height: 22 }} />
          </button>

          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              height: '100%',
              maxWidth: 1100,
              maxHeight: '92vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={manualViewer.url}
              alt={manualViewer.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
