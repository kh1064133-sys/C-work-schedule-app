'use client';

import { useDateStore } from '@/stores/dateStore';
import { formatCurrency } from '@/lib/utils/format';

interface SalesData {
  estimate: number;
  delivery: number;
  construction: number;
  document: number;
  as: number;
  total: number;
  cash: number;
  card: number;
  vat: number;
  pendingCount: number;
  pendingAmount: number;
}

interface SalesSummaryProps {
  daily: SalesData;
  monthly: SalesData;
  yearly: SalesData;
}

function SalesCard({ 
  title, 
  data 
}: { 
  title: string; 
  data: SalesData;
}) {
  return (
    <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm">
      <h3 className="font-bold text-sm mb-3 opacity-90">{title}</h3>
      
      <div className="space-y-2 text-sm">
        {/* 유형별 매출 */}
        <div className="flex justify-between items-center">
          <span className="bg-white/90 text-green-600 px-2 py-0.5 rounded-full text-xs font-bold">견적</span>
          <span className="font-semibold">{formatCurrency(data.estimate)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="bg-white/90 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">납품</span>
          <span className="font-semibold">{formatCurrency(data.delivery)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="bg-white/90 text-purple-600 px-2 py-0.5 rounded-full text-xs font-bold">시공</span>
          <span className="font-semibold">{formatCurrency(data.construction)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="bg-white/90 text-teal-600 px-2 py-0.5 rounded-full text-xs font-bold">서류제출</span>
          <span className="font-semibold">{formatCurrency(data.document)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="bg-white/90 text-orange-500 px-2 py-0.5 rounded-full text-xs font-bold">AS</span>
          <span className="font-semibold">{formatCurrency(data.as)}</span>
        </div>
        
        <div className="border-t border-white/20 my-2" />
        
        <div className="flex justify-between items-center font-bold">
          <span>합계</span>
          <span className="text-lg">{formatCurrency(data.total)}</span>
        </div>
        
        <div className="border-t border-white/20 my-2" />
        
        {/* 결제방법별 */}
        <div className="flex justify-between items-center">
          <span className="bg-white/90 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">현금</span>
          <span className="text-green-200">{formatCurrency(data.cash)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="bg-white/90 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">카드</span>
          <span className="text-blue-200">{formatCurrency(data.card)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="bg-white/90 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">VAT</span>
          <span className="text-orange-200">{formatCurrency(data.vat)}</span>
        </div>
        
        {/* 미결 (일/월만 표시) */}
        {data.pendingCount > 0 && (
          <>
            <div className="border-t border-white/20 my-2" />
            <div className="flex justify-between items-center bg-red-500/20 rounded-lg px-2 py-1">
              <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">⚠ 미결</span>
              <div className="flex items-center gap-2">
                <span className="text-red-200 font-bold">{data.pendingCount}건</span>
                <span className="text-white/50">/</span>
                <span className="text-red-100">{formatCurrency(data.pendingAmount)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SalesSummary({ daily, monthly, yearly }: SalesSummaryProps) {
  return (
    <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4">💰 매출 현황</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SalesCard title="📅 일 매출" data={daily} />
        <SalesCard title="📆 월 매출" data={monthly} />
        <SalesCard title="📊 년 매출" data={yearly} />
      </div>
    </div>
  );
}

// 빈 데이터용 기본값
export const emptySalesData: SalesData = {
  estimate: 0,
  delivery: 0,
  construction: 0,
  document: 0,
  as: 0,
  total: 0,
  cash: 0,
  card: 0,
  vat: 0,
  pendingCount: 0,
  pendingAmount: 0,
};
