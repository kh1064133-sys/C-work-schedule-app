'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { Schedule } from '@/types';

interface DepositPopupProps {
  schedule: Schedule;
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    amount: number;
    payment_method: string;
    memo: string;
  }) => void;
}

const PAYMENT_OPTIONS = [
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'transfer', label: '계좌입금' },
  { value: 'free', label: '무상' },
];

export function DepositPopup({ schedule, open, onClose, onConfirm }: DepositPopupProps) {
  const [amount, setAmount] = useState(schedule.amount || 0);
  const [paymentMethod, setPaymentMethod] = useState(schedule.payment_method || 'cash');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(schedule.amount || 0);
      setPaymentMethod(schedule.payment_method || 'cash');
      setMemo('');
    }
  }, [open, schedule]);

  const handleConfirm = () => {
    if (amount <= 0) {
      alert('입금 금액을 입력해주세요.');
      return;
    }
    onConfirm({
      amount,
      payment_method: paymentMethod,
      memo,
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
          <div className="flex items-center justify-between px-5 py-4 border-b bg-amber-500 text-white rounded-t-xl">
            <h2 className="text-lg font-bold">💰 입금 확인</h2>
            <button onClick={onClose} className="p-1 hover:bg-amber-600 rounded-md transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 폼 */}
          <div className="p-5 space-y-4">
            {/* 입금 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">입금 금액</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-3 py-2 pr-8 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
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

            {/* 입금 방법 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">입금 방법</label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      paymentMethod === opt.value
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-amber-50'
                    }`}
                    onClick={() => setPaymentMethod(opt.value as typeof paymentMethod)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="입금 관련 메모"
              />
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
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleConfirm}
            >
              💰 입금 완료
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
