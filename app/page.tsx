"use client";

import { useState } from "react";

type ImageSlot = "image1" | "image2" | "image3";

export default function Page() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);

  const [editInstruction, setEditInstruction] = useState("");

  const [targetShop, setTargetShop] = useState("");
  const [referenceShop, setReferenceShop] = useState("");
  const [forbiddenShop, setForbiddenShop] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");

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
        0.65
      );
    });
  }

  async function dataUrlToFile(dataUrl: string, filename: string) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    return new File([blob], filename, {
      type: blob.type || "image/png",
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

    const image1 = (form.elements.namedItem("image1") as HTMLInputElement)
      .files?.[0];

    const image2 = (form.elements.namedItem("image2") as HTMLInputElement)
      .files?.[0];

    const image3 = (form.elements.namedItem("image3") as HTMLInputElement)
      .files?.[0];

    if (!image1 || !image2 || !image3) {
      alert("กรุณาอัปโหลดภาพให้ครบ 3 ภาพ");
      setLoading(false);
      return;
    }

    try {
      const [img1, img2, img3] = await Promise.all([
        compressImage(image1),
        compressImage(image2),
        compressImage(image3),
      ]);

      const formData = new FormData();

      formData.append("mode", "generate");

      formData.append("image1", img1);
      formData.append("image2", img2);
      formData.append("image3", img3);

      formData.append("targetShop", targetShop);
      formData.append("referenceShop", referenceShop);
      formData.append("forbiddenShop", forbiddenShop);
      formData.append("aspectRatio", aspectRatio);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.image) {
        setResult(data.image);
        setEditInstruction("");
      } else {
        alert(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!result) {
      alert("ยังไม่มีภาพให้แก้ไข");
      return;
    }

    if (!editInstruction.trim()) {
      alert("กรุณาพิมพ์คำสั่งที่ต้องการแก้ไข");
      return;
    }

    setRefining(true);

    try {
      const generatedImage = await dataUrlToFile(
        result,
        "generated-image.png"
      );

      const formData = new FormData();

      formData.append("mode", "refine");
      formData.append("generatedImage", generatedImage);
      formData.append("editInstruction", editInstruction.trim());

      // ส่ง context เดิมกลับไปด้วย เพื่อไม่ให้ AI หลุดโจทย์เดิม
      formData.append("targetShop", targetShop);
      formData.append("referenceShop", referenceShop);
      formData.append("forbiddenShop", forbiddenShop);
      formData.append("aspectRatio", aspectRatio);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.image) {
        setResult(data.image);
        setEditInstruction("");
      } else {
        alert(data.error || "แก้ไขภาพไม่สำเร็จ");
      }
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดระหว่างแก้ไขภาพ");
    } finally {
      setRefining(false);
    }
  }

  const busy = loading || refining;

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
              <TextInput
                name="targetShop"
                label="ชื่อร้านของเรา"
                placeholder="เช่น SUPERSIX"
                value={targetShop}
                onChange={setTargetShop}
              />

              <TextInput
                name="referenceShop"
                label="ร้านอ้างอิง Layout"
                placeholder="เช่น FATCAT STORE"
                value={referenceShop}
                onChange={setReferenceShop}
              />

              <TextInput
                name="forbiddenShop"
                label="ร้านที่ห้ามใช้ UI"
                placeholder="เช่น FATCAT STORE"
                value={forbiddenShop}
                onChange={setForbiddenShop}
              />

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/60">
                  ขนาดภาพ
                </span>

                <select
                  name="aspectRatio"
                  required
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/40"
                >
                  <option value="1:1">1:1 — Square Post</option>
                  <option value="4:5">4:5 — Facebook / IG Portrait</option>
                  <option value="16:9">16:9 — Wide Banner</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-4 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}

              {loading ? "AI กำลังสร้างภาพ..." : "Generate Poster"}
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
              ) : loading ? (
                <div className="px-8 text-center">
                  <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-white" />

                  <p className="text-lg font-bold text-white">
                    AI กำลังสร้างภาพ
                  </p>

                  <p className="mt-2 text-sm text-white/40">
                    กำลังจัดวาง layout, item, ราคา และ UI ตามภาพอ้างอิง
                  </p>
                </div>
              ) : (
                <div className="px-8 text-center text-white/40">
                  <div className="mb-4 text-5xl">🎮</div>
                  <p>ภาพที่สร้างจะปรากฏตรงนี้</p>
                </div>
              )}
            </div>

            {result && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="font-bold">แก้ไขภาพนี้เพิ่มเติม</h3>

                <p className="mt-1 text-sm text-white/40">
                  พิมพ์สิ่งที่อยากให้ AI ปรับจากภาพผลลัพธ์ล่าสุด
                </p>

                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  disabled={busy}
                  rows={4}
                  placeholder="เช่น ทำแพ็คราคาให้เข้ากับ CI ร้านมากขึ้น, เพิ่มราคาตัวใหญ่ขึ้น, ลดความรก, เปลี่ยนโทนเป็นทองดำ"
                  className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-white/40 disabled:opacity-60"
                />

                <button
                  type="button"
                  disabled={busy || !editInstruction.trim()}
                  onClick={handleRefine}
                  className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-5 py-4 font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {refining && (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  )}

                  {refining ? "AI กำลังแก้ไขภาพ..." : "แก้ไขภาพนี้"}
                </button>

                {refining && (
                  <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                    กำลังส่งภาพผลลัพธ์เดิมกลับไปให้ AI ปรับแก้ตามคำสั่งของคุณ
                  </div>
                )}
              </div>
            )}
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
    <label className="group cursor-pointer rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-white/30 hover:bg-white/[0.06]">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-white/5">
          {preview ? (
            <img src={preview} className="h-full w-full object-cover" alt="" />
          ) : (
            <span className="text-2xl opacity-50">＋</span>
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
  value,
  onChange,
}: {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/60">
        {label}
      </span>

      <input
        name={name}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-white/40"
      />
    </label>
  );
}