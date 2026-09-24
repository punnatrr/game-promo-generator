import { NextRequest } from "next/server";
import { leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { gameDictionary } from "@/lib/leads/repository";

export async function GET(req: NextRequest) {
  try {
    await leadUser(req);
    const games = await gameDictionary();
    return leadJson({ games });
  } catch (error) {
    return leadFailure(error);
  }
}
