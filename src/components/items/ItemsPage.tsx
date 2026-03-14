'use client';

import { useState, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Package, ChevronLeft, ChevronRight, Image, Camera, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from '@/hooks/useItems';
import { cn } from '@/lib/utils';
import type { Item, ItemInput } from '@/types';

const ITEMS_PER_PAGE = 50;

export function ItemsPage() {
  const { data: items = [], isLoading } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  // 파일 입력 ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<ItemInput>({
    name: '',
    price: undefined,
    photo_url: '',
    memo: '',
  });

  // 검색
  const filteredItems = items.filter((item: Item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.memo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 페이지네이션
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // 모달 열기 (등록)
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      price: undefined,
      photo_url: '',
      memo: '',
    });
    setPreviewImage(null);
    setIsModalOpen(true);
  };

  // 모달 열기 (수정)
  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price || undefined,
      photo_url: item.photo_url || '',
      memo: item.memo || '',
    });
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

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="h-5 w-5" />
          품목 관리
        </h2>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          품목 등록
        </Button>
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
              setCurrentPage(1);
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
      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full min-w-[500px]">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs sm:text-sm font-semibold text-gray-700">
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-14 sm:w-20">사진</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">품목명</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right whitespace-nowrap">단가</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">메모</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center w-20 sm:w-24">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '등록된 품목이 없습니다.'}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item: Item) => (
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

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

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
                  단가
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-right"
                    value={formData.price?.toLocaleString() || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, price: value ? parseInt(value, 10) : undefined });
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
    </div>
  );
}
