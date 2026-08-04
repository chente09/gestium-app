import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageCompressionService {

  // Redimensiona y recomprime una imagen en el navegador antes de subirla,
  // para no seguir acumulando fotos de cámara sin comprimir en Storage
  // (los itinerarios llegaron a 9.5GB así). No toca archivos no-imagen.
  async compressImage(file: File, maxWidth = 1600, quality = 0.75): Promise<File> {
    if (!file.type.startsWith('image/')) {
      return file;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await this.loadImage(objectUrl);

      const scale = Math.min(1, maxWidth / image.width);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', quality)
      );
      if (!blob || blob.size >= file.size) {
        // Si no se ganó nada (imagen ya pequeña/comprimida), usar el original.
        return file;
      }

      return new File([blob], file.name, { type: 'image/jpeg' });
    } catch {
      // Ante cualquier problema comprimiendo, seguir con el archivo original
      // en vez de bloquear la subida.
      return file;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}
