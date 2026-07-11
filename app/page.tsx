"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { FileUpload } from "@/app/components/ui/file-upload";
import { RadioGroup } from "@/app/components/ui/radio-group";
import { SelectField } from "@/app/components/ui/select-field";
import { Spinner } from "@/app/components/ui/spinner";
import { StatusMessage } from "@/app/components/ui/status-message";
import { TextareaField } from "@/app/components/ui/textarea-field";
import { TextField } from "@/app/components/ui/text-field";
import { compressImage, dataUrlToFile } from "@/lib/client/images";
import type {
  AspectRatio,
  ImageModel,
  ImageQuality,
} from "@/lib/generation/config";

type ImageSlot = "image1" | "image2" | "image3";

const IMAGE_SIZE_OPTIONS = [
  { value: "1:1", label: "สี่เหลี่ยมจัตุรัส", description: "1:1" },
  { value: "3:4", label: "แนวตั้ง", description: "3:4" },
  { value: "4:5", label: "Facebook แนวตั้ง", description: "4:5" },
  { value: "9:16", label: "สตอรี่", description: "9:16" },
  { value: "4:3", label: "แนวนอน", description: "4:3" },
  { value: "16:9", label: "จอกว้าง", description: "16:9" },
] as const;

const AI_MODEL_OPTIONS = [
  { value: "gpt-image-1.5", label: "GPT Image 1.5 — balanced cost/quality" },
  { value: "gpt-image-2", label: "GPT Image 2 — highest quality" },
  { value: "gemini-3-pro-image-preview", label: "Gemini 3 Pro Image — old provider" },
] as const;

const IMAGE_QUALITY_OPTIONS = [
  { value: "low", label: "Low — cheapest draft" },
  { value: "medium", label: "Medium — recommended" },
  { value: "high", label: "High — final artwork" },
] as const;

export default function Page() {
  const [result, setResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);

  const [editInstruction, setEditInstruction] = useState("");

  const [targetShop, setTargetShop] = useState("");
  const [referenceShop, setReferenceShop] = useState("");
  const [forbiddenShop, setForbiddenShop] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const [aiModel, setAiModel] = useState<ImageModel>("gpt-image-1.5");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("medium");

  const [previews, setPreviews] = useState<Record<ImageSlot, string | null>>({
    image1: null,
    image2: null,
    image3: null,
  });

  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach(URL.revokeObjectURL);
  }, []);

  function handlePreview(slot: ImageSlot, file?: File) {
    if (!file) return;

    const url = URL.createObjectURL(file);
    previewUrls.current.add(url);

    setPreviews((previous) => {
      const oldUrl = previous[slot];
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
        previewUrls.current.delete(oldUrl);
      }

      return { ...previous, [slot]: url };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setResult(null);
    setErrorMessage(null);

    const form = e.currentTarget;

    const image1 = (form.elements.namedItem("image1") as HTMLInputElement)
      .files?.[0];

    const image2 = (form.elements.namedItem("image2") as HTMLInputElement)
      .files?.[0];

    const image3 = (form.elements.namedItem("image3") as HTMLInputElement)
      .files?.[0];

    if (!targetShop.trim()) {
      setErrorMessage("กรุณากรอกชื่อร้านของเรา");
      setLoading(false);
      return;
    }

    if (!referenceShop.trim()) {
      setErrorMessage("กรุณากรอกร้านอ้างอิง Layout");
      setLoading(false);
      return;
    }

    if (!forbiddenShop.trim()) {
      setErrorMessage("กรุณากรอกร้านที่ห้ามใช้ UI");
      setLoading(false);
      return;
    }

    if (!image1 || !image2 || !image3) {
      setErrorMessage("กรุณาอัปโหลดภาพให้ครบ 3 ภาพ");
      setLoading(false);
      return;
    }

    try {
      const referenceMaxSize = imageQuality === "low" ? 384 : 768;
      const [img1, img2, img3] = await Promise.all([
        compressImage(image1, referenceMaxSize),
        compressImage(image2, referenceMaxSize),
        compressImage(image3, referenceMaxSize),
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
      formData.append("aiModel", aiModel);
      formData.append("imageQuality", imageQuality);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.image) {
        setResult(data.image);
        setEditInstruction("");
        setErrorMessage(null);
      } else {
        setErrorMessage(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!result) {
      setErrorMessage("ยังไม่มีภาพให้แก้ไข");
      return;
    }

    if (!editInstruction.trim()) {
      setErrorMessage("กรุณาพิมพ์คำสั่งที่ต้องการแก้ไข");
      return;
    }

    setRefining(true);
    setErrorMessage(null);

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
      formData.append("aiModel", aiModel);
      formData.append("imageQuality", imageQuality);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.image) {
        setResult(data.image);
        setEditInstruction("");
        setErrorMessage(null);
      } else {
        setErrorMessage(data.error || "แก้ไขภาพไม่สำเร็จ");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("เกิดข้อผิดพลาดระหว่างแก้ไขภาพ");
    } finally {
      setRefining(false);
    }
  }

  const busy = loading || refining;
  const previewAspectClass: Record<AspectRatio, string> = {
    "1:1": "aspect-square",
    "3:4": "aspect-[3/4]",
    "4:5": "aspect-[4/5]",
    "9:16": "aspect-[9/16]",
    "4:3": "aspect-[4/3]",
    "16:9": "aspect-video",
  };

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

        {errorMessage && (
          <StatusMessage tone="error" title="ดำเนินการไม่สำเร็จ" className="mb-6">
            {errorMessage}
          </StatusMessage>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            method="post"
            encType="multipart/form-data"
            aria-busy={loading}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl sm:p-6"
          >
            <h2 className="mb-5 text-xl font-bold">ตั้งค่าภาพโปรโมท</h2>

            <div className="grid gap-4">
              <FileUpload
                label="ภาพที่ 1"
                description="Background / Main Visual"
                name="image1"
                previewUrl={previews.image1}
                required
                disabled={busy}
                maxSizeBytes={25 * 1024 * 1024}
                onRejected={setErrorMessage}
                onFileChange={(file) => handlePreview("image1", file)}
              />

              <FileUpload
                label="ภาพที่ 2"
                description="ราคาแพ็ค + รูปไอเทม"
                name="image2"
                previewUrl={previews.image2}
                required
                disabled={busy}
                maxSizeBytes={25 * 1024 * 1024}
                onRejected={setErrorMessage}
                onFileChange={(file) => handlePreview("image2", file)}
              />

              <FileUpload
                label="ภาพที่ 3"
                description="Layout / CI / UI Reference"
                name="image3"
                previewUrl={previews.image3}
                required
                disabled={busy}
                maxSizeBytes={25 * 1024 * 1024}
                onRejected={setErrorMessage}
                onFileChange={(file) => handlePreview("image3", file)}
              />
            </div>

            <div className="mt-6 space-y-4">
              <TextField
                name="targetShop"
                label="ชื่อร้านของเรา"
                placeholder="เช่น SUPERSIX"
                value={targetShop}
                required
                disabled={busy}
                onChange={(event) => setTargetShop(event.target.value)}
              />

              <TextField
                name="referenceShop"
                label="ร้านอ้างอิง Layout"
                placeholder="เช่น FATCAT STORE"
                value={referenceShop}
                required
                disabled={busy}
                onChange={(event) => setReferenceShop(event.target.value)}
              />

              <TextField
                name="forbiddenShop"
                label="ร้านที่ห้ามใช้ UI"
                placeholder="เช่น FATCAT STORE"
                value={forbiddenShop}
                required
                disabled={busy}
                onChange={(event) => setForbiddenShop(event.target.value)}
              />

              <RadioGroup
                name="aspectRatio"
                label="ขนาดภาพ"
                value={aspectRatio}
                options={IMAGE_SIZE_OPTIONS}
                required
                disabled={busy}
                onValueChange={setAspectRatio}
              />

              <SelectField
                name="aiModel"
                label="AI model"
                value={aiModel}
                options={AI_MODEL_OPTIONS}
                required
                disabled={busy}
                onValueChange={setAiModel}
              />

              <SelectField
                name="imageQuality"
                label="Image quality"
                value={imageQuality}
                options={IMAGE_QUALITY_OPTIONS}
                required
                disabled={busy}
                onValueChange={setImageQuality}
              />
            </div>

            <Button
              type="submit"
              loading={loading}
              loadingLabel="AI กำลังสร้างภาพ..."
              disabled={busy}
              fullWidth
              className="mt-6"
            >
              Generate Poster
            </Button>

            {loading && (
              <StatusMessage tone="loading" className="mt-4">
                กำลังประมวลผลภาพ อาจใช้เวลาประมาณ 30–90 วินาที กรุณาอย่าปิดหน้านี้
              </StatusMessage>
            )}
          </form>

          <section
            aria-labelledby="result-heading"
            aria-busy={busy}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id="result-heading" className="text-xl font-bold">ผลลัพธ์</h2>

              {result && (
                <a
                  href={result}
                  download="game-promo.png"
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Download
                </a>
              )}
            </div>

            <div
              className={`relative flex ${previewAspectClass[aspectRatio]} items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40`}
            >
              {result ? (
                <Image
                  src={result}
                  alt="Generated promo"
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain"
                />
              ) : loading ? (
                <div className="px-4 text-center sm:px-8" role="status" aria-live="polite">
                  <Spinner className="mb-5 h-14 w-14 border-4" />

                  <p className="text-lg font-bold text-white">
                    AI กำลังสร้างภาพ
                  </p>

                  <p className="mt-2 text-sm text-white/40">
                    กำลังจัดวาง layout, item, ราคา และ UI ตามภาพอ้างอิง
                  </p>
                </div>
              ) : (
                <div className="px-4 text-center text-white/40 sm:px-8">
                  <div className="mb-4 text-5xl" aria-hidden="true">🎮</div>
                  <p>ภาพที่สร้างจะปรากฏตรงนี้</p>
                </div>
              )}
            </div>

            {result && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <TextareaField
                  label="แก้ไขภาพนี้เพิ่มเติม"
                  hint="พิมพ์สิ่งที่อยากให้ AI ปรับจากภาพผลลัพธ์ล่าสุด"
                  value={editInstruction}
                  onChange={(event) => setEditInstruction(event.target.value)}
                  disabled={busy}
                  rows={4}
                  placeholder="เช่น ทำแพ็คราคาให้เข้ากับ CI ร้านมากขึ้น, เพิ่มราคาตัวใหญ่ขึ้น, ลดความรก, เปลี่ยนโทนเป็นทองดำ"
                  className="resize-none text-sm"
                />

                <Button
                  variant="success"
                  loading={refining}
                  loadingLabel="AI กำลังแก้ไขภาพ..."
                  disabled={busy || !editInstruction.trim()}
                  onClick={handleRefine}
                  fullWidth
                  className="mt-3"
                >
                  แก้ไขภาพนี้
                </Button>

                {refining && (
                  <StatusMessage tone="success" className="mt-4">
                    กำลังส่งภาพผลลัพธ์เดิมกลับไปให้ AI ปรับแก้ตามคำสั่งของคุณ
                  </StatusMessage>
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
