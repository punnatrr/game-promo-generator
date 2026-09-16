import { HISTORY_STORAGE_KEY, MAX_HISTORY_ITEMS } from "../constants";
import type { HistoryItem } from "../types";

export function readHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : [];
  } catch (error) {
    console.warn("Could not load generation history", error);
    return [];
  }
}

export function writeHistory(nextHistory: HistoryItem[]) {
  let itemsToSave = nextHistory.slice(0, MAX_HISTORY_ITEMS);

  while (itemsToSave.length > 0) {
    try {
      window.localStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(itemsToSave)
      );
      return itemsToSave;
    } catch (error) {
      console.warn("Could not save full generation history", error);
      itemsToSave = itemsToSave.slice(0, -1);
    }
  }

  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  return [];
}

export function clearStoredHistory() {
  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
}
