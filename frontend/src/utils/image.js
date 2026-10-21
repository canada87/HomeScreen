// Icons are shown at 20-48px, so anything bigger only bloats the widget JSON
export const ICON_MAX_SIZE = 128;

// Data URLs longer than this are considered oversized and get shrunk (~45KB of image data)
export const ICON_MAX_DATA_URL_LENGTH = 60000;

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Failed to decode image'));
  img.src = src;
});

// Downscale an image data URL so its longest side is at most `maxSize` pixels.
// Uses WebP (keeps transparency, small output) and falls back to PNG where unsupported.
export const resizeImageDataUrl = async (dataUrl, maxSize = ICON_MAX_SIZE) => {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const webp = canvas.toDataURL('image/webp', 0.9);
  const resized = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  // Never make an already small image bigger
  return resized.length < dataUrl.length ? resized : dataUrl;
};
