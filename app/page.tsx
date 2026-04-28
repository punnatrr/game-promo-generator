"use client";

import { useState } from "react";

export default function Page() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");

  const maxSize = 256;
  const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);

  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("compress error");

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(new File([blob!], file.name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.5
    );
  });
}
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const form = e.currentTarget;

const image1 = (form.elements.namedItem("image1") as HTMLInputElement).files?.[0];
const image2 = (form.elements.namedItem("image2") as HTMLInputElement).files?.[0];
const image3 = (form.elements.namedItem("image3") as HTMLInputElement).files?.[0];

if (!image1 || !image2 || !image3) {
  alert("กรุณาอัปโหลดภาพให้ครบ");
  setLoading(false);
  return;
}

const formData = new FormData();

formData.append("image1", await compressImage(image1));
formData.append("image2", await compressImage(image2));
formData.append("image3", await compressImage(image3));

formData.append("targetShop", (form.elements.namedItem("targetShop") as HTMLInputElement).value);
formData.append("referenceShop", (form.elements.namedItem("referenceShop") as HTMLInputElement).value);
formData.append("forbiddenShop", (form.elements.namedItem("forbiddenShop") as HTMLInputElement).value);

    const res = await fetch("/api/generate", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.image) {
      setResult(data.image);
    } else {
      alert(data.error || "เกิดข้อผิดพลาด");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">
          Game Promo Generator
        </h1>

        <form onSubmit={handleSubmit} method="post" encType="multipart/form-data" className="space-y-4 rounded-2xl bg-neutral-900 p-6">
          <input name="image1" type="file" accept="image/*" required className="block" />
          <input name="image2" type="file" accept="image/*" required className="block" />
          <input name="image3" type="file" accept="image/*" required className="block" />

          <input name="targetShop" placeholder="ชื่อร้านเรา" required className="w-full rounded bg-neutral-800 p-3" />
          <input name="referenceShop" placeholder="ร้านอ้างอิง layout" required className="w-full rounded bg-neutral-800 p-3" />
          <input name="forbiddenShop" placeholder="ร้านที่ห้ามใช้ UI" required className="w-full rounded bg-neutral-800 p-3" />

          <button type="submit" disabled={loading} className="rounded bg-white px-5 py-3 font-bold text-black">
            {loading ? "กำลังสร้าง..." : "Generate"}
          </button>
        </form>

        {result && (
          <img src={result} alt="Generated promo" className="rounded-2xl border border-neutral-700" />
        )}
      </div>
    </main>
  );
}