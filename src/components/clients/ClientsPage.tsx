'use client';

import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Building2, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '@/hooks/useClients';
import { cn } from '@/lib/utils';
import type { Client, ClientType, ClientInput } from '@/types';

// Daum Postcode 타입 선언
declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: {
          address: string;
          jibunAddress: string;
          roadAddress: string;
          zonecode: string;
          buildingName: string;
          bname: string;
        }) => void;
      }) => { open: () => void };
    };
  }
}

const CLIENT_TYPES: { value: ClientType | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'apt', label: '아파트' },
  { value: 'villa', label: '빌라' },
  { value: 'officetel', label: '오피스텔' },
  { value: 'house', label: '주택' },
  { value: 'etc', label: '기타' },
];

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  apt: '아파트',
  villa: '빌라',
  officetel: '오피스텔',
  house: '주택',
  etc: '기타',
};

const ITEMS_PER_PAGE = 10;

export function ClientsPage() {
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  // 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ClientType | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<ClientInput>({
    name: '',
    type: undefined,
    address: '',
    bunji: '',
    households: '',
    memo: '',
  });

  // 필터링 및 검색
  const filteredClients = clients.filter((client: Client) => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.address || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === '' || client.type === filterType;
    return matchesSearch && matchesType;
  });

  // 페이지네이션
  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // 모달 열기 (등록)
  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      type: undefined,
      address: '',
      bunji: '',
      households: '',
      memo: '',
    });
    setIsModalOpen(true);
  };

  // 모달 열기 (수정)
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      type: client.type || undefined,
      address: client.address || '',
      bunji: client.bunji || '',
      households: client.households || '',
      memo: client.memo || '',
    });
    setIsModalOpen(true);
  };

  // 저장
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('거래처명을 입력해주세요.');
      return;
    }

    try {
      if (editingClient) {
        await updateClient.mutateAsync({
          id: editingClient.id,
          ...formData,
        });
      } else {
        await createClient.mutateAsync(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 삭제
  const handleDelete = async (client: Client) => {
    if (!confirm(`'${client.name}' 거래처를 삭제하시겠습니까?`)) return;
    
    try {
      await deleteClient.mutateAsync(client.id);
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 카카오 주소검색
  const handleAddressSearch = () => {
    if (!window.daum) {
      alert('주소검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        // 도로명 주소 우선, 없으면 지번 주소 사용
        const address = data.roadAddress || data.jibunAddress || data.address;
        
        // 건물명이 있으면 거래처명에 자동 입력 (비어있을 때만)
        if (data.buildingName && !formData.name) {
          setFormData(prev => ({ 
            ...prev, 
            address,
            name: data.buildingName,
          }));
        } else {
          setFormData(prev => ({ ...prev, address }));
        }
      },
    }).open();
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          거래처 관리
        </h2>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          거래처 등록
        </Button>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="거래처명, 주소 검색..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <select
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value as ClientType | '');
            setCurrentPage(1);
          }}
        >
          {CLIENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* 통계 */}
      <div className="flex gap-4 text-sm">
        <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium">
          전체: <span className="font-bold">{clients.length}건</span>
        </span>
        <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-medium">
          검색결과: <span className="font-bold">{filteredClients.length}건</span>
        </span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr className="text-sm font-semibold text-gray-700">
              <th className="px-4 py-3 text-left">거래처명</th>
              <th className="px-4 py-3 text-left">유형</th>
              <th className="px-4 py-3 text-left">주소</th>
              <th className="px-4 py-3 text-left">세대수</th>
              <th className="px-4 py-3 text-left">메모</th>
              <th className="px-4 py-3 text-center w-24">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : paginatedClients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {searchTerm || filterType ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}
                </td>
              </tr>
            ) : (
              paginatedClients.map((client: Client) => (
                <tr key={client.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3">
                    {client.type && (
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        client.type === 'apt' && 'bg-blue-100 text-blue-700',
                        client.type === 'villa' && 'bg-green-100 text-green-700',
                        client.type === 'officetel' && 'bg-purple-100 text-purple-700',
                        client.type === 'house' && 'bg-yellow-100 text-yellow-700',
                        client.type === 'etc' && 'bg-gray-100 text-gray-700',
                      )}>
                        {CLIENT_TYPE_LABELS[client.type]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {client.address} {client.bunji}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{client.households}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm truncate max-w-[200px]">
                    {client.memo}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(client)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(client)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
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
              {editingClient ? '거래처 수정' : '거래처 등록'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  거래처명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="거래처명 입력"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  유형
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  value={formData.type || ''}
                  onChange={(e) => setFormData({ ...formData, type: (e.target.value || undefined) as ClientType | undefined })}
                >
                  <option value="">선택안함</option>
                  <option value="apt">아파트</option>
                  <option value="villa">빌라</option>
                  <option value="officetel">오피스텔</option>
                  <option value="house">주택</option>
                  <option value="etc">기타</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    주소
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="주소 입력"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddressSearch}
                      className="shrink-0 gap-1"
                    >
                      <MapPin className="h-4 w-4" />
                      검색
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    번지
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.bunji}
                    onChange={(e) => setFormData({ ...formData, bunji: e.target.value })}
                    placeholder="번지 입력"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  세대수
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.households}
                  onChange={(e) => setFormData({ ...formData, households: e.target.value })}
                  placeholder="세대수 입력"
                />
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
                {editingClient ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
