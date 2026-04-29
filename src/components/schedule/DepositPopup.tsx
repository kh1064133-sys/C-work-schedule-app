'use client';

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaymentMethod } from '@/types';

interface DepositPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    amount: number;
    payment_method: PaymentMethod;
    deposit_memo: string;
  }) => void;
  amount: number;
  setAmount: (value: number) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (value: PaymentMethod) => void;
  memo: string;
  setMemo: (value: string) => void;
}

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'vat', label: 'VAT' },
  { value: 'free', label: '무상' },
];

export function DepositPopup({
  open,
  onClose,
  onConfirm,
  amount,
  setAmount,
  paymentMethod,
  setPaymentMethod,
  memo,
  setMemo,
}: DepositPopupProps) {
  const vatIncluded = useMemo(() => {
    if (paymentMethod === 'card' || paymentMethod === 'vat') {
      return Math.floor((amount || 0) * 1.1);
    }

    return amount || 0;
  }, [amount, paymentMethod]);

  useEffect(() => {
    if (paymentMethod === 'free') {
      setAmount(0);
    }
  }, [paymentMethod, setAmount]);

  const handleConfirm = () => {
    if (paymentMethod === 'free') {
      onConfirm({
        amount: 0,
        payment_method: 'free',
        deposit_memo: memo,
      });
      return;
    }

    if (!amount || amount <= 0) {
      alert('입금 금액을 입력해주세요.');
      return;
    }

    const saveAmount = paymentMethod === 'card' || paymentMethod === 'vat'
      ? vatIncluded
      : amount;

    onConfirm({
      amount: saveAmount,
      payment_method: paymentMethod,
      deposit_memo: memo,
    });
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-2 lg:p-4">
        <div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between rounded-t-xl border-b bg-amber-500 px-5 py-4 text-white">
            <h2 className="text-lg font-bold">입금 확인</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 transition-colors hover:bg-amber-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 lg:space-y-4 lg:p-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">입금 금액</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full rounded-lg border px-3 py-2 pr-8 text-right text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  value={paymentMethod === 'free' ? '0' : (amount ? amount.toLocaleString() : '')}
                  onChange={(e) => {
                    if (paymentMethod === 'free') return;
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setAmount(value ? parseInt(value, 10) : 0);
                  }}
                  placeholder="0"
                  readOnly={paymentMethod === 'free'}
                  style={paymentMethod === 'free' ? { backgroundColor: '#f3f4f6', color: '#888' } : undefined}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
              </div>
              {(paymentMethod === 'card' || paymentMethod === 'vat') && (
                <div className="mt-1 text-right text-xs text-amber-600">
                  부가세 포함: <b>{vatIncluded.toLocaleString()}</b>원
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">입금 방법</label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      paymentMethod === option.value
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-amber-50'
                    }`}
                    onClick={() => setPaymentMethod(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">메모</label>
              <textarea
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="입금 관련 메모"
              />
            </div>
          </div>

          <div className="flex flex-shrink-0 gap-3 rounded-b-xl border-t bg-gray-50 px-4 py-3 lg:px-5 lg:py-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              className="flex-1 bg-amber-500 text-white hover:bg-amber-600"
              onClick={handleConfirm}
            >
              입금 완료
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
