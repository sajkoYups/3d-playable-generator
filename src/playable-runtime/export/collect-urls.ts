import type { ProjectData, TemplateId } from "@/types/project";
import { getLibraryModel, resolveModelRef, TD_MODEL_URLS } from "@/lib/model-library";

const FOOD_COLORMAP = "/models/kenney/food/colormap.png";
const KENNEY_GRASS = "/kenney_road-textures/PNG/Retina/roadTexture_25.png";

function is2D(templateId?: TemplateId) {
  return templateId === "water-sort" || templateId === "match-3";
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
    return [...urls];
  }

  if (templateId === "stack-tower") {
    add(data.gameplay.stackTower.faceTextureUrl);
    add(coinUrl(data, data.gameplay.stackTower.coinImageUrl));
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
  } else if (templateId === "lane-runner") {
    add(FOOD_COLORMAP);
    add(data.gameplay.laneRunner.grassTextureUrl || KENNEY_GRASS);
    add(data.gameplay.laneRunner.roadTextureUrl);
    add(coinUrl(data, data.gameplay.laneRunner.coinImageUrl));
    add(resolveModelRef(data.gameplay.laneRunner.characterModelUrl || "sedan").url);
    for (const ob of data.gameplay.laneRunner.obstacleSet) {
      add(resolveModelRef(ob).url);
    }
  } else if (templateId === "tower-defense") {
    for (const url of TD_MODEL_URLS) add(url);
    add(coinUrl(data, data.gameplay.towerDefense.coinImageUrl));
    const tdSounds = data.gameplay.towerDefense.sounds;
    add(tdSounds?.arrowFireUrl);
    add(tdSounds?.cannonFireUrl);
    add(tdSounds?.turretFireUrl);
    add(tdSounds?.hitUrl);
    add(tdSounds?.deathUrl);
    add(tdSounds?.leakUrl);
    add(tdSounds?.placeUrl);
    add(tdSounds?.waveUrl);
  }

  return [...urls];
}
