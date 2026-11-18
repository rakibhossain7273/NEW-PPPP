import { BdrisDocumentFile } from '../types/bdris';

/**
 * Compresses an uploaded image file in-browser via Canvas so it fits BDRIS
 * portal file-size limits and syncs rapidly to the Chrome Extension.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1400,
  quality = 0.82
): Promise<BdrisDocumentFile> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('ছবি পড়া যায়নি।'));
    reader.readAsDataURL(file);
  });

  // Only rasterize images; pass through PDFs or non-image files if small
  if (!file.type.startsWith('image/')) {
    const comma = dataUrl.indexOf(',');
    return {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
    };
  }

  return new Promise<BdrisDocumentFile>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const outDataUrl = canvas.toDataURL('image/jpeg', quality);
      const comma = outDataUrl.indexOf(',');
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'document';
      resolve({
        name: `${baseName}.jpg`,
        mimeType: 'image/jpeg',
        base64: comma >= 0 ? outDataUrl.slice(comma + 1) : outDataUrl,
      });
    };
    img.onerror = () => reject(new Error('ছবি প্রসেস করা যায়নি।'));
    img.src = dataUrl;
  });
}
