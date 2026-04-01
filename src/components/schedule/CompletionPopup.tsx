'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, RotateCcw } from 'lucide-react';
import type { Schedule } from '@/types';

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
  }) => void;
}

export function CompletionPopup({ schedule, open, onClose, onConfirm }: CompletionPopupProps) {
  const [apartmentName, setApartmentName] = useState(schedule.title || '');
  const [unitNumber, setUnitNumber] = useState(schedule.unit || '');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState(schedule.memo || '');
  const [amount, setAmount] = useState(schedule.amount || 0);

  // 서명 캔버스
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const hasSignatureRef = useRef(false);

  // schedule이 바뀌면 초기값 재설정
  useEffect(() => {
    if (open) {
      setApartmentName(schedule.title || '');
      setUnitNumber(schedule.unit || '');
      setCustomerName('');
      setPhone('');
      setContent(schedule.memo || '');
      setAmount(schedule.amount || 0);
      hasSignatureRef.current = false;
    }
  }, [open, schedule]);

  // 캔버스 초기화
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = 150 * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = '150px';
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, rect.width, 150);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 120);
      ctx.lineTo(rect.width - 20, 120);
      ctx.stroke();
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('여기에 서명해 주세요', rect.width / 2, 140);
    };

    // requestAnimationFrame to ensure DOM layout is ready
    requestAnimationFrame(resizeCanvas);
  }, [open]);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 150 * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, rect.width, 150);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 120);
    ctx.lineTo(rect.width - 20, 120);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('여기에 서명해 주세요', rect.width / 2, 140);
    hasSignatureRef.current = false;
  }, []);

  const handleConfirm = () => {
    if (!hasSignatureRef.current) {
      alert('고객 서명이 필요합니다.');
      return;
    }
    const canvas = canvasRef.current;
    const signatureData = canvas ? canvas.toDataURL('image/png') : '';

    onConfirm({
      apartment_name: apartmentName,
      unit_number: unitNumber,
      customer_name: customerName,
      phone,
      content,
      amount,
      signature_data: signatureData,
    });
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
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-green-600 text-white rounded-t-xl">
            <h2 className="text-lg font-bold">✅ 완료 확인서</h2>
            <button onClick={onClose} className="p-1 hover:bg-green-700 rounded-md transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 폼 */}
          <div className="p-5 space-y-4">
            {/* 아파트명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아파트명 (거래처)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                value={apartmentName}
                onChange={(e) => setApartmentName(e.target.value)}
                placeholder="아파트명 입력"
              />
            </div>

            {/* 동호수 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">동호수</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="예: 101동 202호"
              />
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">고객 이름</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="이름 입력"
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
              <input
                type="tel"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 resize-none"
                rows={2}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="작업 내용"
              />
            </div>

            {/* 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-3 py-2 pr-8 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                  value={amount ? amount.toLocaleString() : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setAmount(val ? parseInt(val, 10) : 0);
                  }}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
              </div>
            </div>

            {/* 고객 서명 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">고객 서명</label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  지우기
                </button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirm}
            >
              ✅ 완료 확인
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
