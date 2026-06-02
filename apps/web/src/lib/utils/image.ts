/**
 * Compression d'image côté navigateur (client only).
 *
 * Pourquoi : les photos prises au smartphone font 3 à 12 Mo. Vercel impose une
 * limite DURE de 4,5 Mo sur le corps des requêtes serverless (donc des Server
 * Actions) — non contournable par `serverActions.bodySizeLimit`. Et sur un
 * réseau 4G lent (~15 Ko/s en zone portuaire), envoyer plusieurs Mo prend des
 * minutes et fait timeout la fonction.
 *
 * On redimensionne donc à `maxDim` px (côté le plus long) et on ré-encode en
 * JPEG `quality` AVANT l'upload. Une photo d'anomalie reste parfaitement
 * lisible à 1600px / qualité 0.7 tout en pesant ~150–350 Ko.
 *
 * En cas d'échec de décodage (ex. HEIC iOS non supporté par le canvas), on
 * retombe sur le fichier original — le serveur l'acceptera quand même s'il
 * reste sous la limite.
 */
export async function compressImage(
  file: File,
  opts?: { maxDim?: number; quality?: number },
): Promise<File> {
  const maxDim = opts?.maxDim ?? 1600;
  const quality = opts?.quality ?? 0.7;

  // On ne traite que les images bitmap décodables
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }

  try {
    // imageOrientation: respecte l'EXIF (photos portrait pas tournées)
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDim / longest);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) {
      // Compression inutile (déjà plus petit) → garde l'original
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file; // fallback robuste
  }
}
