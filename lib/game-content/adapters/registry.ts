import { cookieRunClassicManualAdapter } from "./cookierun-classic";
import { digimonUpOfficialAdapter } from "./digimon-up";
import { efootballOfficialAdapter } from "./efootball";
import { fcMobileOfficialAdapter } from "./fc-mobile";
import { freeFireOfficialAdapter } from "./free-fire";
import { freeFireMaxOfficialAdapter } from "./free-fire-max";
import { garenaRovOfficialAdapter } from "./garena-rov";
import { genshinImpactManualAdapter } from "./genshin-impact";
import { honkaiStarRailManualAdapter } from "./honkai-star-rail";
import { kingshotManualAdapter } from "./kingshot";
import { lastWarManualAdapter } from "./last-war";
import { loveAndDeepspaceManualAdapter } from "./love-and-deepspace";
import { mobileLegendsManualAdapter } from "./mobile-legends";
import { pubgMobileManualAdapter } from "./pubg-mobile";
import { ragnarokNewWorldManualAdapter } from "./ragnarok-the-new-world";
import { robloxAnnouncementsAdapter } from "./roblox";
import { soulLandAwakeningWorldManualAdapter } from "./soul-land-awakening-world";
import type { GameSourceAdapter } from "./types";
import { valorantThailandAdapter } from "./valorant";
import { whiteoutCenturyGamesAdapter } from "./whiteout-survival";
import { wutheringWavesManualAdapter } from "./wuthering-waves";

export const GAME_SOURCE_ADAPTERS: GameSourceAdapter[] = [
  efootballOfficialAdapter,
  cookieRunClassicManualAdapter,
  mobileLegendsManualAdapter,
  freeFireOfficialAdapter,
  freeFireMaxOfficialAdapter,
  ragnarokNewWorldManualAdapter,
  fcMobileOfficialAdapter,
  garenaRovOfficialAdapter,
  robloxAnnouncementsAdapter,
  pubgMobileManualAdapter,
  whiteoutCenturyGamesAdapter,
  kingshotManualAdapter,
  lastWarManualAdapter,
  digimonUpOfficialAdapter,
  soulLandAwakeningWorldManualAdapter,
  honkaiStarRailManualAdapter,
  loveAndDeepspaceManualAdapter,
  genshinImpactManualAdapter,
  wutheringWavesManualAdapter,
  valorantThailandAdapter,
];

const adaptersByKey = new Map(
  GAME_SOURCE_ADAPTERS.map((adapter) => [adapter.key, adapter])
);

export function getGameSourceAdapter(key: string | null) {
  return key ? adaptersByKey.get(key) || null : null;
}
