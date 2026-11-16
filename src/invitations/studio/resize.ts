// Customer photos: long edge down to 1600 px, JPEG at 0.82. Returns a data URL (the CSP allows data:, not blob:).
const LONG_EDGE = 1600;

export function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const k = Math.min(1, LONG_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas'));
        ctx.fillStyle = '#fff'; // JPEG has no alpha: transparent PNG pixels would otherwise turn black
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
