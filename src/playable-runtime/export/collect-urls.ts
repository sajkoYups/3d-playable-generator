import type { ProjectData } from "@/types/project";
import { getLibraryModel, resolveModelRef } from "@/lib/model-library";

export function collectAssetUrls(data: ProjectData): string[] {
  const urls = new Set<string>();
  const add = (u?: string) => {
    if (u) urls.add(u);
  };

  const walkBg = (bg?: { portraitImageUrl?: string; landscapeImageUrl?: string }) => {
    add(bg?.portraitImageUrl);
    add(bg?.landscapeImageUrl);
  };

  walkBg(data.startScreen.background);
  walkBg(data.endScreen.background);
  walkBg(data.gameplay.background.portrait);
  walkBg(data.gameplay.background.landscape);
  walkBg(data.gameplay.stageBackground.portrait);
  walkBg(data.gameplay.stageBackground.landscape);
  add(data.startScreen.videoUrl);
  add(data.endScreen.videoUrl);
  add(data.gameplay.audio.musicUrl);
  add(data.gameplay.audio.tapUrl);
  add(data.gameplay.audio.winUrl);
  add(data.gameplay.audio.loseUrl);
  add(data.gameplay.stackTower.faceTextureUrl);
  add(data.gameplay.parkingJam.lotTextureUrl);
  add(data.gameplay.parkingJam.pavementTextureUrl);
  add(data.gameplay.parkingJam.grassTextureUrl || "/kenney_road-textures/PNG/Retina/roadTexture_25.png");
  add(data.gameplay.parkingJam.coinImageUrl || "/coin.svg");
  const carRef = resolveModelRef(data.gameplay.parkingJam.carModelUrl || "sedan");
  add(carRef.url);
  if (carRef.libraryId && carRef.libraryId !== "van" && carRef.libraryId !== "truck") {
    add(getLibraryModel("van")?.url);
  }

  const allEls = [
    ...data.startScreen.elements,
    ...data.endScreen.elements,
    ...data.gameplay.overlays,
  ];
  for (const el of allEls) {
    add(el.content.imageUrl);
    add(el.content.videoUrl);
  }

  add("/models/kenney/food/colormap.png");
  add(data.gameplay.tripleMatch.coinImageUrl || "/coin.svg");
  const matchSlots = [
    ...data.gameplay.tripleMatch.itemSlots,
    ...data.gameplay.tripleMatch.rounds.flatMap((r) => r.itemSlots),
  ];
  for (const slot of matchSlots) {
    const item = resolveModelRef(slot);
    add(item.url);
  }
  add(data.gameplay.laneRunner.grassTextureUrl || "/kenney_road-textures/PNG/Retina/roadTexture_25.png");
  add(data.gameplay.laneRunner.roadTextureUrl);
  add(data.gameplay.laneRunner.coinImageUrl || "/coin.svg");
  add(resolveModelRef(data.gameplay.laneRunner.characterModelUrl || "sedan").url);
  for (const ob of data.gameplay.laneRunner.obstacleSet) {
    add(resolveModelRef(ob).url);
  }

  return [...urls];
}
