const PREFIX = 'dsinet_';

export function getStoredItems<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function setStoredItems<T>(key: string, items: T[]): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(items));
}

export function getStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch { return defaultValue; }
}

function freeSpace() {
  const otherKeys: { key: string; size: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !key.startsWith(PREFIX)) {
      otherKeys.push({ key, size: (localStorage.getItem(key) ?? '').length });
    }
  }
  otherKeys.sort((a, b) => b.size - a.size);
  for (const { key } of otherKeys.slice(0, 5)) {
    localStorage.removeItem(key);
  }
}

export function setStoredValue<T>(key: string, value: T): void {
  const json = JSON.stringify(value);
  try {
    localStorage.setItem(PREFIX + key, json);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[storage] QuotaExceededError - clearing space');
      // 1단계: 다른 앱 키 제거
      freeSpace();
      try { localStorage.setItem(PREFIX + key, json); return; } catch { /* next */ }
      // 2단계: dsinet_ 이전 백업 키 제거
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX) && k !== PREFIX + key) localStorage.removeItem(k);
      }
      try { localStorage.setItem(PREFIX + key, json); return; } catch { /* next */ }
      // 3단계: 전체 클리어 후 현재 데이터만 저장
      console.warn('[storage] full clear');
      localStorage.clear();
      localStorage.setItem(PREFIX + key, json);
    } else { throw e; }
  }
}

export function getAllStoredData(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      try { data[key.replace(PREFIX, '')] = JSON.parse(localStorage.getItem(key) || ''); } catch { /* skip */ }
    }
  }
  return data;
}

export function setAllStoredData(data: Record<string, unknown>): void {
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  });
}
