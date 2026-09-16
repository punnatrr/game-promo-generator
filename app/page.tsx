"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "./components/ui/button";
import { FileUpload } from "./components/ui/file-upload";
import { RadioGroup } from "./components/ui/radio-group";
import { SelectField } from "./components/ui/select-field";
import { Spinner } from "./components/ui/spinner";
import { StatusMessage } from "./components/ui/status-message";
import { TextareaField } from "./components/ui/textarea-field";
import { TextField } from "./components/ui/text-field";
import { VipSupportLauncher } from "./components/support/vip-support-launcher";

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
  SpecialFeatureStyle,
} from "./types";


const IMAGE_SIZE_OPTIONS: Array<{
  value: ImageSizeValue;
  label: string;
  description: string;
}> = [
  { value: "1:1", label: "Facebook / Instagram Feed - จัตุรัส", description: "1:1" },
  { value: "3:4", label: "Marketplace / โพสต์ขาย - แนวตั้ง", description: "3:4" },
  { value: "4:5", label: "Facebook / Instagram Feed - แนวตั้ง", description: "4:5" },
  { value: "9:16", label: "Story / Reels / TikTok - แนวตั้ง", description: "9:16" },
  { value: "4:3", label: "Facebook / Website Post - แนวนอน", description: "4:3" },
  { value: "16:9", label: "YouTube / Website Banner - แนวนอน", description: "16:9" },
];

const RESULT_COUNT_OPTIONS: Array<{ value: ResultCount; label: string }> = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const AI_MODEL_OPTIONS: Array<{ value: AiModel; label: string }> = [
  { value: "gpt-image-1.5", label: "GPT Image 1.5 — โทนเดิม" },
  { value: "gpt-image-2", label: "GPT Image 2" },
  { value: "gpt-image-3", label: "GPT Image 3" },
];

const IMAGE_QUALITY_OPTIONS: Array<{ value: ImageQuality; label: string }> = [
  { value: "low", label: "ประหยัด — สำหรับภาพร่าง" },
  { value: "medium", label: "มาตรฐาน — แนะนำ" },
  { value: "high", label: "คุณภาพสูง — งานพร้อมใช้" },
];

const SPECIAL_FEATURE_STYLE_OPTIONS: Array<{
  value: SpecialFeatureStyle;
  label: string;
  description: string;
}> = [
  {
    value: "full-brand",
    label: "คงแบรนด์เดิมสูงสุด",
    description: "รักษาสี โลโก้ กรอบราคา แถบโปรโมท และช่องติดต่อให้เหมือนร้านเดิม",
  },
  {
    value: "brand-colors",
    label: "รักษาสีหลักของร้าน",
    description: "คงโทนสีหลัก สีรอง แสง เงา และบรรยากาศแบรนด์จากภาพอ้างอิง",
  },
  {
    value: "brand-layout",
    label: "รักษาองค์ประกอบ",
    description: "คงกรอบราคา แถบโปรโมท เลย์เอาต์แพ็ก และช่องทางติดต่อด้านล่าง",
  },
  {
    value: "logo-qr",
    label: "รักษาโลโก้และ QR",
    description: "คงรายละเอียดโลโก้ และทำให้ QR Code คมชัด ไม่บิดเบี้ยว ใช้งานได้",
  },
];

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
  isAdmin: boolean;
};

const MEMBER_STATE_FALLBACK: MemberState = {
  user: null,
  subscription: null,
  databaseConfigured: true,
  isAdmin: false,
};

type DailyImageSlot = Extract<ImageSlot, "image1" | "image2">;

type DailyImageItem = {
  id: string;
  gameName: string;
  gameTag: string;
  imageSlot: DailyImageSlot;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
};

const DAILY_IMAGE_SLOT_LABELS: Record<DailyImageSlot, string> = {
  image1: "ภาพที่ 1 / ภาพพื้นหลัง",
  image2: "ภาพที่ 2 / ราคาและสินค้า",
};

const WEBSITE_GUIDE_STEPS = [
  {
    title: "เลือกรูปหรืออัปโหลดภาพหลักของกิจกรรม",
    description:
      "เลือกจากรูปรายวันของ LAZYPRO หรืออัปโหลดภาพกิจกรรมที่ต้องการใช้เป็นภาพหลัก",
    image: "/website-guide/step-1-main-image.png",
    imageAlt: "หน้าต่างเลือกรูปหลักของกิจกรรมจากรูปรายวัน",
  },
  {
    title: "เลือกรูปหรืออัปโหลดภาพไอเทมและราคา",
    description:
      "เลือกภาพที่มีรายละเอียดไอเทมและราคาชัดเจน เพื่อให้ AI นำข้อมูลไปจัดวางในภาพโปรโมท",
    image: "/website-guide/step-2-items-price.png",
    imageAlt: "หน้าต่างเลือกรูปไอเทมและราคาจากรูปรายวัน",
  },
  {
    title: "อัปโหลดภาพสไตล์ร้านของคุณ",
    description:
      "ใช้ภาพตัวอย่างที่บ่งบอกโทนสี องค์ประกอบ และสไตล์ประจำร้าน โดยไม่จำเป็นต้องมีราคาหรือข้อมูลสินค้า",
    visual: "style-upload",
  },
  {
    title: "ใส่ชื่อร้าน",
    description:
      "กรอกชื่อร้านที่ต้องการให้ปรากฏในภาพโปรโมท และตรวจสอบตัวสะกดให้ถูกต้อง",
    image: "/website-guide/step-4-shop-name.png",
    imageAlt: "ช่องกรอกชื่อร้านของเรา",
  },
  {
    title: "เลือกขนาดภาพโพสต์",
    description:
      "เลือกอัตราส่วนให้เหมาะกับแพลตฟอร์มที่ต้องการ เช่น Facebook, Instagram, Marketplace, Story หรือ YouTube",
    image: "/website-guide/step-5-post-size.png",
    imageAlt: "ตัวเลือกขนาดภาพสำหรับแพลตฟอร์มต่าง ๆ",
  },
  {
    title: "เลือกโมเดล AI หรือใช้ค่าเริ่มต้น",
    description:
      "ข้ามขั้นตอนนี้ได้ เพราะค่าเริ่มต้นที่เว็บไซต์เลือกไว้เป็นค่าที่แนะนำและเหมาะกับการใช้งานทั่วไป",
    image: "/website-guide/step-6-ai-model.png",
    imageAlt: "ตัวเลือกโมเดล AI และคุณภาพภาพ",
  },
  {
    title: "เลือกจำนวนผลลัพธ์",
    description:
      "เลือกว่าต้องการให้ AI สร้างกี่ภาพในครั้งเดียว ตั้งแต่ 1 ถึง 5 ภาพตามโควตาที่มี",
    visual: "result-count",
  },
  {
    title: "กดสร้างแล้วรอดูผลลัพธ์",
    description:
      "กดปุ่มสร้างภาพโปรโมท รอ AI ประมวลผล แล้วเลือกดู ดาวน์โหลด หรือสั่งปรับแก้ภาพที่ต้องการได้ทันที",
    visual: "generate-result",
  },
] as const;

type WebsiteGuideStep = (typeof WEBSITE_GUIDE_STEPS)[number];

export default function Page() {
  const [result, setResult] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [memberState, setMemberState] = useState<MemberState | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    tone: "info" | "error";
    text: string;
    retryable?: boolean;
  } | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<
    "generate" | "refine" | null
  >(null);

  const [editInstruction, setEditInstruction] = useState("");

  const [targetShop, setTargetShop] = useState("");
  const [aspectRatio, setAspectRatio] = useState<ImageSizeValue>("3:4");
  const [aiModel, setAiModel] = useState<AiModel>("gpt-image-1.5");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("medium");
  const [resultCount, setResultCount] = useState<ResultCount>(1);
  const [specialFeatureEnabled, setSpecialFeatureEnabled] = useState(false);
  const [specialFeatureStyles, setSpecialFeatureStyles] = useState<
    SpecialFeatureStyle[]
  >(["full-brand"]);
  const [specialFeatureNote, setSpecialFeatureNote] = useState("");
  const [dailyImages, setDailyImages] = useState<DailyImageItem[]>([]);
  const [dailyImagesLoading, setDailyImagesLoading] = useState(false);
  const [dailyImagesLoaded, setDailyImagesLoaded] = useState(false);
  const [dailyPickerSlot, setDailyPickerSlot] =
    useState<DailyImageSlot | null>(null);
  const [dailyPickerGameSearch, setDailyPickerGameSearch] = useState("");
  const [websiteGuideOpen, setWebsiteGuideOpen] = useState(false);
  const [websiteGuideStep, setWebsiteGuideStep] = useState(0);
  const [vipSupportDraft, setVipSupportDraft] = useState<{
    id: number;
    imageUrls: string[];
  } | null>(null);
  const [selectedDailyFiles, setSelectedDailyFiles] = useState<
    Partial<Record<DailyImageSlot, File>>
  >({});
  const websiteGuideButtonRef = useRef<HTMLButtonElement>(null);
  const websiteGuideTouchStartXRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    const frame = window.requestAnimationFrame(() => {
      setHistory(readHistory());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMemberState() {
      try {
        const res = await fetch("/api/subscription/me", { cache: "no-store" });
        const responseText = await res.text();

        if (!responseText) {
          throw new Error(`โหลดข้อมูลสมาชิกไม่สำเร็จ (${res.status})`);
        }

        const data = JSON.parse(responseText) as MemberState & { error?: string };

        if (!res.ok) {
          throw new Error(data.error || `โหลดข้อมูลสมาชิกไม่สำเร็จ (${res.status})`);
        }

        if (active) setMemberState(data);
      } catch (error) {
        console.warn(
          "load member state failed:",
          error instanceof Error ? error.message : error,
        );
        if (active) setMemberState(MEMBER_STATE_FALLBACK);
      } finally {
        if (active) setMemberLoading(false);
      }
    }

    loadMemberState();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!websiteGuideOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWebsiteGuideOpen(false);
        window.requestAnimationFrame(() => websiteGuideButtonRef.current?.focus());
      } else if (event.key === "ArrowRight") {
        setWebsiteGuideStep((current) =>
          Math.min(current + 1, WEBSITE_GUIDE_STEPS.length - 1)
        );
      } else if (event.key === "ArrowLeft") {
        setWebsiteGuideStep((current) => Math.max(current - 1, 0));
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [websiteGuideOpen]);

  function closeWebsiteGuide() {
    setWebsiteGuideOpen(false);
    window.requestAnimationFrame(() => websiteGuideButtonRef.current?.focus());
  }

  function openWebsiteGuide() {
    setWebsiteGuideStep(0);
    setWebsiteGuideOpen(true);
  }

  function showPreviousWebsiteGuideStep() {
    setWebsiteGuideStep((current) => Math.max(current - 1, 0));
  }

  function showNextWebsiteGuideStep() {
    if (websiteGuideStep === WEBSITE_GUIDE_STEPS.length - 1) {
      closeWebsiteGuide();
      return;
    }

    setWebsiteGuideStep((current) => current + 1);
  }

  function toggleSpecialFeatureStyle(style: SpecialFeatureStyle) {
    setSpecialFeatureStyles((currentStyles) => {
      if (!currentStyles.includes(style)) {
        return [...currentStyles, style];
      }

      if (currentStyles.length === 1) {
        return currentStyles;
      }

      return currentStyles.filter((currentStyle) => currentStyle !== style);
    });
  }

  function handleWebsiteGuideTouchEnd(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    const touchStartX = websiteGuideTouchStartXRef.current;
    websiteGuideTouchStartXRef.current = null;
    if (touchStartX === null) return;

    const distance = touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(distance) < 50) return;

    setWebsiteGuideStep((current) =>
      distance > 0
        ? Math.min(current + 1, WEBSITE_GUIDE_STEPS.length - 1)
        : Math.max(current - 1, 0)
    );
  }

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

  function handleFileUploadChange(slot: ImageSlot, file?: File) {
    if (slot === "image1" || slot === "image2") {
      setSelectedDailyFiles((prev) => ({
        ...prev,
        [slot]: undefined,
      }));
    }

    handlePreview(slot, file);
  }

  async function loadDailyImages() {
    setDailyImagesLoading(true);

    try {
      const res = await fetch("/api/daily-images");
      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          tone: "error",
          text: data.error || "โหลดรูปรายวันไม่สำเร็จ",
        });
        setDailyImages([]);
        return;
      }

      setDailyImages(data.images || []);
      setDailyImagesLoaded(true);
    } catch (error) {
      console.error(error);
      setFeedback({ tone: "error", text: "โหลดรูปรายวันไม่สำเร็จ" });
      setDailyImages([]);
    } finally {
      setDailyImagesLoading(false);
    }
  }

  function openDailyImagePicker(slot: DailyImageSlot) {
    if (!canUseSpecialFeatures) {
      setFeedback({
        tone: "error",
        text: "รูปรายวันเป็นฟีเจอร์ LAZYPRO สำหรับแพ็กเกจ 499/999 เท่านั้น",
      });
      return;
    }

    setDailyPickerSlot(slot);
    setDailyPickerGameSearch("");

    if (!dailyImagesLoaded) {
      loadDailyImages();
    }
  }

  async function selectDailyImage(image: DailyImageItem) {
    try {
      const file = await dataUrlToFile(
        image.imageUrl,
        `daily-${image.gameName}-${image.imageSlot}.png`
      );
      const previousUrl = previewUrlsRef.current[image.imageSlot];
      if (previousUrl) URL.revokeObjectURL(previousUrl);

      previewUrlsRef.current[image.imageSlot] = null;
      setSelectedDailyFiles((prev) => ({
        ...prev,
        [image.imageSlot]: file,
      }));
      setPreviews((prev) => ({
        ...prev,
        [image.imageSlot]: image.imageUrl,
      }));
      setDailyPickerSlot(null);
      setFeedback({
        tone: "info",
        text: `เลือก ${DAILY_IMAGE_SLOT_LABELS[image.imageSlot]} จากรูปรายวันแล้ว`,
      });
    } catch (error) {
      console.error(error);
      setFeedback({ tone: "error", text: "เลือกรูปรายวันไม่สำเร็จ" });
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setResult(null);
    setResults([]);
    setSelectedResultIndex(0);
    setFeedback(null);
    setLastFailedAction(null);

    const form = e.currentTarget;

    const image1 =
      selectedDailyFiles.image1 ||
      (form.elements.namedItem("image1") as HTMLInputElement).files?.[0];

    const image2 =
      selectedDailyFiles.image2 ||
      (form.elements.namedItem("image2") as HTMLInputElement).files?.[0];

    const image3 = (form.elements.namedItem("image3") as HTMLInputElement)
      .files?.[0];

    if (!targetShop.trim()) {
      setFeedback({ tone: "error", text: "กรุณากรอกชื่อร้านของเรา" });
      setLoading(false);
      return;
    }

    if (!image1 || !image2 || !image3) {
      setFeedback({ tone: "error", text: "กรุณาอัปโหลดภาพให้ครบ 3 ภาพ" });
      setLoading(false);
      return;
    }

    try {
      const referenceMaxSize = imageQuality === "low" ? 384 : 768;
      const [img1, img2, img3] = await Promise.all([
        compressImage(image1, referenceMaxSize),
        compressImage(image2, 1536, 0.85),
        compressImage(image3, referenceMaxSize),
      ]);

      const formData = new FormData();

      formData.append("mode", "generate");

      formData.append("image1", img1);
      formData.append("image2", img2);
      formData.append("image3", img3);

      formData.append("targetShop", targetShop);
      formData.append("aspectRatio", aspectRatio);
      formData.append("aiModel", aiModel);
      formData.append("imageQuality", imageQuality);
      formData.append("outputCount", String(resultCount));
      if (specialFeatureEnabled && canUseSpecialFeatures) {
        formData.append("specialFeatureEnabled", "true");
        specialFeatureStyles.forEach((style) => {
          formData.append("specialFeatureStyle", style);
        });
        formData.append("specialFeatureNote", specialFeatureNote.trim());
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

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

        setFeedback(
          data.warning ? { tone: "info", text: data.warning } : null
        );
      } else {
        setLastFailedAction("generate");
        setFeedback({
          tone: "error",
          text: data.error || `สร้างภาพไม่สำเร็จ (HTTP ${res.status})`,
          retryable: res.status >= 429,
        });
      }
    } catch (error) {
      console.error(error);
      setLastFailedAction("generate");
      setFeedback({
        tone: "error",
        text: "เชื่อมต่อระบบสร้างภาพไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่",
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!result) {
      setFeedback({ tone: "error", text: "ยังไม่มีภาพให้แก้ไข" });
      return;
    }

    if (!editInstruction.trim()) {
      setFeedback({ tone: "error", text: "กรุณาพิมพ์คำสั่งที่ต้องการแก้ไข" });
      return;
    }

    setRefining(true);
    setFeedback(null);
    setLastFailedAction(null);

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
      formData.append("aspectRatio", aspectRatio);
      formData.append("aiModel", aiModel);
      formData.append("imageQuality", imageQuality);
      if (specialFeatureEnabled && canUseSpecialFeatures) {
        formData.append("specialFeatureEnabled", "true");
        specialFeatureStyles.forEach((style) => {
          formData.append("specialFeatureStyle", style);
        });
        formData.append("specialFeatureNote", specialFeatureNote.trim());
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (data.image) {
        setResults([data.image]);
        setResult(data.image);
        setSelectedResultIndex(0);
        setEditInstruction("");
        saveToHistory([data.image]);

        setFeedback(
          data.warning ? { tone: "info", text: data.warning } : null
        );
      } else {
        setLastFailedAction("refine");
        setFeedback({
          tone: "error",
          text: data.error || `แก้ไขภาพไม่สำเร็จ (HTTP ${res.status})`,
          retryable: res.status >= 429,
        });
      }
    } catch (error) {
      console.error(error);
      setLastFailedAction("refine");
      setFeedback({
        tone: "error",
        text: "เชื่อมต่อระบบแก้ไขภาพไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่",
        retryable: true,
      });
    } finally {
      setRefining(false);
    }
  }

  const busy = loading || refining;
  function retryLastAction() {
    if (lastFailedAction === "generate") {
      formRef.current?.requestSubmit();
      return;
    }

    if (lastFailedAction === "refine") {
      void handleRefine();
    }
  }
  const databaseConfigured = memberState?.databaseConfigured ?? true;
  const canUseSpecialFeatures = databaseConfigured
    ? Boolean(
        memberState?.subscription?.plan.hasSpecialFeatures ||
          memberState?.isAdmin
      )
    : true;
  const specialFeatureLocked = databaseConfigured && !canUseSpecialFeatures;
  const canUseVipSupport = Boolean(
    memberState?.subscription?.plan.hasVipSupport || memberState?.isAdmin
  );
  const previewAspectClass: Record<ImageSizeValue, string> = {
    "1:1": "aspect-square",
    "3:4": "aspect-[3/4]",
    "4:5": "aspect-[4/5]",
    "9:16": "aspect-[9/16]",
    "4:3": "aspect-[4/3]",
    "16:9": "aspect-video",
  };
  const dailyImagesForSlot = dailyPickerSlot
    ? dailyImages
        .filter((image) => image.imageSlot === dailyPickerSlot)
        .sort(
          (first, second) =>
            Date.parse(second.createdAt) - Date.parse(first.createdAt)
        )
    : [];
  const normalizedDailyGameSearch = dailyPickerGameSearch.trim().toLowerCase();
  const visibleDailyImages = normalizedDailyGameSearch
    ? dailyImagesForSlot.filter((image) =>
        `${image.gameName} ${image.gameTag}`
          .toLowerCase()
          .includes(normalizedDailyGameSearch)
      )
    : dailyImagesForSlot;
  const activeWebsiteGuideStep = WEBSITE_GUIDE_STEPS[websiteGuideStep];

  return (
    <main className="generator-studio relative isolate min-h-screen overflow-hidden bg-[#060609] text-white selection:bg-purple-400/30 selection:text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 -top-48 h-[32rem] w-[32rem] rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute -right-48 top-1/3 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/10 blur-[130px]" />
        <div className="absolute bottom-[-18rem] left-1/3 h-[34rem] w-[34rem] rounded-full bg-violet-500/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      </div>

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="z-40 mb-10 rounded-[1.75rem] border border-white/[0.09] bg-[#0a0a10]/85 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-4 lg:sticky lg:top-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="group flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-purple-400/30 bg-black shadow-[0_8px_26px_rgba(192,132,252,0.28)] transition-transform group-hover:-translate-y-0.5">
                <Image
                  src="/lazy-ai-logo.png"
                  alt=""
                  fill
                  sizes="44px"
                  priority
                  className="scale-[1.42] object-cover"
                />
              </span>
              <span>
                <span className="block text-base font-black tracking-[0.08em] text-white">
                  LAZY-AI.GAME
                </span>
                <span className="block text-xs text-white/40">
                  AI Creative Studio
                </span>
              </span>
            </Link>

            <nav aria-label="เมนูหลัก" className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
              <button
                ref={websiteGuideButtonRef}
                type="button"
                onClick={openWebsiteGuide}
                aria-haspopup="dialog"
                aria-expanded={websiteGuideOpen}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-purple-300/30 bg-purple-400/10 px-3.5 py-2 text-center text-sm font-bold text-purple-100 transition hover:border-purple-300/70 hover:bg-purple-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-purple-200/50 text-xs"
                >
                  ?
                </span>
                วิธีใช้งานเว็บไซต์
              </button>
              <a
                href="/game-calendar"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-center text-sm font-bold text-white/70 transition hover:border-purple-300/40 hover:bg-purple-400/10 hover:text-purple-100"
              >
                ปฏิทินกิจกรรมเกม
              </a>
              <a
                href="/pricing"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-center text-sm font-bold text-white/70 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
              >
                แพ็กเกจ
              </a>
              <a
                href="/dashboard/history"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-center text-sm font-bold text-white/70 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
              >
                ประวัติภาพ
              </a>
              <a
                href={memberState?.isAdmin ? "/admin" : "/dashboard"}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-center text-sm font-bold text-white/70 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
              >
                {memberState?.isAdmin ? "Admin" : "Dashboard"}
              </a>
              {memberState?.isAdmin && (
                <a
                  href="/dashboard"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-center text-sm font-bold text-white/70 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                >
                  Member
                </a>
              )}

              {memberState?.user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-10 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-purple-100"
                >
                  ออกจากระบบ
                </button>
              ) : (
                <>
                  <a
                    href="/sign-in"
                    className="min-h-10 rounded-xl bg-purple-400 px-4 py-2 text-sm font-black text-[#110719] shadow-[0_8px_20px_rgba(192,132,252,0.18)] transition hover:bg-purple-300"
                  >
                    เข้าสู่ระบบ
                  </a>
                  <a
                    href="/sign-up"
                    className="min-h-10 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-purple-100"
                  >
                    สมัครสมาชิก
                  </a>
                </>
              )}
            </nav>
          </div>

          <div className="hidden">
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
        </header>

        <div className="mx-auto mb-10 max-w-4xl text-center sm:mb-12">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/[0.08] px-4 py-2 text-xs font-bold tracking-wide text-purple-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
            AI GAME PROMOTION STUDIO
          </div>

          <h1 className="text-balance text-[2rem] font-black leading-[1.12] tracking-[-0.035em] text-white [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
            สร้างรูปโปรโมทร้านเติมเกมง่ายๆ
            <span className="mt-1 block bg-gradient-to-r from-purple-300 via-fuchsia-300 to-purple-400 bg-clip-text text-transparent">
              ไม่ถึง 3 นาที
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-7 text-white/50 sm:text-base">
            อัปโหลดภาพหลัก ราคา และสไตล์ร้าน แล้วให้ AI ช่วยสร้างงานโปรโมทที่พร้อมใช้งานบนทุกแพลตฟอร์ม
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-white/55">
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">3 ภาพอ้างอิง</span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">6 ขนาดยอดนิยม</span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">สูงสุด 5 ผลลัพธ์</span>
          </div>
        </div>

        {feedback && (
          <StatusMessage
            tone={feedback.tone}
            title={feedback.tone === "error" ? "ดำเนินการไม่สำเร็จ" : undefined}
            className="mb-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{feedback.text}</span>
              {feedback.tone === "error" &&
                feedback.retryable &&
                lastFailedAction && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 rounded-xl px-3 py-2 text-xs"
                    onClick={retryLastAction}
                    disabled={busy}
                  >
                    ลองใหม่
                  </Button>
                )}
            </div>
          </StatusMessage>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            method="post"
            encType="multipart/form-data"
            aria-busy={loading}
            className="relative min-w-0 overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#0b0b12]/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-sm sm:p-6"
          >
            <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/70 to-transparent" />
            <div className="mb-6 flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-purple-300/25 bg-purple-400/10 text-sm font-black text-purple-200">
                01
              </span>
              <div>
                <h2 className="text-xl font-black tracking-tight">ตั้งค่าภาพโปรโมท</h2>
                <p className="mt-1 text-sm leading-6 text-white/40">
                  เตรียมภาพอ้างอิงและกำหนดรูปแบบงานที่ต้องการ
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-3 sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">ภาพอ้างอิง</p>
                  <p className="mt-1 text-xs text-white/35">อัปโหลดให้ครบ 3 ภาพเพื่อผลลัพธ์ที่แม่นยำ</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-bold text-white/45">
                  STEP 1
                </span>
              </div>

              <div className="grid gap-3">
              <FileUpload
                label="ภาพ 1 — ภาพหลัก"
                description="เช่น ตัวละคร / สกิน / กิจกรรมในเกม"
                name="image1"
                previewUrl={previews.image1}
                required={!selectedDailyFiles.image1}
                disabled={busy}
                maxSizeBytes={25 * 1024 * 1024}
                onRejected={(text) => setFeedback({ tone: "error", text })}
                onFileChange={(file) => handleFileUploadChange("image1", file)}
                action={
                  <button
                    type="button"
                    disabled={busy || specialFeatureLocked}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDailyImagePicker("image1");
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-300/30 bg-purple-400/10 px-3 py-2 text-xs font-black text-purple-100 transition hover:border-purple-300/70 hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span aria-hidden="true">♛</span>
                    รูปรายวัน
                  </button>
                }
              />

              <FileUpload
                label="ภาพ 2 — ราคาแพ็ค"
                description="เช่น ไอเทม / แพ็ค / ราคา"
                name="image2"
                previewUrl={previews.image2}
                required={!selectedDailyFiles.image2}
                disabled={busy}
                maxSizeBytes={25 * 1024 * 1024}
                onRejected={(text) => setFeedback({ tone: "error", text })}
                onFileChange={(file) => handleFileUploadChange("image2", file)}
                action={
                  <button
                    type="button"
                    disabled={busy || specialFeatureLocked}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDailyImagePicker("image2");
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-300/30 bg-purple-400/10 px-3 py-2 text-xs font-black text-purple-100 transition hover:border-purple-300/70 hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span aria-hidden="true">♛</span>
                    รูปรายวัน
                  </button>
                }
              />

              <FileUpload
                label="ภาพ 3 — สไตล์ร้าน"
                description="เช่น โลโก้ / ภาพโปรโมทร้านของคุณ"
                name="image3"
                previewUrl={previews.image3}
                required
                disabled={busy}
                maxSizeBytes={25 * 1024 * 1024}
                onRejected={(text) => setFeedback({ tone: "error", text })}
                onFileChange={(file) => handleFileUploadChange("image3", file)}
              />
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">รายละเอียดและรูปแบบ</p>
                  <p className="mt-1 text-xs text-white/35">กำหนดชื่อร้าน ขนาด คุณภาพ และจำนวนภาพ</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-bold text-white/45">
                  STEP 2
                </span>
              </div>

              <div className="space-y-4">
              <TextField
                name="targetShop"
                label="ชื่อร้านของเรา"
                placeholder="เช่น LAYZY TOPUP"
                value={targetShop}
                required
                disabled={busy}
                onChange={(event) => setTargetShop(event.target.value)}
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
                label="โมเดล AI"
                value={aiModel}
                options={AI_MODEL_OPTIONS}
                required
                disabled={busy}
                onValueChange={setAiModel}
              />

              <SelectField
                name="imageQuality"
                label="คุณภาพภาพ"
                value={imageQuality}
                options={IMAGE_QUALITY_OPTIONS}
                required
                disabled={busy}
                onValueChange={setImageQuality}
              />

              <RadioGroup
                name="outputCount"
                label="จำนวนผลลัพธ์"
                value={resultCount}
                options={RESULT_COUNT_OPTIONS}
                columns={5}
                required
                disabled={busy}
                onValueChange={setResultCount}
              />

              <div
                className={`rounded-2xl border p-4 transition ${
                  specialFeatureEnabled && canUseSpecialFeatures
                    ? "border-purple-300/50 bg-purple-400/10"
                    : "border-white/10 bg-black/25"
                }`}
              >
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={specialFeatureEnabled && canUseSpecialFeatures}
                    disabled={busy || specialFeatureLocked}
                    onChange={(event) =>
                      setSpecialFeatureEnabled(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-purple-300 disabled:cursor-not-allowed"
                  />
                  <span>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                      <span
                        aria-hidden="true"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-purple-200/40 bg-purple-400 text-sm text-black shadow-[0_0_18px_rgba(192,132,252,0.25)]"
                      >
                        ♛
                      </span>
                      <span>LAZYPRO</span>
                      <span className="rounded-full border border-purple-300/35 bg-purple-400/15 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-purple-100">
                        เฉพาะแพ็กเกจ 499/999
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/45">
                      ฟีเจอร์พิเศษสำหรับลูกค้าแพ็กเกจ 499/999
                    </span>
                  </span>
                </label>

                {specialFeatureLocked ? (
                  <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-3 text-sm text-white/45">
                    อัปเกรดเป็น Pro 499 หรือ Business 999 เพื่อเปิดตัวเลือกคงแบรนด์ร้านและคำสั่งดีไซน์พิเศษ
                  </div>
                ) : (
                  specialFeatureEnabled && (
                    <div className="mt-4 space-y-4">
                      <fieldset disabled={busy}>
                        <legend className="mb-2 text-sm font-medium text-white/70">
                          การรักษาแบรนด์ร้าน
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {SPECIAL_FEATURE_STYLE_OPTIONS.map((option) => {
                            const selected = specialFeatureStyles.includes(
                              option.value
                            );

                            return (
                              <label
                                key={option.value}
                                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm transition focus-within:ring-2 focus-within:ring-purple-400/60 ${
                                  selected
                                    ? "border-white/40 bg-white/10"
                                    : "border-transparent hover:bg-white/[0.06]"
                                } ${busy ? "cursor-not-allowed opacity-50" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  name="specialFeatureStyle"
                                  value={option.value}
                                  checked={selected}
                                  disabled={busy}
                                  onChange={() =>
                                    toggleSpecialFeatureStyle(option.value)
                                  }
                                  className="mt-0.5 h-4 w-4 accent-white"
                                />
                                <span>
                                  <span className="block font-medium text-white/90">
                                    {option.label}
                                  </span>
                                  <span className="mt-1 block text-white/45">
                                    {option.description}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-xs text-white/35">
                          เลือกได้มากกว่า 1 ตัวเลือก ระบบจะรวมคำสั่งทั้งหมดให้ LAZYPRO
                        </p>
                      </fieldset>

                      <TextareaField
                        label="หมายเหตุการออกแบบ"
                        hint="ระบุจุดที่ต้องรักษาเพิ่มได้ เช่น สีหลัก โลโก้ กรอบราคา แถบโปรโมท ช่องติดต่อ หรือ QR Code"
                        value={specialFeatureNote}
                        maxLength={500}
                        rows={3}
                        disabled={busy}
                        onChange={(event) =>
                          setSpecialFeatureNote(event.target.value)
                        }
                        placeholder="เช่น รักษา QR ให้สแกนได้, โลโก้ห้ามเพี้ยน, คงแถบติดต่อด้านล่าง และใช้สีหลักร้านเหมือนเดิม"
                        className="resize-none text-sm"
                      />
                    </div>
                  )
                )}
              </div>
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              loadingLabel={`AI กำลังสร้าง ${resultCount} ภาพ...`}
              disabled={busy}
              fullWidth
              className="mt-5 shadow-[0_14px_34px_rgba(168,85,247,0.2)]"
            >
              สร้างภาพโปรโมท
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
            className="relative min-w-0 overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#0b0b12]/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-sm sm:p-6"
          >
            <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-sm font-black text-emerald-200">
                  02
                </span>
                <div>
                  <h2 id="result-heading" className="text-xl font-black tracking-tight">พื้นที่สร้างสรรค์</h2>
                  <p className="mt-1 text-sm leading-6 text-white/40">
                    ดู เปรียบเทียบ ดาวน์โหลด และปรับแก้ผลงาน
                  </p>
                </div>
              </div>

              {result ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canUseVipSupport ? (
                    <button
                      type="button"
                      onClick={() =>
                        setVipSupportDraft({
                          id: Date.now(),
                          imageUrls:
                            results.length > 0
                              ? results.slice(0, 5)
                              : [result],
                        })
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-300/40 bg-purple-400/10 px-4 py-2 text-sm font-black text-purple-100 transition hover:border-purple-200 hover:bg-purple-400 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
                    >
                      <span aria-hidden="true">💬</span>
                      ส่งชุดนี้ให้แอดมินช่วยแก้
                    </button>
                  ) : null}
                  <a
                    href={result}
                    download="game-promo.png"
                    className="inline-flex min-h-10 items-center rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-[#04120c] shadow-[0_8px_22px_rgba(52,211,153,0.15)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    ดาวน์โหลดภาพ
                  </a>
                </div>
              ) : null}
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
                      className={`overflow-hidden rounded-2xl border bg-black/40 transition ${
                        selected
                          ? "border-purple-300 ring-2 ring-purple-300/40"
                          : "border-white/10 hover:border-white/30"
                      }`}
                      aria-label={`Select result ${index + 1}`}
                    >
                      <span className="relative block h-20 w-full">
                        <Image
                          src={image}
                          alt={`Generated promo option ${index + 1}`}
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 16vw, 30vw"
                          className="object-cover"
                        />
                      </span>
                      <span className="block px-2 py-1 text-xs font-bold text-white/70">
                        แบบที่ {index + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div
              className={`relative flex ${previewAspectClass[aspectRatio]} items-center justify-center overflow-hidden rounded-3xl border border-white/[0.09] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.055),rgba(0,0,0,0.42)_68%)] shadow-inner`}
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
                    กำลังจัดวางโครงภาพ ไอเทม ราคา และองค์ประกอบตามภาพอ้างอิง
                  </p>
                </div>
              ) : (
                <div className="max-w-xs px-4 text-center sm:px-8">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.045] text-2xl text-purple-200 shadow-[0_12px_32px_rgba(0,0,0,0.25)]" aria-hidden="true">
                    ✦
                  </div>
                  <p className="font-bold text-white/70">พื้นที่แสดงภาพโปรโมท</p>
                  <p className="mt-2 text-sm leading-6 text-white/35">
                    เมื่อสร้างสำเร็จ ผลลัพธ์ที่เลือกจะแสดงในพื้นที่นี้
                  </p>
                </div>
              )}
            </div>

            {result && (
              <div className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
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

            <div className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
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
                    ล้างประวัติ
                  </button>
                )}
              </div>

              {history.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {history.map((item, index) => (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-white/[0.09] bg-black/40 transition hover:-translate-y-0.5 hover:border-white/20"
                    >
                      <button
                        type="button"
                        onClick={() => selectHistoryItem(item)}
                        className="block w-full text-left"
                        aria-label={`Open history image ${index + 1}`}
                      >
                        <span className="relative block aspect-square w-full">
                          <Image
                            src={item.image}
                            alt={`History image ${index + 1}`}
                            fill
                            unoptimized
                            sizes="(min-width: 640px) 12vw, 45vw"
                            className="object-cover"
                          />
                        </span>
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
                          ดาวน์โหลด
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteHistoryItem(item.id)}
                          className="flex-1 border-l border-white/10 px-2 py-2 text-xs font-bold text-white/45 transition hover:bg-white/[0.06] hover:text-red-200"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/35">
                  ภาพที่สร้างแล้วจะถูกเก็บไว้ตรงนี้
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <VipSupportLauncher
        key={vipSupportDraft?.id || "vip-support"}
        visible={!memberLoading}
        authenticated={Boolean(memberState?.user)}
        hasAccess={canUseVipSupport}
        defaultOpen={Boolean(vipSupportDraft)}
        draftImageUrls={vipSupportDraft?.imageUrls || []}
      />

      {websiteGuideOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeWebsiteGuide();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="website-guide-title"
            aria-describedby="website-guide-description"
            className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-purple-300/30 bg-[#0a0710] p-4 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 inline-flex rounded-full border border-purple-300/25 bg-purple-400/10 px-3 py-1 text-xs font-black text-purple-200">
                  ขั้นตอน {websiteGuideStep + 1} จาก {WEBSITE_GUIDE_STEPS.length}
                </p>
                <h2 id="website-guide-title" className="text-2xl font-black sm:text-3xl">
                  วิธีใช้งานเว็บไซต์
                </h2>
                <p
                  id="website-guide-description"
                  className="mt-2 text-sm leading-6 text-white/55"
                >
                  เลื่อนดูวิธีสร้างภาพโปรโมทเกมด้วย AI ทีละขั้นตอน
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={closeWebsiteGuide}
                aria-label="ปิดวิธีใช้งานเว็บไซต์"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 text-xl text-white/60 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                ×
              </button>
            </div>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-purple-400 transition-[width] duration-300"
                style={{
                  width: `${((websiteGuideStep + 1) / WEBSITE_GUIDE_STEPS.length) * 100}%`,
                }}
              />
            </div>

            <div
              key={activeWebsiteGuideStep.title}
              className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/40"
              onTouchStart={(event) => {
                websiteGuideTouchStartXRef.current = event.touches[0].clientX;
              }}
              onTouchEnd={handleWebsiteGuideTouchEnd}
            >
              <WebsiteGuideVisual step={activeWebsiteGuideStep} />

              <div className="border-t border-white/10 p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">
                  ขั้นตอนที่ {websiteGuideStep + 1}
                </p>
                <h3 className="mt-2 text-xl font-black text-white sm:text-2xl">
                  {activeWebsiteGuideStep.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/55 sm:text-base">
                  {activeWebsiteGuideStep.description}
                </p>
              </div>
            </div>

            <div
              className="mt-5 flex flex-wrap items-center justify-center gap-2"
              aria-label="เลือกขั้นตอนวิธีใช้งาน"
            >
              {WEBSITE_GUIDE_STEPS.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setWebsiteGuideStep(index)}
                  aria-label={`ไปขั้นตอนที่ ${index + 1}: ${step.title}`}
                  aria-current={websiteGuideStep === index ? "step" : undefined}
                  className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                    websiteGuideStep === index
                      ? "w-8 bg-purple-400"
                      : "w-2.5 bg-white/25 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={showPreviousWebsiteGuideStep}
                disabled={websiteGuideStep === 0}
                className="rounded-2xl border border-white/15 px-5 py-3 font-bold text-white/75 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                ← ขั้นตอนก่อนหน้า
              </button>
              <button
                type="button"
                onClick={showNextWebsiteGuideStep}
                className="rounded-2xl bg-purple-400 px-5 py-3 font-black text-black transition hover:bg-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
              >
                {websiteGuideStep === WEBSITE_GUIDE_STEPS.length - 1
                  ? "เริ่มสร้างภาพ"
                  : "ขั้นตอนถัดไป →"}
              </button>
            </div>

            <p className="mt-3 text-center text-xs text-white/35">
              ใช้ปุ่มลูกศรซ้าย–ขวาบนคีย์บอร์ดเพื่อเปลี่ยนขั้นตอนได้
            </p>
          </section>
        </div>
      )}

      {dailyPickerSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-image-picker-title"
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-purple-300/25 bg-[#080808] p-4 shadow-2xl sm:p-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-400/10 px-3 py-1 text-xs font-black text-purple-100">
                  <span aria-hidden="true">♛</span>
                  LAZYPRO
                </p>
                <h2 id="daily-image-picker-title" className="text-2xl font-black">
                  เลือกรูปรายวัน
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  {DAILY_IMAGE_SLOT_LABELS[dailyPickerSlot]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDailyPickerSlot(null)}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Close
              </button>
            </div>

            {dailyImagesLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-10 text-center text-sm text-white/45">
                กำลังโหลดรูปรายวัน...
              </div>
            ) : dailyImagesForSlot.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.04] px-4 py-10 text-center">
                <p className="font-bold text-white/70">ยังไม่มีรูปรายวัน</p>
                <p className="mt-2 text-sm text-white/40">
                  ให้ admin อัปโหลดรูปสำหรับช่องนี้ในหน้า Admin Dashboard ก่อน
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <label
                    htmlFor="daily-game-search"
                    className="mb-2 block text-sm font-bold text-white/70"
                  >
                    ค้นหาตามแท็กเกมหรือชื่อรูป
                  </label>
                  <input
                    id="daily-game-search"
                    type="search"
                    value={dailyPickerGameSearch}
                    onChange={(event) =>
                      setDailyPickerGameSearch(event.target.value)
                    }
                    placeholder="พิมพ์แท็กเกม เช่น ROV, MLBB หรือชื่อรูป"
                    autoComplete="off"
                    className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-purple-300/60 focus:ring-4 focus:ring-purple-400/10"
                  />
                </div>

                {visibleDailyImages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.04] px-4 py-10 text-center">
                    <p className="font-bold text-white/70">
                      ไม่พบรูปของเกมที่ค้นหา
                    </p>
                    <p className="mt-2 text-sm text-white/40">
                      ลองตรวจสอบชื่อเกมหรือค้นหาด้วยคำที่สั้นลง
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleDailyImages.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => selectDailyImage(image)}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:border-purple-300/70 hover:bg-purple-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                      >
                        <span className="relative block aspect-square bg-black">
                          <Image
                            src={image.imageUrl}
                            alt={`${image.gameName} daily image`}
                            fill
                            unoptimized
                            sizes="(min-width: 1024px) 25vw, 50vw"
                            className="object-cover"
                          />
                        </span>
                        <span className="block p-3">
                          <span className="block font-bold text-white">
                            {image.gameName}
                          </span>
                          {image.gameTag && (
                            <span className="mt-2 inline-flex rounded-full bg-purple-300/15 px-2 py-1 text-xs font-bold text-purple-100">
                              {image.gameTag}
                            </span>
                          )}
                          <span className="mt-1 block text-xs text-white/45">
                            คลิกเพื่อใช้รูปนี้
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function WebsiteGuideVisual({ step }: { step: WebsiteGuideStep }) {
  if ("image" in step) {
    return (
      <div className="relative h-[230px] bg-[#030303] sm:h-[390px]">
        <Image
          src={step.image}
          alt={step.imageAlt}
          fill
          unoptimized
          sizes="(min-width: 1024px) 900px, 94vw"
          className="object-contain"
        />
      </div>
    );
  }

  if (step.visual === "style-upload") {
    return (
      <div
        role="img"
        aria-label="ตัวอย่างช่องอัปโหลดภาพสไตล์ร้าน"
        className="flex h-[230px] items-center justify-center bg-[#030303] p-5 sm:h-[390px]"
      >
        <div className="flex w-full max-w-xl items-center gap-5 rounded-3xl border border-dashed border-purple-300/45 bg-purple-400/[0.07] p-5 sm:p-7">
          <span className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] text-4xl text-white/55">
            +
          </span>
          <span>
            <span className="block text-lg font-black text-white">ภาพที่ 3</span>
            <span className="mt-1 block text-sm text-purple-200">
              ภาพที่บ่งบอกสไตล์ร้านของคุณ
            </span>
            <span className="mt-2 block text-xs text-white/40">
              PNG, JPG หรือ WEBP · ไม่มีราคาหรือข้อมูลสินค้า
            </span>
          </span>
        </div>
      </div>
    );
  }

  if (step.visual === "result-count") {
    return (
      <div
        role="img"
        aria-label="ตัวอย่างตัวเลือกจำนวนผลลัพธ์ 1 ถึง 5 ภาพ"
        className="flex h-[230px] items-center justify-center bg-[#030303] p-5 sm:h-[390px]"
      >
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <p className="font-bold text-white">จำนวนผลลัพธ์ที่ต้องการ</p>
          <p className="mt-1 text-sm text-white/40">เลือกสร้างได้ตั้งแต่ 1–5 ภาพ</p>
          <div className="mt-5 grid grid-cols-5 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5].map((count) => (
              <span
                key={count}
                className={`inline-flex aspect-square items-center justify-center rounded-2xl border text-lg font-black sm:text-xl ${
                  count === 3
                    ? "border-purple-300 bg-purple-400 text-black"
                    : "border-white/15 bg-black/30 text-white/60"
                }`}
              >
                {count}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="ตัวอย่างปุ่มสร้างภาพและสถานะกำลังประมวลผล"
      className="flex h-[230px] items-center justify-center bg-[#030303] p-5 sm:h-[390px]"
    >
      <div className="w-full max-w-xl rounded-3xl border border-purple-300/20 bg-purple-400/[0.07] p-5 sm:p-7">
        <div className="rounded-2xl bg-purple-400 px-5 py-4 text-center text-lg font-black text-black shadow-[0_0_30px_rgba(192,132,252,0.2)]">
          สร้างภาพโปรโมท 3 ภาพ
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/60">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-300/25 border-t-purple-300" />
          AI กำลังสร้างภาพโปรโมท กรุณารอสักครู่...
        </div>
      </div>
    </div>
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
