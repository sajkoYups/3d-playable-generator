import type { TemplateId } from "@/types/project";
import type { Playable3DEngine } from "@/playable-runtime/engines/types";
import { createStackTowerEngine } from "@/playable-runtime/engines/stack-tower";
import { createTripleMatchEngine } from "@/playable-runtime/engines/triple-match";
import { createLaneRunnerEngine } from "@/playable-runtime/engines/lane-runner";
import { createParkingJamEngine } from "@/playable-runtime/engines/parking-jam";
import { createTowerDefenseEngine } from "@/playable-runtime/engines/tower-defense";
import { createWaterSortEngine } from "@/playable-runtime/engines/water-sort";
import { createMatch3Engine } from "@/playable-runtime/engines/match-3";
import { createSolitaireEngine } from "@/playable-runtime/engines/solitaire";
import { createDominoEngine } from "@/playable-runtime/engines/domino";
import { createTappyPlaneEngine } from "@/playable-runtime/engines/tappy-plane";
import { createRacingLapEngine } from "@/playable-runtime/engines/racing-lap";
import { createTopDownShooterEngine } from "@/playable-runtime/engines/top-down-shooter";
import { createDressUpEngine } from "@/playable-runtime/engines/dress-up";

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
    case "solitaire":
      return createSolitaireEngine();
    case "domino":
      return createDominoEngine();
    case "tappy-plane":
      return createTappyPlaneEngine();
    case "racing-lap":
      return createRacingLapEngine();
    case "top-down-shooter":
      return createTopDownShooterEngine();
    case "dress-up":
      return createDressUpEngine();
    default:
      return createStackTowerEngine();
  }
}
