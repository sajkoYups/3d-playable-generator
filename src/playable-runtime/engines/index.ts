import type { TemplateId } from "@/types/project";
import type { Playable3DEngine } from "@/playable-runtime/engines/types";
import { createStackTowerEngine } from "@/playable-runtime/engines/stack-tower";
import { createTripleMatchEngine } from "@/playable-runtime/engines/triple-match";
import { createLaneRunnerEngine } from "@/playable-runtime/engines/lane-runner";
import { createParkingJamEngine } from "@/playable-runtime/engines/parking-jam";
import { createTowerDefenseEngine } from "@/playable-runtime/engines/tower-defense";
import { createWaterSortEngine } from "@/playable-runtime/engines/water-sort";
import { createMatch3Engine } from "@/playable-runtime/engines/match-3";

export function createEngine(templateId: TemplateId): Playable3DEngine {
  switch (templateId) {
    case "triple-match":
      return createTripleMatchEngine();
    case "lane-runner":
      return createLaneRunnerEngine();
    case "parking-jam":
      return createParkingJamEngine();
    case "tower-defense":
      return createTowerDefenseEngine();
    case "water-sort":
      return createWaterSortEngine();
    case "match-3":
      return createMatch3Engine();
    default:
      return createStackTowerEngine();
  }
}
