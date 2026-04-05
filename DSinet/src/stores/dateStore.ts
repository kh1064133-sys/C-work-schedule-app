import { create } from 'zustand';

interface DateState {
  selectedDate: Date;
  calendarDate: Date;
  chartYear: number;
  setSelectedDate: (date: Date) => void;
  setCalendarDate: (date: Date) => void;
  setChartYear: (year: number) => void;
  goToToday: () => void;
  moveDay: (days: number) => void;
  moveMonth: (months: number) => void;
}

export const useDateStore = create<DateState>((set, get) => ({
  selectedDate: new Date(),
  calendarDate: new Date(),
  chartYear: new Date().getFullYear(),
  
  setSelectedDate: (date) => set({ selectedDate: date }),
  setCalendarDate: (date) => set({ calendarDate: date }),
  setChartYear: (year) => set({ chartYear: year }),
  
  goToToday: () => {
    const today = new Date();
    set({
      selectedDate: today,
      calendarDate: today,
    });
  },
  
  moveDay: (days) => {
    const { selectedDate } = get();
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    set({ selectedDate: newDate });
  },
  
  moveMonth: (months) => {
    const { calendarDate } = get();
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + months);
    set({ calendarDate: newDate });
  },
}));
