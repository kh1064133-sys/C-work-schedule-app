// 금액 포맷 (원 단위, 콤마)
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

// 금액 파싱 (문자열 → 숫자)
export function parseCurrency(str: string): number {
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

// 금액 입력 포맷 (콤마만, 원 제외)
export function formatCurrencyInput(str: string): string {
  const num = parseCurrency(str);
  return num > 0 ? num.toLocaleString('ko-KR') : '';
}

// 건수 포맷
export function formatCount(count: number): string {
  return `${count}건`;
}

// 퍼센트 포맷
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

// 금액 축약 (차트용)
export function formatCurrencyShort(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  }
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}천만`;
  }
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(0)}백만`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만`;
  }
  return amount.toString();
}
