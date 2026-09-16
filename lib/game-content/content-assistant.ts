import { GoogleGenAI } from "@google/genai";

import type { GameActivity, GeneratedGameContent } from "./types";

const UNVERIFIED = new Set(["RUMOR", "DATAMINED", "UNKNOWN"]);
const WARNING =
  "ข้อมูลนี้ยังอยู่ในขั้นข่าวลือ รายละเอียดอาจมีการเปลี่ยนแปลง โปรดรอประกาศอย่างเป็นทางการ";

function known(value: string | null, suffix = "") {
  if (!value) return "ยังไม่มีข้อมูลยืนยัน";
  return `${new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value))}${suffix}`;
}

function buildSafeFallback(activity: GameActivity): GeneratedGameContent {
  const warning = UNVERIFIED.has(activity.verificationStatus) ? WARNING : null;
  const sourceLine = `อ้างอิง: ${activity.sourceName} ${activity.sourceUrl}`;
  const guard = warning ? `\n\n⚠️ ${warning}` : "";

  return {
    summary: {
      whatHappened: activity.description || activity.title,
      startsAt: known(activity.startDate),
      endsAt: known(activity.endDate),
      playerBenefit: "ยังไม่มีข้อมูลยืนยัน",
      topupRelevance:
        activity.monetizationScore >= 70
          ? "มีโอกาสเกี่ยวข้องกับการเติมเกม ควรตรวจสอบแพ็กและราคาจริงจากฐานข้อมูลร้านก่อนเผยแพร่"
          : "ยังไม่มีข้อมูลยืนยัน",
      verification: activity.verificationStatus,
    },
    contentAngles: [
      "ข่าวอัปเดต",
      "สรุปสิ่งที่ผู้เล่นควรรู้",
      ...(activity.endDate ? ["เตือนกิจกรรมใกล้หมด"] : []),
      ...(activity.monetizationScore >= 70 ? ["โปรโมตการเติมเกม"] : []),
    ],
    captions: {
      news: `${activity.title}\n\n${activity.description || "ยังไม่มีข้อมูลยืนยัน"}\n\n${sourceLine}${guard}`,
      friendly: `อัปเดต ${activity.gameName}: ${activity.title}\n\nเช็กรายละเอียดจากต้นทางก่อนวางแผนเล่นและเติมเกม\n${sourceLine}${guard}`,
      thunderTopup: `${activity.title}\n\nทีม LAZY TOPUP กำลังติดตามรายละเอียดกิจกรรมนี้ โปรดตรวจสอบราคาและแพ็กจริงจากหน้าร้านก่อนเผยแพร่\n${sourceLine}${guard}`,
    },
    designBrief: {
      headline: activity.title,
      subheadline:
        activity.verificationStatus === "OFFICIAL"
          ? `ประกาศทางการจาก ${activity.sourceName}`
          : "ข้อมูลอยู่ระหว่างการตรวจสอบ",
      imageText: activity.title,
      subject: "ใช้เฉพาะภาพทางการที่มีสิทธิ์ใช้งาน",
      colorTone: "อ้างอิงสีแบรนด์ของเกมและ LAZY TOPUP",
      aspectRatio: "1:1 และ 4:5",
      callToAction: "ติดตามรายละเอียดและเติมเกมกับ LAZY TOPUP",
      prohibitedClaims: [
        "ห้ามระบุราคา หากยังไม่มีราคาจริงจากฐานข้อมูลร้าน",
        "ห้ามเพิ่มชื่อสกิน ตัวละคร แพ็ก หรือวันที่ที่ไม่มีในต้นทาง",
        ...(warning ? ["ห้ามนำเสนอข่าวนี้เป็นข้อเท็จจริงที่ยืนยันแล้ว"] : []),
      ],
    },
    warning,
  };
}

function extractJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const parsed = JSON.parse(fenced || value) as Partial<GeneratedGameContent>;
  if (
    !parsed.summary ||
    !Array.isArray(parsed.contentAngles) ||
    !parsed.captions?.news ||
    !parsed.captions.friendly ||
    !parsed.captions.thunderTopup ||
    !parsed.designBrief?.headline ||
    !Array.isArray(parsed.designBrief.prohibitedClaims)
  ) {
    throw new Error("AI response did not match the Game Content schema");
  }
  return parsed as GeneratedGameContent;
}

export async function generateGameContent(activity: GameActivity) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      content: buildSafeFallback(activity),
      provider: "deterministic-safe-fallback",
      model: null,
    };
  }

  const model = process.env.GAME_CONTENT_AI_MODEL || "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });
  const verifiedFacts = {
    game: activity.gameName,
    title: activity.title,
    description: activity.description,
    startDate: activity.startDate,
    endDate: activity.endDate,
    sourceName: activity.sourceName,
    sourceUrl: activity.sourceUrl,
    verificationStatus: activity.verificationStatus,
    monetizationScore: activity.monetizationScore,
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `คุณคือผู้ช่วยวางแผนคอนเทนต์ของ LAZY TOPUP
ใช้เฉพาะข้อมูลใน JSON ด้านล่าง ห้ามแต่งชื่อ ราคา วันที่ ไอเทม ตัวละคร หรือรายละเอียดเพิ่ม
หากค่าใดไม่มี ให้ตอบ "ยังไม่มีข้อมูลยืนยัน"
ถ้าสถานะเป็น RUMOR, DATAMINED หรือ UNKNOWN ต้องใส่คำเตือนชัดเจน
ตอบเป็น JSON เท่านั้น โดยมีโครงสร้าง summary, contentAngles, captions และ designBrief

ข้อมูลที่ยืนยันได้:
${JSON.stringify(verifiedFacts)}`,
    });
    const text = response.text || "";
    const parsed = extractJson(text);

    return { content: parsed, provider: "gemini", model };
  } catch (error) {
    console.error("Game Content AI fallback used", error);
    return {
      content: buildSafeFallback(activity),
      provider: "deterministic-safe-fallback",
      model: null,
    };
  }
}
