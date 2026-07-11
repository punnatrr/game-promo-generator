import { NextRequest, NextResponse } from "next/server";
import { GenerateError, getClientErrorMessage } from "@/lib/generation/errors";
import { processGenerationRequest } from "@/lib/generation/request";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const result = await processGenerationRequest(await request.formData());

    return NextResponse.json({
      image: `data:${result.mimeType};base64,${result.data}`,
    });
  } catch (error) {
    console.error("Image generation failed:", error);

    return NextResponse.json(
      { error: getClientErrorMessage(error) },
      { status: error instanceof GenerateError ? error.status : 500 }
    );
  }
}
