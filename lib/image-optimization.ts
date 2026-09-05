const SUPABASE_STORAGE_PREFIX = "https://ftxpzdnglxubuyezqkqp.supabase.co/storage/v1/object/public/";
const ALLOWED_IMAGE_WIDTHS = [640, 750, 828, 1080, 1200, 1920] as const;

function nearestAllowedWidth(width: number) {
  return ALLOWED_IMAGE_WIDTHS.find(candidate => candidate >= width) ?? 1920;
}

export function optimizedImageUrl(source: string | null | undefined, width = 1200) {
  if (!source || !source.startsWith(SUPABASE_STORAGE_PREFIX)) return source || "";
  const safeWidth = nearestAllowedWidth(Math.max(1, width));
  return `/_next/image?url=${encodeURIComponent(source)}&w=${safeWidth}&q=75`;
}

export function optimizeArticleHtmlImages(html: string, width = 1200) {
  return html.replace(/(\bsrc\s*=\s*)(["'])(https:\/\/ftxpzdnglxubuyezqkqp\.supabase\.co\/storage\/v1\/object\/public\/[^"']+)\2/gi,
    (_match, prefix: string, quote: string, source: string) => `${prefix}${quote}${optimizedImageUrl(source, width)}${quote}`,
  );
}

type CompressionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export async function compressImageForUpload(file: File, options: CompressionOptions = {}) {
  if (!file.type.startsWith("image/")) throw new Error("Wybrany plik nie jest zdjęciem.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Zdjęcie może mieć maksymalnie 8 MB.");

  const maxWidth = options.maxWidth ?? 1920;
  const maxHeight = options.maxHeight ?? 1920;
  const quality = options.quality ?? 0.78;
  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Przeglądarka nie potrafi przygotować zdjęcia.");
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("Nie udało się skompresować zdjęcia.")), "image/webp", quality);
    });
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
