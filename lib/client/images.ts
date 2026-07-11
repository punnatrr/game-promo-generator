export async function compressImage(file: File, maxSize = 768): Promise<File> {
  const bitmap = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) throw new Error("compress error");

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return await new Promise<File>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("compress failed"));
            return;
          }

          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
            })
          );
        },
        "image/jpeg",
        0.65
      );
    });
  } finally {
    bitmap.close();
  }
}

export async function dataUrlToFile(
  dataUrl: string,
  filename: string
): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}
