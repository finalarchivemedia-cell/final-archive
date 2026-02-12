export interface AppSettings {
  duration: number; // Seconds per image
  crop: number; // 0.25 (tight) to 1.0 (full)
}

export interface ImageRecord {
  id: string;
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
}

export interface AdminImageRecord extends ImageRecord {
  isActive: boolean;
  createdAt: string;
  originalKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  duration: 4,
  crop: 0.6,
};
