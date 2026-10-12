import type { ProjectData, TemplateId } from "@/types/project";
import { is2DTemplate } from "@/types/project";
import { getLibraryModel, resolveModelRef, TD_MODEL_URLS } from "@/lib/model-library";
import {
  dominoSpriteUrls,
  racingSpriteUrls,
  shooterSpriteUrls,
  solitaireSpriteUrls,
  tappySpriteUrls,
} from "@/playable-runtime/engines/kenney-2d-assets";
import { parking2dSpriteUrls } from "@/playable-runtime/engines/parking-2d/sprites";
import { dressUpAssetUrls } from "@/playable-runtime/engines/dress-up/catalog";
import { pickSoundUrl, PLAYABLE_SOUNDS } from "@/playable-runtime/audio/defaults";

const FOOD_COLORMAP = "/models/kenney/food/colormap.png";
const KENNEY_GRASS = "/kenney_road-textures/PNG/Retina/roadTexture_25.png";

function is2D(templateId?: TemplateId) {
  return Boolean(templateId && is2DTemplate(templateId));
}

function coinUrl(data: ProjectData, specific?: string, fallback = "/coin.svg") {
  return specific || data.coinImageUrl || fallback;
}

export function collectAssetUrls(data: ProjectData, templateId?: TemplateId): string[] {
  const urls = new Set<string>();
  const add = (u?: string) => {
    if (u) urls.add(u);
  };

  const walkBg = (bg?: {
    portraitImageUrl?: string;
    landscapeImageUrl?: string;
    portraitVideoUrl?: string;
    landscapeVideoUrl?: string;
  }) => {
    add(bg?.portraitImageUrl);
    add(bg?.landscapeImageUrl);
    add(bg?.portraitVideoUrl);
    add(bg?.landscapeVideoUrl);
  };

  walkBg(data.startScreen.background);
  walkBg(data.endScreen.background);
  walkBg(data.gameplay.background.portrait);
  walkBg(data.gameplay.background.landscape);
  walkBg(data.gameplay.stageBackground.portrait);
  walkBg(data.gameplay.stageBackground.landscape);
  add(data.gameplay.fullBackground.portraitImageUrl);
  add(data.gameplay.fullBackground.landscapeImageUrl);
  add(data.startScreen.videoUrl);
  add(data.endScreen.videoUrl);
  add(data.coinImageUrl);
  add(data.gameplay.audio.musicUrl);
  add(data.gameplay.audio.tapUrl);
  add(data.gameplay.audio.winUrl);
  add(data.gameplay.audio.loseUrl);

  const allEls = [
    ...data.startScreen.elements,
    ...data.endScreen.elements,
    ...data.gameplay.overlays,
  ];
  for (const el of allEls) {
    add(el.content.imageUrl);
    add(el.content.videoUrl);
  }

  if (is2D(templateId)) {
    add(coinUrl(data, data.gameplay.match3.coinImageUrl, "/demo-assets/coin.svg"));
    for (const url of data.gameplay.pieceImages) add(url);
    if (templateId === "solitaire") {
      add(coinUrl(data, data.gameplay.solitaire.coinImageUrl, "/demo-assets/coin.svg"));
      for (const url of solitaireSpriteUrls()) add(url);
      const solSounds = data.gameplay.solitaire.sounds;
      add(pickSoundUrl(solSounds?.flipUrl, PLAYABLE_SOUNDS.cardFlip));
      add(pickSoundUrl(solSounds?.moveUrl, PLAYABLE_SOUNDS.swoosh));
      add(pickSoundUrl(solSounds?.placeUrl, PLAYABLE_SOUNDS.cardPlace));
      add(pickSoundUrl(solSounds?.payoutUrl, PLAYABLE_SOUNDS.payout));
    } else if (templateId === "domino") {
      add(coinUrl(data, data.gameplay.domino.coinImageUrl, "/demo-assets/coin.svg"));
      for (const url of dominoSpriteUrls()) add(url);
      add(PLAYABLE_SOUNDS.payout);
      add(PLAYABLE_SOUNDS.dominoRefill);
      add(PLAYABLE_SOUNDS.dominoPlace);
      add(PLAYABLE_SOUNDS.dominoTurn);
    } else if (templateId === "tappy-plane") {
      add(coinUrl(data, data.gameplay.tappyPlane.coinImageUrl, "/demo-assets/coin.svg"));
      for (const url of tappySpriteUrls()) add(url);
      const planeSounds = data.gameplay.tappyPlane.sounds;
      add(pickSoundUrl(planeSounds?.engineUrl, PLAYABLE_SOUNDS.planeLoop));
      add(pickSoundUrl(planeSounds?.flapUrl, PLAYABLE_SOUNDS.swoosh));
      add(pickSoundUrl(planeSounds?.coinUrl, PLAYABLE_SOUNDS.coin));
      add(pickSoundUrl(planeSounds?.crashUrl, PLAYABLE_SOUNDS.crash));
    } else if (templateId === "racing-lap") {
      add(coinUrl(data, data.gameplay.racingLap.coinImageUrl, "/demo-assets/coin.svg"));
      for (const url of racingSpriteUrls()) add(url);
    } else if (templateId === "top-down-shooter") {
      add(coinUrl(data, data.gameplay.topDownShooter.coinImageUrl, "/demo-assets/coin.svg"));
      for (const url of shooterSpriteUrls()) add(url);
    } else if (templateId === "dress-up") {
      for (const url of dressUpAssetUrls()) add(url);
      const dressSounds = data.gameplay.dressUp.sounds;
      add(pickSoundUrl(dressSounds?.selectUrl, PLAYABLE_SOUNDS.swoosh));
      add(pickSoundUrl(dressSounds?.dressUrl, PLAYABLE_SOUNDS.swoosh));
      add(pickSoundUrl(dressSounds?.revealUrl, PLAYABLE_SOUNDS.wow));
    } else if (templateId === "parking-2d") {
      const lot = data.gameplay.parking2d;
      add(coinUrl(data, lot.coinImageUrl));
      for (const url of parking2dSpriteUrls(lot)) add(url);
      const lotSounds = lot.sounds;
      add(pickSoundUrl(lotSounds?.ambienceUrl, PLAYABLE_SOUNDS.trafficAmbience));
      add(pickSoundUrl(lotSounds?.moveUrl, PLAYABLE_SOUNDS.swoosh));
      add(pickSoundUrl(lotSounds?.coinUrl, PLAYABLE_SOUNDS.coin));
      add(pickSoundUrl(lotSounds?.payoutUrl, PLAYABLE_SOUNDS.payout));
    } else if (templateId === "water-sort") {
      const sortSounds = data.gameplay.waterSort.sounds;
      add(pickSoundUrl(sortSounds?.pourUrl, PLAYABLE_SOUNDS.pour));
      add(sortSounds?.denyUrl);
      add(pickSoundUrl(sortSounds?.payoutUrl, PLAYABLE_SOUNDS.payout));
    } else if (templateId === "match-3") {
      const match3Sounds = data.gameplay.match3.sounds;
      add(pickSoundUrl(match3Sounds?.moveUrl, PLAYABLE_SOUNDS.swoosh));
      add(pickSoundUrl(match3Sounds?.matchUrl, PLAYABLE_SOUNDS.match3Match));
      add(match3Sounds?.denyUrl);
      add(pickSoundUrl(match3Sounds?.payoutUrl, PLAYABLE_SOUNDS.payout));
    }
    return [...urls];
  }

  if (templateId === "stack-tower") {
    add(data.gameplay.stackTower.faceTextureUrl);
    add(coinUrl(data, data.gameplay.stackTower.coinImageUrl));
    add(pickSoundUrl(data.gameplay.stackTower.sounds?.moveUrl, PLAYABLE_SOUNDS.swoosh));
  } else if (templateId === "parking-jam") {
    add(data.gameplay.parkingJam.lotTextureUrl);
    add(data.gameplay.parkingJam.pavementTextureUrl);
    add(data.gameplay.parkingJam.grassTextureUrl || KENNEY_GRASS);
    add(coinUrl(data, data.gameplay.parkingJam.coinImageUrl));
    add(FOOD_COLORMAP);
    const carRef = resolveModelRef(data.gameplay.parkingJam.carModelUrl || "sedan");
    add(carRef.url);
    if (carRef.libraryId && carRef.libraryId !== "van" && carRef.libraryId !== "truck") {
      add(getLibraryModel("van")?.url);
    }
    const jamSounds = data.gameplay.parkingJam.sounds;
    add(pickSoundUrl(jamSounds?.ambienceUrl, PLAYABLE_SOUNDS.trafficAmbience));
    add(pickSoundUrl(jamSounds?.moveUrl, PLAYABLE_SOUNDS.swoosh));
    add(pickSoundUrl(jamSounds?.payoutUrl, PLAYABLE_SOUNDS.payout));
  } else if (templateId === "triple-match") {
    add(FOOD_COLORMAP);
    add(coinUrl(data, data.gameplay.tripleMatch.coinImageUrl));
    const matchSlots = [
      ...data.gameplay.tripleMatch.itemSlots,
      ...data.gameplay.tripleMatch.rounds.flatMap((r) => r.itemSlots),
    ];
    for (const slot of matchSlots) {
      add(resolveModelRef(slot).url);
    }
    const matchSounds = data.gameplay.tripleMatch.sounds;
    add(pickSoundUrl(matchSounds?.ambienceUrl, PLAYABLE_SOUNDS.restaurantAmbience));
    add(pickSoundUrl(matchSounds?.moveUrl, PLAYABLE_SOUNDS.swoosh));
    add(pickSoundUrl(matchSounds?.matchUrl, PLAYABLE_SOUNDS.matchWin));
    add(pickSoundUrl(matchSounds?.payoutUrl, PLAYABLE_SOUNDS.payout));
  } else if (templateId === "lane-runner") {
    add(FOOD_COLORMAP);
    add(data.gameplay.laneRunner.grassTextureUrl || KENNEY_GRASS);
    add(data.gameplay.laneRunner.roadTextureUrl);
    add(coinUrl(data, data.gameplay.laneRunner.coinImageUrl));
    add(resolveModelRef(data.gameplay.laneRunner.characterModelUrl || "sedan").url);
    for (const ob of data.gameplay.laneRunner.obstacleSet) {
      add(resolveModelRef(ob).url);
    }
    const laneSounds = data.gameplay.laneRunner.sounds;
    add(pickSoundUrl(laneSounds?.ambienceUrl, PLAYABLE_SOUNDS.trafficAmbience));
    add(pickSoundUrl(laneSounds?.moveUrl, PLAYABLE_SOUNDS.swoosh));
  } else if (templateId === "tower-defense") {
    for (const url of TD_MODEL_URLS) add(url);
    add(coinUrl(data, data.gameplay.towerDefense.coinImageUrl));
    const tdSounds = data.gameplay.towerDefense.sounds;
    add(pickSoundUrl(tdSounds?.arrowFireUrl, PLAYABLE_SOUNDS.arrowFire));
    add(pickSoundUrl(tdSounds?.cannonFireUrl, PLAYABLE_SOUNDS.cannonFire));
    add(pickSoundUrl(tdSounds?.turretFireUrl, PLAYABLE_SOUNDS.turretFire));
    add(tdSounds?.hitUrl);
    add(tdSounds?.deathUrl);
    add(tdSounds?.leakUrl);
    add(tdSounds?.placeUrl);
    add(tdSounds?.waveUrl);
  }

  return [...urls];
}
