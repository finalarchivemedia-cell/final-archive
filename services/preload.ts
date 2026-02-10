/**
 * Preloads media into the browser cache (image/video).
 * - Images: resolves when loaded.
 * - Videos: resolves when metadata is loaded (lightweight).
 */
export const preloadMedia = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const lower = url.toLowerCase();
    const isVideo = ['.mp4', '.webm', '.mov'].some(ext => lower.includes(ext));

    if (isVideo) {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true as any;
      v.src = url;
      const done = () => resolve();
      v.onloadedmetadata = done;
      v.onerror = () => {
        console.warn(`Failed to preload video metadata: ${url}`);
        resolve();
      };
      // Trigger load
      v.load();
      return;
    }

    const img = new Image();
    img.src = url;
    img.onload = () => resolve();
    img.onerror = () => {
      console.warn(`Failed to preload image: ${url}`);
      resolve();
    };
  });
};

// Backwards-compatible alias
export const preloadImage = preloadMedia;
