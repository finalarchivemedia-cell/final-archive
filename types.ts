export interface AppSettings {
  duration: number; // Seconds per image
  zoom: number; // 0 (no zoom) to 1.0 (zooms to 2x)
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
  zoom: 0.6,
};
