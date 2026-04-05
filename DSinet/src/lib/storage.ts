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

export function setStoredValue<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[storage] QuotaExceededError - 저장 고간.');
    } else {
      throw e;
    }
  }
}

export function getAllStoredData(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      try {
        data[key.replace(PREFIX, '')] = JSON.parse(localStorage.getItem(key) || '');
      } catch { /* skip */ }
    }
  }
  return data;
}

export function setAllStoredData(data: Record<string, unknown>): void {
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  });
}
