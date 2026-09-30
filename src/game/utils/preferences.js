// Optional UI settings must not prevent play when browser storage is blocked.
// Research data uses DataLogger, which reports persistence failures explicitly.
export const preferences = {
  getItem(key) { try { return localStorage.getItem(key); } catch { return null; } },
  setItem(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  removeItem(key) { try { localStorage.removeItem(key); return true; } catch { return false; } },
};
