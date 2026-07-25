'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, RotateCcw, Pencil } from 'lucide-react';
import type { Schedule, CompletionRecord } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { SignaturePad, type SignaturePadHandle } from '@/components/shared/SignaturePad';

type CompletionPhoto = {
  id: string;
  url: string;
  file?: File;
  saved: boolean;
};

interface CompletionPopupProps {
  schedule: Schedule;
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    apartment_name: string;
    unit_number: string;
    customer_name: string;
    phone: string;
    content: string;
    amount: number;
    signature_data: string;
    photo_urls: string[];
  }) => void | Promise<void>;
  existingRecord?: CompletionRecord | null;
}

function formatScheduleMemo(memo: string | null | undefined): string {
  if (!memo) return '';

  try {
    const parsed = JSON.parse(memo);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? '')).filter(Boolean).join('\n');
    }
  } catch {
    // Existing rows may still store content as plain text.
  }

  return memo;
}

function resizeImageFile(file: File, maxSize = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas를 초기화할 수 없습니다.'));
        return;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('사진 변환에 실패했습니다.'));
        }
      }, 'image/jpeg', 0.82);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('사진을 불러올 수 없습니다.'));
    };

    image.src = objectUrl;
  });
}

export function CompletionPopup({ schedule, open, onClose, onConfirm, existingRecord }: CompletionPopupProps) {
  const supabase = createClient();
  const hasRecord = !!existingRecord;
  const [isEditing, setIsEditing] = useState(false);

  const [apartmentName, setApartmentName] = useState(schedule.title || '');
  const [unitNumber, setUnitNumber] = useState(schedule.unit || '');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState(formatScheduleMemo(schedule.memo));
  const [amount, setAmount] = useState(schedule.amount || 0);
  const [photos, setPhotos] = useState<CompletionPhoto[]>([]);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<CompletionPhoto[]>([]);
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  // 서명 캔버스
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const hasSignatureRef = useRef(false);
  const [showSavedSignature, setShowSavedSignature] = useState(false);

  // schedule이 바뀌면 초기값 재설정
  useEffect(() => {
    if (open) {
      if (existingRecord) {
        // 저장된 기록이 있으면 그 데이터로 채움
        setApartmentName(existingRecord.apartment_name || '');
        setUnitNumber(existingRecord.unit_number || '');
        setCustomerName(existingRecord.customer_name || '');
        setPhone(existingRecord.phone || '');
        setContent(existingRecord.content || '');
        setAmount(existingRecord.amount || 0);
        setPhotos((existingRecord.photo_urls || []).slice(0, 5).map((url, index) => ({
          id: `saved-${index}-${url}`,
          url,
          saved: true,
        })));
        setPreviewPhotoUrl(null);
        setShowSavedSignature(!!existingRecord.signature_data);
        setIsEditing(false);
        hasSignatureRef.current = !!existingRecord.signature_data;
      } else {
        setApartmentName(schedule.title || '');
        setUnitNumber(schedule.unit || '');
        setCustomerName('');
        setPhone('');
        setContent(formatScheduleMemo(schedule.memo));
        setAmount(schedule.amount || 0);
        setPhotos([]);
        setPreviewPhotoUrl(null);
        setShowSavedSignature(false);
        setIsEditing(true);
        hasSignatureRef.current = false;
      }
    }
  }, [open, schedule, existingRecord]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => {
        if (!photo.saved) URL.revokeObjectURL(photo.url);
      });
    };
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const isMobile = window.innerWidth < 1024;
    const canvasH = isMobile ? 120 : 150;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, rect.width, canvasH);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, canvasH - 30);
    ctx.lineTo(rect.width - 20, canvasH - 30);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('여기에 서명해 주세요', rect.width / 2, canvasH - 10);
  }, []);

  // 캔버스 초기화
  useEffect(() => {
    if (!open) return;
    if (showSavedSignature) return;

    requestAnimationFrame(() => initCanvas());
  }, [open, showSavedSignature, initCanvas]);

  // 네이티브 터치 이벤트 등록 (passive: false → preventDefault 가능)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open || showSavedSignature) return;

    const onTouchStart = (e: globalThis.TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      lastPosRef.current = pos;
      hasSignatureRef.current = true;
    };
    const onTouchMove = (e: globalThis.TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      const ctx = canvas.getContext('2d')!;
      ctx.strokeStyle = '#1a237e';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
    };
    const onTouchEnd = (e: globalThis.TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = false;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [open, showSavedSignature]);

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getPos(e);
    lastPosRef.current = pos;
    hasSignatureRef.current = true;
  }, [getPos]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);

    ctx.strokeStyle = '#1a237e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  }, [getPos]);

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  const clearSignature = useCallback(() => {
    signaturePadRef.current?.clear();
    setShowSavedSignature(false);
    hasSignatureRef.current = false;
    return;

    if (showSavedSignature) {
      // 저장된 서명 이미지 → 캔버스로 전환 후 초기화
      setShowSavedSignature(false);
      hasSignatureRef.current = false;
      // 캔버스가 렌더링된 후 초기화
      requestAnimationFrame(() => initCanvas());
    } else {
      // 캔버스에 그린 서명 지우기
      initCanvas();
      hasSignatureRef.current = false;
    }
  }, [showSavedSignature, initCanvas]);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setPhotos((current) => {
      const remaining = Math.max(0, 5 - current.length);
      const nextFiles = selectedFiles.slice(0, remaining);

      if (selectedFiles.length > remaining) {
        alert('사진은 최대 5장까지 첨부할 수 있습니다.');
      }

      return [
        ...current,
        ...nextFiles.map((file, index) => ({
          id: `new-${Date.now()}-${index}`,
          url: URL.createObjectURL(file),
          file,
          saved: false,
        })),
      ];
    });

    event.target.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target && !target.saved) URL.revokeObjectURL(target.url);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const uploadPhotos = async () => {
    const uploadedUrls: string[] = [];
    const savedUrls = photos.filter((photo) => photo.saved).map((photo) => photo.url);
    const newPhotos = photos.filter((photo) => !photo.saved && photo.file);
    const timestamp = Date.now();

    for (let index = 0; index < newPhotos.length; index += 1) {
      const photo = newPhotos[index];
      if (!photo.file) continue;

      const resizedBlob = await resizeImageFile(photo.file);
      const storageFileName = `${schedule.id}_${timestamp}_${index}.jpg`;

      const { error } = await supabase.storage
        .from('completion-photos')
        .upload(storageFileName, resizedBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from('completion-photos')
        .getPublicUrl(storageFileName);

      uploadedUrls.push(data.publicUrl);
    }

    return [...savedUrls, ...uploadedUrls];
  };

  const handleConfirm = async () => {
    // 서명 확인: 저장된 서명이 있거나 새로 그린 서명이 있어야 함
    if (!signaturePadRef.current?.hasSignature()) {
      alert('고객 서명이 필요합니다.');
      return;
    }

    setIsSaving(true);

    const signatureData = signaturePadRef.current?.getDataUrl() || '';

    try {
      const photoUrls = await uploadPhotos();

      await onConfirm({
        apartment_name: apartmentName,
        unit_number: unitNumber,
        customer_name: customerName,
        phone,
        content,
        amount,
        signature_data: signatureData,
        photo_urls: photoUrls,
      });
    } catch (error) {
      console.error('완료 확인서 저장 실패:', error);
      alert('완료 확인서 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 수정 모드 전환
  const handleStartEdit = () => {
    setIsEditing(true);
  };

  if (!open) return null;

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-[10000]"
        onClick={onClose}
      />
      {/* 팝업 */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-2 lg:p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90dvh] flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-green-600 text-white rounded-t-xl">
            <h2 className="text-lg font-bold">✅ 완료 확인서</h2>
            <div className="flex items-center gap-2">
              {hasRecord && !isEditing && (
                <button onClick={handleStartEdit} className="p-1 hover:bg-green-700 rounded-md transition-colors" title="수정">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1 hover:bg-green-700 rounded-md transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 폼 */}
          <div className="p-4 lg:p-5 space-y-3 lg:space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* 아파트명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아파트명 (거래처)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-600"
                value={apartmentName}
                onChange={(e) => setApartmentName(e.target.value)}
                placeholder="아파트명 입력"
                disabled={hasRecord && !isEditing}
              />
            </div>

            {/* 동호수 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">동호수</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-600"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="예: 101동 202호"
                disabled={hasRecord && !isEditing}
              />
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">고객 이름</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-600"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="이름 입력"
                disabled={hasRecord && !isEditing}
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
              <input
                type="tel"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-600"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                disabled={hasRecord && !isEditing}
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 resize-none disabled:bg-gray-100 disabled:text-gray-600"
                rows={2}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="작업 내용"
                disabled={hasRecord && !isEditing}
              />
            </div>

            {/* 사진 촬영 */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
                disabled={hasRecord && !isEditing}
              />
              {(isEditing || !hasRecord) && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photos.length >= 5 || isSaving}
                  style={{
                    width: '100%',
                    height: 42,
                    border: '1px solid #16a34a',
                    borderRadius: 8,
                    background: photos.length >= 5 || isSaving ? '#f3f4f6' : '#f0fdf4',
                    color: photos.length >= 5 || isSaving ? '#9ca3af' : '#15803d',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: photos.length >= 5 || isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  📷 사진 촬영 ({photos.length}/5)
                </button>
              )}
              {photos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 8 }}>
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => setPreviewPhotoUrl(photo.url)}
                      style={{
                        position: 'relative',
                        aspectRatio: '1 / 1',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid #e5e7eb',
                        background: '#f9fafb',
                        cursor: 'pointer',
                      }}
                    >
                      <img
                        src={photo.url}
                        alt="완료 사진"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {(isEditing || !hasRecord) && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removePhoto(photo.id);
                          }}
                          style={{
                            position: 'absolute',
                            top: 3,
                            right: 3,
                            width: 22,
                            height: 22,
                            border: 'none',
                            borderRadius: 999,
                            background: 'rgba(220,38,38,0.92)',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 700,
                            lineHeight: '22px',
                            cursor: 'pointer',
                          }}
                          aria-label="사진 삭제"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-3 py-2 pr-8 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-600"
                  value={amount ? amount.toLocaleString() : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setAmount(val ? parseInt(val, 10) : 0);
                  }}
                  placeholder="0"
                  disabled={hasRecord && !isEditing}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
              </div>
            </div>

            {/* 고객 서명 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">고객 서명</label>
                {(isEditing || !hasRecord) && (
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    지우기
                  </button>
                )}
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                {false ? (
                  /* 저장된 서명 이미지 표시 */
                  <img
                    src={existingRecord?.signature_data || ''}
                    alt="고객 서명"
                    className="w-full h-[120px] lg:h-[150px] object-contain bg-gray-50"
                  />
                ) : (
                  /* 서명 캔버스 */
                  <SignaturePad
                    ref={signaturePadRef}
                    initialDataUrl={showSavedSignature ? existingRecord?.signature_data : null}
                    disabled={hasRecord && !isEditing}
                    height={typeof window !== 'undefined' && window.innerWidth < 1024 ? 120 : 150}
                    onChange={(hasSignature) => {
                      hasSignatureRef.current = hasSignature;
                      if (hasSignature) setShowSavedSignature(false);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex gap-3 px-4 lg:px-5 py-3 lg:py-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              {hasRecord && !isEditing ? '닫기' : '취소'}
            </Button>
            {(isEditing || !hasRecord) && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleConfirm}
                disabled={isSaving}
              >
                ✅ {isSaving ? '저장 중...' : (hasRecord ? '수정 저장' : '완료 확인')}
              </Button>
            )}
          </div>
        </div>
      </div>
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10050,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewPhotoUrl(null);
            }}
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              width: 42,
              height: 42,
              border: 'none',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10051,
            }}
            aria-label="사진 닫기"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={previewPhotoUrl}
            alt="완료 사진 확대"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      )}
    </>
  );
}
