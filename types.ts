export interface AppSettings {
  duration: number; // Seconds per image
  crop: number; // 0.25 (tight) to 1.0 (full)
}

export interface ImageRecord {
  id: string;
  url: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  duration: 4,
  crop: 0.6,
};
