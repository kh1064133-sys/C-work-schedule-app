import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FIXED_HOLIDAYS, LUNAR_HOLIDAYS, getLunarDay } from './holidays';

// 날짜 포맷 함수들
export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDateKorean(date: Date): string {
  return format(date, 'yyyy년 M월 d일', { locale: ko });
}

export function formatMonthKorean(date: Date): string {
  return format(date, 'yyyy년 M월', { locale: ko });
}

export function formatTime(timeSlot: string): string {
  return timeSlot;
}

// 시간 슬롯 파싱
export function parseTimeSlot(slot: string): { hour: number; minute: number } {
  const [h, m] = slot.split(':').map(Number);
  return { hour: h, minute: m || 0 };
}

// 시간 슬롯을 소수로 변환 (정렬용)
export function timeSlotToFloat(slot: string): number {
  const { hour, minute } = parseTimeSlot(slot);
  return hour + minute / 60;
}

// 공휴일 이름 가져오기
export function getHolidayName(date: Date): string | null {
  const dateKey = formatDate(date);
  const mmdd = dateKey.slice(5); // MM-DD
  return LUNAR_HOLIDAYS[dateKey] || FIXED_HOLIDAYS[mmdd] || null;
}

// 공휴일 여부
export function isHoliday(date: Date): boolean {
  return getHolidayName(date) !== null;
}

// 일요일 여부
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

// 토요일 여부
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}

// 음력 정보 (1일, 15일만 표시)
export function getLunarInfo(date: Date): string | null {
  const lunar = getLunarDay(date);
  if (lunar && (lunar.day === 1 || lunar.day === 15)) {
    return `음 ${lunar.month}.${lunar.day}`;
  }
  return null;
}

// 달력 그리드용 날짜 배열 생성
export function getCalendarDays(year: number, month: number): Date[] {
  const start = startOfWeek(startOfMonth(new Date(year, month)), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(new Date(year, month)), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

// 같은 달인지 확인
export { isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays };

// 요일 이름
export const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 오늘 날짜
export function getToday(): Date {
  return new Date();
}
