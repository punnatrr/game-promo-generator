"use client";

import { useState } from "react";

type ImageSlot = "image1" | "image2" | "image3";

export default function Page() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<Record<ImageSlot, string | null>>({
    image1: null,
    image2: null,
    image3: null,
  });

  async function compressImage(file: File) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");

    const maxSize = 384;
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
        0.65
      );
    });
  }

  function handlePreview(slot: ImageSlot, file?: File) {
    if (!file) return;

    const url = URL.createObjectURL(file);

    setPreviews((prev) => ({
      ...prev,
      [slot]: url,
    }));
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
      alert("กรุณาอัปโหลดภาพให้ครบ 3 ภาพ");
      setLoading(false);
      return;
    }

    const formData = new FormData();

    const [img1, img2, img3] = await Promise.all([
      compressImage(image1),
      compressImage(image2),
      compressImage(image3),
    ]);

    formData.append("image1", img1);
    formData.append("image2", img2);
    formData.append("image3", img3);

    formData.append("targetShop", (form.elements.namedItem("targetShop") as HTMLInputElement).value);
    formData.append("referenceShop", (form.elements.namedItem("referenceShop") as HTMLInputElement).value);
    formData.append("forbiddenShop", (form.elements.namedItem("forbiddenShop") as HTMLInputElement).value);

    try {
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
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            AI Game Promotion Poster Generator
          </div>

          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            Game Promo Generator
          </h1>

          <p className="mt-4 text-white/50">
            อัปโหลด 3 ภาพ แล้วให้ AI สร้างโพสต์โปรโมทไอเทมเกมแบบมืออาชีพ
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            method="post"
            encType="multipart/form-data"
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl"
          >
            <h2 className="mb-5 text-xl font-bold">ตั้งค่าภาพโปรโมท</h2>

            <div className="grid gap-4">
              <UploadBox
                title="ภาพที่ 1"
                desc="Background / Main Visual"
                name="image1"
                preview={previews.image1}
                onChange={(file) => handlePreview("image1", file)}
              />

              <UploadBox
                title="ภาพที่ 2"
                desc="ราคาแพ็ค + รูปไอเทม"
                name="image2"
                preview={previews.image2}
                onChange={(file) => handlePreview("image2", file)}
              />

              <UploadBox
                title="ภาพที่ 3"
                desc="Layout / CI / UI Reference"
                name="image3"
                preview={previews.image3}
                onChange={(file) => handlePreview("image3", file)}
              />
            </div>

            <div className="mt-6 space-y-4">
              <TextInput name="targetShop" label="ชื่อร้านของเรา" placeholder="เช่น SUPERSIX" />
              <TextInput name="referenceShop" label="ร้านอ้างอิง Layout" placeholder="เช่น FATCAT STORE" />
              <TextInput name="forbiddenShop" label="ร้านที่ห้ามใช้ UI" placeholder="เช่น FATCAT STORE" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-2xl bg-white px-5 py-4 font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "กำลังสร้างภาพ..." : "Generate Poster"}
            </button>

            {loading && (
              <div className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                กำลังประมวลผลภาพ อาจใช้เวลาประมาณ 30–90 วินาที กรุณาอย่าปิดหน้านี้
              </div>
            )}
          </form>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">ผลลัพธ์</h2>
              {result && (
                <a
                  href={result}
                  download="game-promo.png"
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black"
                >
                  Download
                </a>
              )}
            </div>

            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              {result ? (
                <img
                  src={result}
                  alt="Generated promo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="px-8 text-center text-white/40">
                  {loading ? (
                    <div>
                      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                      <p>AI กำลังสร้างภาพ...</p>
                    </div>
                  ) : (
                    <p>ภาพที่สร้างจะปรากฏตรงนี้</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function UploadBox({
  title,
  desc,
  name,
  preview,
  onChange,
}: {
  title: string;
  desc: string;
  name: string;
  preview: string | null;
  onChange: (file?: File) => void;
}) {
  return (
    <label className="group cursor-pointer rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-white/30">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-white/5">
          {preview ? (
            <img src={preview} className="h-full w-full object-cover" alt="" />
          ) : (
            <span className="text-2xl">＋</span>
          )}
        </div>

        <div className="flex-1">
          <p className="font-bold">{title}</p>
          <p className="text-sm text-white/50">{desc}</p>
          <p className="mt-2 text-xs text-white/30">PNG, JPG, WEBP</p>
        </div>

        <input
          name={name}
          type="file"
          accept="image/*"
          required
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0])}
        />
      </div>
    </label>
  );
}

function TextInput({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/60">{label}</span>
      <input
        name={name}
        required
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-white/40"
      />
    </label>
  );
}