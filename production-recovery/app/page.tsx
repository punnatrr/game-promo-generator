"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MAX_HISTORY_ITEMS } from "./constants";
import { clearStoredHistory, readHistory, writeHistory } from "./lib/history-storage";
import { compressImage, dataUrlToFile } from "./lib/image-files";
import type {
  AiModel,
  HistoryItem,
  ImageQuality,
  ImageSizeValue,
  ImageSlot,
  ResultCount,
} from "./types";


const IMAGE_SIZE_OPTIONS: Array<{
  value: ImageSizeValue;
  label: string;
  ratio: string;
}> = [
  { value: "1:1", label: "Facebook / Instagram Feed - จัตุรัส", ratio: "1:1" },
  { value: "3:4", label: "Marketplace / โพสต์ขาย - แนวตั้ง", ratio: "3:4" },
  { value: "4:5", label: "Facebook / Instagram Feed - แนวตั้ง", ratio: "4:5" },
  { value: "9:16", label: "Story / Reels / TikTok - แนวตั้ง", ratio: "9:16" },
  { value: "4:3", label: "Facebook / Website Post - แนวนอน", ratio: "4:3" },
  { value: "16:9", label: "YouTube / Website Banner - แนวนอน", ratio: "16:9" },
];

const RESULT_COUNT_OPTIONS: ResultCount[] = [1, 2, 3, 4, 5];

type MemberState = {
  user: {
    email: string;
    displayName: string | null;
    role: "user" | "admin";
  } | null;
  subscription: {
    status: string;
    usedImagesThisPeriod: number;
    remainingImages: number;
    currentPeriodEnd: string;
    plan: {
      name: string;
      monthlyImageLimit: number;
      hasSpecialFeatures: boolean;
      hasVipSupport: boolean;
    };
  } | null;
  databaseConfigured: boolean;
};

export default function Page() {
  const [result, setResult] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>(readHistory);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [memberState, setMemberState] = useState<MemberState | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);

  const [editInstruction, setEditInstruction] = useState("");

  const [targetShop, setTargetShop] = useState("");
  const [referenceShop, setReferenceShop] = useState("");
  const [aspectRatio, setAspectRatio] = useState<ImageSizeValue>("3:4");
  const [aiModel, setAiModel] = useState<AiModel>("gpt-image-1");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("medium");
  const [resultCount, setResultCount] = useState<ResultCount>(1);

  const [previews, setPreviews] = useState<Record<ImageSlot, string | null>>({
    image1: null,
    image2: null,
    image3: null,
  });
  const previewUrlsRef = useRef<Record<ImageSlot, string | null>>({
    image1: null,
    image2: null,
    image3: null,
  });

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;

    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMemberState() {
      try {
        const res = await fetch("/api/subscription/me");
        const data = await res.json();
        if (active) setMemberState(data);
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setMemberLoading(false);
      }
    }

    loadMemberState();

    return () => {
      active = false;
    };
  }, []);

  function persistHistory(nextHistory: HistoryItem[]) {
    setHistory(writeHistory(nextHistory));
  }

  function saveToHistory(images: string[]) {
    if (images.length === 0) return;

    const timestamp = new Date().toISOString();
    const newItems = images.map((image, index) => ({
      id: `${Date.now()}-${index}`,
      image,
      shop: targetShop.trim() || "Untitled",
      aspectRatio,
      createdAt: timestamp,
    }));

    persistHistory([...newItems, ...history]);
  }

  function selectHistoryItem(item: HistoryItem) {
    setResult(item.image);
    setResults([item.image]);
    setSelectedResultIndex(0);
    setAspectRatio(item.aspectRatio);
    if (item.shop !== "Untitled") {
      setTargetShop(item.shop);
    }
    setEditInstruction("");
  }

  function deleteHistoryItem(id: string) {
    persistHistory(history.filter((item) => item.id !== id));
  }

  function clearHistory() {
    clearStoredHistory();
    setHistory([]);
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
      });
    } finally {
      setMemberState((prev) =>
        prev ? { ...prev, user: null, subscription: null } : prev
      );
    }
  }

  function handlePreview(slot: ImageSlot, file?: File) {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const previousUrl = previewUrlsRef.current[slot];
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    previewUrlsRef.current[slot] = url;

    setPreviews((prev) => ({
      ...prev,
      [slot]: url,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setResult(null);
    setResults([]);
    setSelectedResultIndex(0);

    const form = e.currentTarget;

    const image1 = (form.elements.namedItem("image1") as HTMLInputElement)
      .files?.[0];

    const image2 = (form.elements.namedItem("image2") as HTMLInputElement)
      .files?.[0];

    const image3 = (form.elements.namedItem("image3") as HTMLInputElement)
      .files?.[0];

    if (!targetShop.trim()) {
      alert("กรุณากรอกชื่อร้านของเรา");
      setLoading(false);
      return;
    }

    if (!referenceShop.trim()) {
      alert("กรุณากรอกร้านอ้างอิง Layout");
      setLoading(false);
      return;
    }

    if (!image1 || !image2 || !image3) {
      alert("กรุณาอัปโหลดภาพให้ครบ 3 ภาพ");
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
      formData.append("aspectRatio", aspectRatio);
      formData.append("aiModel", aiModel);
      formData.append("imageQuality", imageQuality);
      formData.append("outputCount", String(resultCount));

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      const generatedImages =
        Array.isArray(data.images) && data.images.length > 0
          ? data.images
          : data.image
            ? [data.image]
            : [];

      if (generatedImages.length > 0) {
        setResults(generatedImages);
        setResult(generatedImages[0]);
        setSelectedResultIndex(0);
        setEditInstruction("");
        saveToHistory(generatedImages);

        if (data.warning) {
          alert(data.warning);
        }
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
      formData.append("aspectRatio", aspectRatio);
      formData.append("aiModel", aiModel);
      formData.append("imageQuality", imageQuality);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.image) {
        setResults([data.image]);
        setResult(data.image);
        setSelectedResultIndex(0);
        setEditInstruction("");
        saveToHistory([data.image]);

        if (data.warning) {
          alert(data.warning);
        }
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
  const previewAspectClass: Record<ImageSizeValue, string> = {
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
        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-400 font-black text-black">
                LA
              </span>
              <span>
                <span className="block text-lg font-black text-purple-300">
                  LAZY-AI.GAME
                </span>
                <span className="block text-xs text-white/40">
                  Member promo generator
                </span>
              </span>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/pricing"
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                แพ็กเกจ
              </a>
              <a
                href="/dashboard/history"
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                ประวัติภาพ
              </a>
              <a
                href="/dashboard"
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Dashboard
              </a>

              {memberState?.user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-purple-200"
                >
                  ออกจากระบบ
                </button>
              ) : (
                <>
                  <a
                    href="/sign-in"
                    className="rounded-2xl bg-purple-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-purple-300"
                  >
                    เข้าสู่ระบบ
                  </a>
                  <a
                    href="/sign-up"
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-purple-200"
                  >
                    สมัครสมาชิก
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {memberLoading ? (
              <MemberInfoCard
                label="Member"
                value="กำลังโหลด..."
                detail="ตรวจสอบสถานะบัญชี"
              />
            ) : !memberState?.databaseConfigured ? (
              <MemberInfoCard
                label="Member system"
                value="กำลังเตรียมเปิด"
                detail="หน้าแพ็กเกจและบัญชีพร้อมแล้ว เหลือเชื่อมฐานข้อมูล production"
              />
            ) : memberState.user ? (
              <MemberInfoCard
                label="บัญชี"
                value={memberState.user.displayName || memberState.user.email}
                detail={memberState.user.role === "admin" ? "Admin" : "Member"}
              />
            ) : (
              <MemberInfoCard
                label="บัญชี"
                value="ยังไม่ได้เข้าสู่ระบบ"
                detail="เข้าสู่ระบบเพื่อใช้แพ็กเกจและเก็บประวัติภาพ"
              />
            )}

            <MemberInfoCard
              label="แพ็กเกจ"
              value={memberState?.subscription?.plan.name || "ยังไม่มีแพ็กเกจ"}
              detail={
                memberState?.subscription
                  ? `${memberState.subscription.usedImagesThisPeriod}/${memberState.subscription.plan.monthlyImageLimit} รูปในรอบนี้`
                  : "เลือก Basic, Pro หรือ Business เพื่อเปิดสิทธิ์ใช้งาน"
              }
            />

            <MemberInfoCard
              label="โควตาคงเหลือ"
              value={
                memberState?.subscription
                  ? `${memberState.subscription.remainingImages} รูป`
                  : "-"
              }
              detail={
                memberState?.subscription
                  ? `หมดรอบ ${new Date(
                      memberState.subscription.currentPeriodEnd
                    ).toLocaleDateString("th-TH")}`
                  : "ระบบจะนับเมื่อมี subscription active"
              }
            />
          </div>
        </div>

        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            AI Game Promotion Poster Generator
          </div>

          <h1 className="text-4xl font-black tracking-tight text-purple-400 md:text-5xl">
            LAZY-AI.GAME
          </h1>

          <p className="mt-4 text-white/50">
            อัปโหลด 3 ภาพ แล้วให้ AI สร้างโพสต์โปรโมทไอเทมเกมแบบมืออาชีพ
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            noValidate
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
                desc="Price + item only / no UI"
                name="image2"
                preview={previews.image2}
                onChange={(file) => handlePreview("image2", file)}
              />

              <UploadBox
                title="ภาพที่ 3"
                desc="Layout only / no price or item data"
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

              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-white/60">
                  ขนาดภาพ
                </legend>

                <div className="grid gap-2">
                  {IMAGE_SIZE_OPTIONS.map((option) => {
                    const selected = aspectRatio === option.value;

                    return (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-white/[0.06]"
                      >
                        <input
                          type="radio"
                          name="aspectRatio"
                          value={option.value}
                          checked={selected}
                          onChange={() => setAspectRatio(option.value)}
                          className="sr-only"
                        />
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selected
                              ? "border-white bg-white"
                              : "border-white/50 bg-black/20"
                          }`}
                          aria-hidden="true"
                        >
                          {selected && (
                            <span className="h-2 w-2 rounded-sm bg-black" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 font-medium leading-snug text-white/85">
                          {option.label}
                        </span>
                        <span className="shrink-0 text-white/40">{option.ratio}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/60">
                  AI model
                </span>

                <select
                  name="aiModel"
                  required
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value as AiModel)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/40"
                >
                  <option value="gpt-image-1">
                    GPT Image 1 - stable default
                  </option>
                  <option value="gpt-image-1.5">
                    GPT Image 1.5 - faster / higher fidelity
                  </option>
                  <option value="gpt-image-2">
                    GPT Image 2 — highest quality
                  </option>
                  <option value="gemini-3-pro-image-preview">
                    Gemini 3 Pro Image — old provider
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/60">
                  Image quality
                </span>

                <select
                  name="imageQuality"
                  required
                  value={imageQuality}
                  onChange={(e) => setImageQuality(e.target.value as ImageQuality)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/40"
                >
                  <option value="low">Low — cheapest draft</option>
                  <option value="medium">Medium — recommended</option>
                  <option value="high">High — final artwork</option>
                </select>
              </label>

              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-white/60">
                  Results
                </legend>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {RESULT_COUNT_OPTIONS.map((count) => {
                    const selected = resultCount === count;

                    return (
                      <label
                        key={count}
                        className={`cursor-pointer rounded-2xl border px-4 py-3 text-center text-sm font-bold transition ${
                          selected
                            ? "border-purple-300 bg-purple-400 text-black"
                            : "border-white/10 bg-black/40 text-white/70 hover:border-white/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="outputCount"
                          value={count}
                          checked={selected}
                          onChange={() => setResultCount(count)}
                          className="sr-only"
                        />
                        {count}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-4 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}

              {loading
                ? `AI กำลังสร้าง ${resultCount} ภาพ...`
                : "Generate Poster"}
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

            {results.length > 1 && (
              <div className="mb-5 grid grid-cols-3 gap-3">
                {results.map((image, index) => {
                  const selected = selectedResultIndex === index;

                  return (
                    <button
                      type="button"
                      key={`${image.slice(0, 48)}-${index}`}
                      onClick={() => {
                        setSelectedResultIndex(index);
                        setResult(image);
                      }}
                      className={`overflow-hidden rounded-xl border bg-black/40 transition ${
                        selected
                          ? "border-purple-300 ring-2 ring-purple-300/40"
                          : "border-white/10 hover:border-white/30"
                      }`}
                      aria-label={`Select result ${index + 1}`}
                    >
                      <img
                        src={image}
                        alt={`Generated promo option ${index + 1}`}
                        className="aspect-video h-20 w-full object-cover"
                      />
                      <span className="block px-2 py-1 text-xs font-bold text-white/70">
                        Option {index + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div
              className={`flex ${previewAspectClass[aspectRatio]} items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40`}
            >
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">ประวัติภาพ</h3>
                  <p className="mt-1 text-sm text-white/40">
                    เก็บล่าสุด {MAX_HISTORY_ITEMS} ภาพในเครื่องนี้
                  </p>
                </div>

                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/60 transition hover:border-red-300/50 hover:text-red-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              {history.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {history.map((item, index) => (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-black/40"
                    >
                      <button
                        type="button"
                        onClick={() => selectHistoryItem(item)}
                        className="block w-full text-left"
                        aria-label={`Open history image ${index + 1}`}
                      >
                        <img
                          src={item.image}
                          alt={`History image ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                        <span className="block truncate px-2 pt-2 text-xs font-bold text-white/80">
                          {item.shop}
                        </span>
                        <span className="block px-2 pb-2 text-xs text-white/35">
                          {item.aspectRatio}
                        </span>
                      </button>

                      <div className="flex border-t border-white/10">
                        <a
                          href={item.image}
                          download={`lazyai-game-${index + 1}.png`}
                          className="flex-1 px-2 py-2 text-center text-xs font-bold text-emerald-300 transition hover:bg-white/[0.06]"
                        >
                          Download
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteHistoryItem(item.id)}
                          className="flex-1 border-l border-white/10 px-2 py-2 text-xs font-bold text-white/45 transition hover:bg-white/[0.06] hover:text-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/35">
                  ภาพที่ generate แล้วจะมาอยู่ตรงนี้
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-white/40"
      />
    </label>
  );
}

function MemberInfoCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs font-bold uppercase text-purple-200/70">{label}</p>
      <p className="mt-2 truncate text-lg font-black text-white">{value}</p>
      <p className="mt-1 min-h-10 text-sm leading-5 text-white/40">{detail}</p>
    </div>
  );
}
