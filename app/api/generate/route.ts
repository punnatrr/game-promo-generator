import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildPrompt } from "@/lib/prompt";

export const maxDuration = 60;

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

function extractImageData(response: any) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];

  const imagePart = parts.find((part: any) => part?.inlineData?.data);

  if (!imagePart) return null;

  return {
    mimeType: imagePart.inlineData.mimeType || "image/png",
    data: imagePart.inlineData.data,
  };
}

function normalizeAspectRatio(value: string) {
  const allowed = ["1:1", "4:5", "16:9"];
  return allowed.includes(value) ? value : "1:1";
}

function buildRefinePrompt(editInstruction: string) {
  return `
You are editing an existing AI-generated game promotion poster.

TASK:
- Keep the original poster concept, product/game context, and overall composition as much as possible.
- Apply the user's requested edits carefully.
- Preserve the main subject, main layout direction, and the readable structure unless the user asks to change them.
- Improve visual consistency, typography balance, and overall polish.
- If the user asks to fix pack pricing / pricing cards / UI elements, make them more cohesive and visually aligned with the poster's CI.
- Do not completely redesign the whole poster unless explicitly requested.

USER EDIT REQUEST:
${editInstruction}
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const mode = String(formData.get("mode") || "generate");

    // =========================
    // REFINE MODE
    // =========================
    if (mode === "refine") {
      const generatedImage = formData.get("generatedImage") as File | null;
      const editInstruction = String(
        formData.get("editInstruction") || ""
      ).trim();

      if (!generatedImage) {
        return NextResponse.json(
          { error: "ไม่พบภาพผลลัพธ์เดิมสำหรับแก้ไข" },
          { status: 400 }
        );
      }

      if (!editInstruction) {
        return NextResponse.json(
          { error: "กรุณาระบุคำสั่งที่ต้องการแก้ไขภาพ" },
          { status: 400 }
        );
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: buildRefinePrompt(editInstruction) },
              await fileToPart(generatedImage),
            ],
          },
        ],
        config: {
          responseModalities: ["IMAGE"],
        } as any,
      });

      const imageData = extractImageData(response);

      if (!imageData) {
        return NextResponse.json(
          { error: "AI ไม่ได้ส่งภาพที่แก้ไขกลับมา" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        image: `data:${imageData.mimeType};base64,${imageData.data}`,
      });
    }

    // =========================
    // GENERATE MODE
    // =========================
    const image1 = formData.get("image1") as File | null;
    const image2 = formData.get("image2") as File | null;
    const image3 = formData.get("image3") as File | null;

    if (!image1 || !image2 || !image3) {
      return NextResponse.json(
        { error: "กรุณาอัปโหลดภาพให้ครบ 3 ภาพ" },
        { status: 400 }
      );
    }

    const targetShop = String(formData.get("targetShop") || "").trim();
    const referenceShop = String(formData.get("referenceShop") || "").trim();
    const forbiddenShop = String(formData.get("forbiddenShop") || "").trim();
    const aspectRatio = normalizeAspectRatio(
      String(formData.get("aspectRatio") || "1:1")
    );

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
      } as any,
    });

    const imageData = extractImageData(response);

    if (!imageData) {
      return NextResponse.json(
        { error: "AI ไม่ได้ส่งภาพกลับมา" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: `data:${imageData.mimeType};base64,${imageData.data}`,
    });
  } catch (error) {
    console.error("route.ts error:", error);

    return NextResponse.json(
      {
        error: "เกิดข้อผิดพลาดในระบบ generate image",
      },
      { status: 500 }
    );
  }
}