import type { ImageSizeValue, ResultCount } from "./types";

export const HISTORY_STORAGE_KEY = "lazyai.game.history.v1";
export const MAX_HISTORY_ITEMS = 8;

export const IMAGE_SIZE_OPTIONS: Array<{
  value: ImageSizeValue;
  label: string;
  ratio: string;
}> = [
  { value: "1:1", label: "Facebook / Instagram Feed - จัตุรัส", ratio: "1:1" },
  { value: "3:4", label: "Marketplace / โพสต์ขาย - แนวตั้ง", ratio: "3:4" },
  { value: "4:5", label: "Facebook / Instagram Feed - แนวตั้ง", ratio: "4:5" },
  { value: "9:16", label: "Story / Reels / TikTok - แนวตั้ง", ratio: "9:16" },
  { value: "4:3", label: "Facebook / Website Post - แนวนอน", ratio: "4:3" },
  { value: "16:9", label: "YouTube / Website Banner - แนวนอน", ratio: "16:9" },
];

export const RESULT_COUNT_OPTIONS: ResultCount[] = [1, 2, 3, 4, 5];
