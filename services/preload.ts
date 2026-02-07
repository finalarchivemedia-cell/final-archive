/**
 * Preloads an image into the browser cache.
 * Returns a promise that resolves when the image is fully loaded.
 */
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve();
    img.onerror = () => {
      // Resolve anyway to prevent blocking the app flow on a single broken image
      console.warn(`Failed to preload image: ${url}`);
      resolve();
    };
  });
};