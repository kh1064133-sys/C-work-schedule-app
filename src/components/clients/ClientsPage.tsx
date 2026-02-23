'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Building2, ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '@/hooks/useClients';
import { cn } from '@/lib/utils';
import type { Client, ClientType, ClientInput } from '@/types';
import "@/app/clients-compat.css";

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
        width?: string;
        height?: string;
      }) => { 
        open: () => void;
        embed: (element: HTMLElement) => void;
      };
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
  const [showAddressModal, setShowAddressModal] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);

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

  // 카카오 주소검색 (embed 방식 - Android WebView 호환)
  const handleAddressSearch = () => {
    if (!window.daum) {
      alert('주소검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setShowAddressModal(true);
  };

  // 주소검색 모달이 열리면 embed 실행
  useEffect(() => {
    if (showAddressModal && addressRef.current && window.daum) {
      // 기존 내용 제거
      addressRef.current.innerHTML = '';
      
      new window.daum.Postcode({
        oncomplete: (data: any) => {
          const address = data.roadAddress || data.jibunAddress || data.address;
          
          if (data.buildingName && !formData.name) {
            setFormData(prev => ({ 
              ...prev, 
              address,
              name: data.buildingName,
            }));
          } else {
            setFormData(prev => ({ ...prev, address }));
          }
          setShowAddressModal(false);
        },
        width: '100%',
        height: '100%',
      }).embed(addressRef.current);
    }
  }, [showAddressModal, formData.name]);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg lg:text-xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          거래처 관리
        </h2>
        <Button onClick={handleOpenAdd} className="gap-2" size="sm">
          <Plus className="h-4 w-4" />
          거래처 등록
        </Button>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="거래처명, 주소 검색..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <select
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
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
      <div className="flex gap-2 text-xs sm:text-sm">
        <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium">
          전체: <span className="font-bold">{clients.length}건</span>
        </span>
        <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-100 text-green-700 rounded-lg font-medium">
          검색결과: <span className="font-bold">{filteredClients.length}건</span>
        </span>
      </div>

      {/* 테이블 */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '8px', margin: '0 0 16px 0' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: '32px 0' }}>로딩 중...</div>
        ) : paginatedClients.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', padding: '32px 0' }}>
            {searchTerm || filterType ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {paginatedClients.map((client: Client) => (
              <div key={client.id} style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '320px',
                minWidth: '0',
                minHeight: '90px',
                background: '#f9fafb',
                borderRadius: '8px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                padding: '16px',
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: 600,
                  fontSize: '16px',
                }}>
                  <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '180px',
                    display: 'inline-block',
                  }}>{client.name}</span>
                  <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '13px',
                    background: '#e0e7ff',
                    color: '#3730a3',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontWeight: 500,
                    display: 'inline-block',
                  }}>{client.type ? CLIENT_TYPE_LABELS[client.type] : '기타'}</span>
                </div>
                <div style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#555',
                  fontSize: '14px',
                  marginBottom: '4px',
                  display: 'block',
                }}>
                  {client.address} {client.bunji}
                </div>
                <div style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#888',
                  fontSize: '13px',
                  marginBottom: '4px',
                  display: 'block',
                }}>
                  세대수: {client.households}
                </div>
                {client.memo && (
                  <div style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: '#aaa',
                    fontSize: '12px',
                    display: 'block',
                  }}>{client.memo}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '8px' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(client)}
                    style={{ height: '28px', width: '28px', padding: 0 }}
                  >
                    <Edit2 style={{ width: '18px', height: '18px' }} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(client)}
                    style={{ height: '28px', width: '28px', padding: 0, color: '#ef4444', background: '#fef2f2' }}
                  >
                    <Trash2 style={{ width: '18px', height: '18px' }} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* 주소검색 모달 (embed 방식) */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg m-4 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b bg-gray-50">
              <h3 className="font-bold text-gray-800">주소 검색</h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div 
              ref={addressRef} 
              className="w-full h-[400px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
