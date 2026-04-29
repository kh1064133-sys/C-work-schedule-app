'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, TrendingUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDateStore } from '@/stores/dateStore';
import { useUIStore } from '@/stores/uiStore';
import { useSchedulesByMonth, useSchedulesByYear } from '@/hooks/useSchedules';
import { getScheduleAmountWithTax } from '@/lib/utils/scheduleAmount';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Schedule, ScheduleType, PaymentMethod } from '@/types';

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  sale: '판매',
  as: 'AS',
  agency: '대리점',
  group: '공동구매',
  install: '외주설치',
  daily: '일당',
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '현금',
  card: '카드',
  vat: 'VAT',
  free: '무상',
};

export function AnalyticsPage() {
  const { chartYear, setChartYear } = useDateStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const { showYearlySales, toggleSection } = useUIStore();
  
  // 선택된 월 기준 데이터
  const { data: monthSchedules = [] } = useSchedulesByMonth(chartYear, selectedMonth);
  
  // 연간 데이터
  const { data: yearSchedules = [] } = useSchedulesByYear(chartYear);

  // 연간 완료된 스케줄
  const yearCompletedSchedules = useMemo(() => {
    return yearSchedules.filter((s: Schedule) => s.is_done);
  }, [yearSchedules]);

  // 연간 매출 합계
  const yearlyTotal = useMemo(() => {
    return yearCompletedSchedules.reduce((sum: number, s: Schedule) => sum + getScheduleAmountWithTax(s), 0);
  }, [yearCompletedSchedules]);

  // 연간 결제방법별 통계
  const yearPaymentStats = useMemo(() => {
    const stats: Record<string, { count: number; amount: number }> = {
      cash: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      vat: { count: 0, amount: 0 },
    };
    yearCompletedSchedules.forEach((s: Schedule) => {
      if (s.payment_method && stats[s.payment_method]) {
        stats[s.payment_method].count += 1;
        stats[s.payment_method].amount += getScheduleAmountWithTax(s);
      }
    });
    return stats;
  }, [yearCompletedSchedules]);

  // 연간 유형별 통계
  const yearTypeStats = useMemo(() => {
    const stats: Record<string, { count: number; amount: number }> = {
      sale: { count: 0, amount: 0 },
      as: { count: 0, amount: 0 },
      agency: { count: 0, amount: 0 },
      group: { count: 0, amount: 0 },
    };
    yearCompletedSchedules.forEach((s: Schedule) => {
      if (s.schedule_type && stats[s.schedule_type]) {
        stats[s.schedule_type].count += 1;
        stats[s.schedule_type].amount += getScheduleAmountWithTax(s);
      }
    });
    return stats;
  }, [yearCompletedSchedules]);

  // 월별 데이터 수집 (연간 차트용)
  // 선택된 월의 완료된 스케줄만
  const completedSchedules = useMemo(() => {
    return monthSchedules.filter((s: Schedule) => s.is_done);
  }, [monthSchedules]);

  // 월 매출 합계
  const monthlyTotal = useMemo(() => {
    return completedSchedules.reduce((sum: number, s: Schedule) => sum + getScheduleAmountWithTax(s), 0);
  }, [completedSchedules]);

  // 결제방법별 통계
  const paymentStats = useMemo(() => {
    const stats: Record<string, { count: number; amount: number }> = {
      cash: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      vat: { count: 0, amount: 0 },
    };
    completedSchedules.forEach((s: Schedule) => {
      if (s.payment_method && stats[s.payment_method]) {
        stats[s.payment_method].count += 1;
        stats[s.payment_method].amount += getScheduleAmountWithTax(s);
      }
    });
    return stats;
  }, [completedSchedules]);

  // 유형별 통계
  const typeStats = useMemo(() => {
    const stats: Record<string, { count: number; amount: number }> = {
      sale: { count: 0, amount: 0 },
      as: { count: 0, amount: 0 },
      agency: { count: 0, amount: 0 },
      group: { count: 0, amount: 0 },
    };
    completedSchedules.forEach((s: Schedule) => {
      if (s.schedule_type && stats[s.schedule_type]) {
        stats[s.schedule_type].count += 1;
        stats[s.schedule_type].amount += getScheduleAmountWithTax(s);
      }
    });
    return stats;
  }, [completedSchedules]);

  // 월별 매출 데이터 (연간 차트용)
  const monthlyData = useMemo(() => {
    const data: { month: number; amount: number; count: number }[] = [];
    for (let i = 0; i < 12; i++) {
      data.push({ month: i + 1, amount: 0, count: 0 });
    }
    yearCompletedSchedules.forEach((s: Schedule) => {
      const m = parseInt(s.date.split('-')[1], 10);
      if (m >= 1 && m <= 12) {
        data[m - 1].amount += getScheduleAmountWithTax(s);
        data[m - 1].count += 1;
      }
    });
    return data;
  }, [yearCompletedSchedules]);

  // 최대 월별 매출 (차트 스케일용)
  const maxMonthlyAmount = useMemo(() => {
    return Math.max(...monthlyData.map(d => d.amount), 1);
  }, [monthlyData]);

  // Y축 최대값: 천만원 단위로 올림 (최소 1천만)
  const yAxisMax = useMemo(() => {
    const step = 10000000;
    return Math.max(Math.ceil(maxMonthlyAmount / step) * step, step);
  }, [maxMonthlyAmount]);

  const monthName = new Date(chartYear, selectedMonth).toLocaleDateString('ko-KR', { month: 'long' });

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          매출현황표
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setChartYear(chartYear - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[80px] text-center">
            {chartYear}년
          </span>
          <Button variant="outline" size="icon" onClick={() => setChartYear(chartYear + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 월 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
        {Array.from({ length: 12 }, (_, i) => (
          <button
            key={i}
            onClick={() => setSelectedMonth(i)}
            className={cn(
              'py-2 px-3 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
              selectedMonth === i
                ? 'bg-primary text-white'
                : 'bg-white border hover:bg-gray-50'
            )}
          >
            {i + 1}월
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white rounded-xl border p-2 md:p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <span className="text-base font-bold">₩</span>
            <span className="text-sm">월 매출</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 whitespace-nowrap">
            {monthlyTotal.toLocaleString()}원
          </div>
        </div>
        <div className="bg-white rounded-xl border p-2 md:p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">완료 건수</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 whitespace-nowrap">
            {completedSchedules.length}건
          </div>
        </div>
        <div className="bg-white rounded-xl border p-2 md:p-4">
          <div className="text-sm text-gray-600 mb-1">전체 일정</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-700 whitespace-nowrap">
            {monthSchedules.length}건
          </div>
        </div>
        <div className="bg-white rounded-xl border p-2 md:p-4">
          <div className="text-sm text-gray-600 mb-1">건당 평균</div>
          <div className="text-xl sm:text-2xl font-bold text-purple-600 whitespace-nowrap">
            {completedSchedules.length > 0
              ? Math.round(monthlyTotal / completedSchedules.length).toLocaleString()
              : 0}원
          </div>
        </div>
      </div>

      {/* 월별 매출 차트 */}
      <div className="bg-white rounded-xl border p-2 md:p-4">
        <h3 className="font-semibold text-gray-800 mb-4">{chartYear}년 월별 매출</h3>
        <div className="overflow-x-auto">
          <div className="flex min-w-[400px]" style={{ height: 180 }}>
            {/* Y축 레이블 영역 */}
            <div className="flex flex-col justify-end relative" style={{ width: 48, height: 160 }}>
              {(() => {
                const step = 10000000;
                const lines: number[] = [];
                for (let v = step; v <= yAxisMax; v += step) {
                  lines.push(v);
                }
                return lines.map((v) => {
                  const pct = (v / yAxisMax) * 100;
                  return (
                    <span
                      key={v}
                      className="absolute right-1 text-[10px] text-gray-400 leading-none"
                      style={{ bottom: `${pct}%`, transform: 'translateY(50%)' }}
                    >
                      {(v / 10000000).toLocaleString()}천만
                    </span>
                  );
                });
              })()}
            </div>
            {/* 차트 영역 */}
            <div className="flex-1 relative" style={{ height: 180 }}>
              {/* 기준선 (천만원 단위) */}
              {(() => {
                const step = 10000000;
                const lines: number[] = [];
                for (let v = step; v <= yAxisMax; v += step) {
                  lines.push(v);
                }
                return lines.map((v) => {
                  const pct = (v / yAxisMax) * 100;
                  return (
                    <div
                      key={v}
                      className="absolute left-0 right-0"
                      style={{
                        bottom: `${(pct / 100) * 160 + 20}px`,
                        borderTop: '1.5px dashed #9CA3AF',
                        zIndex: 1,
                      }}
                    />
                  );
                });
              })()}
              {/* 막대 그래프 */}
              <div className="flex items-end gap-2 h-full" style={{ paddingBottom: 20 }}>
                {monthlyData.map((data, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: 160 }}>
                      <div
                        className={cn(
                          'w-full max-w-[30px] rounded-t transition-all',
                          data.amount > 0
                            ? index === selectedMonth ? 'bg-emerald-600' : 'bg-emerald-400'
                            : 'bg-gray-200'
                        )}
                        style={{
                          height: `${Math.max((data.amount / yAxisMax) * 100, 2)}%`,
                          position: 'relative',
                          zIndex: 2,
                        }}
                        title={`${data.month}월: ${data.amount.toLocaleString()}원 (${data.count}건)`}
                      />
                    </div>
                    <span className={cn(
                      'text-[11px] mt-1',
                      index === selectedMonth ? 'text-emerald-700 font-bold' : 'text-gray-500'
                    )}>{data.month}월</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 결제방법별 통계 */}
      <div className="grid md:grid-cols-2 gap-2 md:gap-4">
        <div className="bg-white rounded-xl border p-2 md:p-4">
          <h3 className="font-semibold text-gray-800 mb-4">결제방법별 현황</h3>
          <div className="space-y-3">
            {Object.entries(paymentStats).map(([key, data]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'w-3 h-3 rounded-full',
                    key === 'cash' && 'bg-green-500',
                    key === 'card' && 'bg-blue-500',
                    key === 'vat' && 'bg-orange-500'
                  )} />
                  <span className="font-medium">
                    {PAYMENT_METHOD_LABELS[key as PaymentMethod]}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{data.amount.toLocaleString()}원</div>
                  <div className="text-xs text-gray-500">{data.count}건</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 유형별 통계 */}
        <div className="bg-white rounded-xl border p-2 md:p-4">
          <h3 className="font-semibold text-gray-800 mb-4">유형별 현황</h3>
          <div className="space-y-3">
            {Object.entries(typeStats).map(([key, data]) => {
              const total = Object.values(typeStats).reduce((s, d) => s + d.amount, 0) || 1;
              const pct = (data.amount / total) * 100;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">
                      {SCHEDULE_TYPE_LABELS[key as ScheduleType]}
                    </span>
                    <div className="text-right">
                      <span className="font-bold">{data.amount.toLocaleString()}원</span>
                      <span className="text-xs text-gray-500 ml-2">({data.count}건)</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        key === 'sale' && 'bg-emerald-500',
                        key === 'as' && 'bg-yellow-500',
                        key === 'agency' && 'bg-purple-500',
                        key === 'group' && 'bg-pink-500'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 상세 내역 테이블 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-2 md:p-4 border-b">
          <h3 className="font-semibold text-gray-800">{monthName} 매출 상세 내역</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr className="text-sm font-semibold text-gray-700">
                <th className="px-2 md:px-4 py-2 md:py-3 text-left">날짜</th>
                <th className="px-2 md:px-4 py-2 md:py-3 text-left">거래처/내용</th>
                <th className="px-2 md:px-4 py-2 md:py-3 text-center">유형</th>
                <th className="px-2 md:px-4 py-2 md:py-3 text-center">결제</th>
                <th className="px-2 md:px-4 py-2 md:py-3 text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {completedSchedules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 md:px-4 py-8 text-center text-gray-500">
                    완료된 일정이 없습니다.
                  </td>
                </tr>
              ) : (
                completedSchedules.map((schedule: Schedule) => (
                  <tr key={schedule.id} className="border-b hover:bg-gray-50">
                    <td className="px-2 md:px-4 py-2 md:py-3 text-sm">
                      {format(new Date(schedule.date), 'M/d')}
                      <span className="text-gray-400 ml-1">{schedule.time_slot}</span>
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3">
                      <div className="font-medium">{schedule.title || '-'}</div>
                      {schedule.memo && (
                        <div className="text-xs text-gray-500">{schedule.memo}</div>
                      )}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                      {schedule.schedule_type && (
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          schedule.schedule_type === 'sale' && 'bg-emerald-100 text-emerald-700',
                          schedule.schedule_type === 'as' && 'bg-yellow-100 text-yellow-700',
                          schedule.schedule_type === 'agency' && 'bg-purple-100 text-purple-700',
                          schedule.schedule_type === 'group' && 'bg-pink-100 text-pink-700'
                        )}>
                          {SCHEDULE_TYPE_LABELS[schedule.schedule_type]}
                        </span>
                      )}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                      {schedule.payment_method && (
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          schedule.payment_method === 'cash' && 'bg-green-100 text-green-700',
                          schedule.payment_method === 'card' && 'bg-blue-100 text-blue-700',
                          schedule.payment_method === 'vat' && 'bg-orange-100 text-orange-700'
                        )}>
                          {PAYMENT_METHOD_LABELS[schedule.payment_method]}
                        </span>
                      )}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-right font-medium text-emerald-600">
                      {getScheduleAmountWithTax(schedule).toLocaleString()}원
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {completedSchedules.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr className="font-bold">
                  <td colSpan={4} className="px-2 md:px-4 py-2 md:py-3 text-right">합계</td>
                  <td className="px-2 md:px-4 py-2 md:py-3 text-right text-emerald-600">
                    {monthlyTotal.toLocaleString()}원
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 년매출 현황 */}
      <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl overflow-hidden shadow-lg">
        <button
          onClick={() => toggleSection('showYearlySales')}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <h3 className="text-lg font-bold">💰 {chartYear}년 매출 현황</h3>
          {showYearlySales ? <ChevronUp className="h-5 w-5 text-white/80" /> : <ChevronDown className="h-5 w-5 text-white/80" />}
        </button>
        
        {showYearlySales && (
        <div className="bg-white/15 rounded-xl mx-1 md:mx-4 mb-4 p-2 md:p-4 backdrop-blur-sm">
          <div className="space-y-2 text-sm">
            {/* 유형별 매출 */}
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-green-600 px-2 py-0.5 rounded-full text-xs font-bold">판매</span>
              <span className="font-semibold">{yearTypeStats.sale.amount.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-orange-500 px-2 py-0.5 rounded-full text-xs font-bold">AS</span>
              <span className="font-semibold">{yearTypeStats.as.amount.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold">대리점</span>
              <span className="font-semibold">{yearTypeStats.agency.amount.toLocaleString()}원</span>
            </div>
            
            <div className="border-t border-white/20 my-2" />
            
            <div className="flex justify-between items-center font-bold">
              <span>합계</span>
              <span className="text-lg">{yearlyTotal.toLocaleString()}원</span>
            </div>
            
            <div className="border-t border-white/20 my-2" />
            
            {/* 결제방법별 */}
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">현금</span>
              <span className="text-green-200">{yearPaymentStats.cash.amount.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">카드</span>
              <span className="text-blue-200">{yearPaymentStats.card.amount.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-white/90 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">VAT</span>
              <span className="text-orange-200">{yearPaymentStats.vat.amount.toLocaleString()}원</span>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
