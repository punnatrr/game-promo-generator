export async function compressImage(file: File, maxSize = 768, quality = 0.65) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");

  const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);

  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("compress error");

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("compress failed"));

        resolve(
          new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
          })
        );
      },
      "image/jpeg",
      quality
    );
  });
}

export async function dataUrlToFile(dataUrl: string, filename: string) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  return new File([blob], filename, {
    type: blob.type || "image/png",
  });
}
