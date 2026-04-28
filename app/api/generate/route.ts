import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildPrompt } from "@/lib/prompt";

export const maxDuration = 300;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

async function fileToPart(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    inlineData: {
      mimeType: file.type,
      data: buffer.toString("base64"),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const image1 = formData.get("image1") as File | null;
    const image2 = formData.get("image2") as File | null;
    const image3 = formData.get("image3") as File | null;

    if (!image1 || !image2 || !image3) {
      return NextResponse.json(
        { error: "กรุณาอัปโหลดภาพให้ครบ 3 ภาพ" },
        { status: 400 }
      );
    }

    const targetShop = String(formData.get("targetShop") || "");
    const referenceShop = String(formData.get("referenceShop") || "");
    const forbiddenShop = String(formData.get("forbiddenShop") || "");
    const aspectRatio = String(formData.get("aspectRatio") || "1:1");

    const prompt = buildPrompt({
      targetShop,
      referenceShop,
      forbiddenShop,
      aspectRatio,
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            await fileToPart(image1),
            await fileToPart(image2),
            await fileToPart(image3),
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio,
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      return NextResponse.json(
        { error: "AI ไม่ได้ส่งภาพกลับมา" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${
        imagePart.inlineData.data
      }`,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ Generate" },
      { status: 500 }
    );
  }
}