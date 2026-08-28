import type { TemplateId } from "@/types/project";
import type { Playable3DEngine } from "@/playable-runtime/engines/types";
import { createStackTowerEngine } from "@/playable-runtime/engines/stack-tower";
import { createTripleMatchEngine } from "@/playable-runtime/engines/triple-match";
import { createLaneRunnerEngine } from "@/playable-runtime/engines/lane-runner";
import { createParkingJamEngine } from "@/playable-runtime/engines/parking-jam";

export function createEngine(templateId: TemplateId): Playable3DEngine {
  switch (templateId) {
    case "triple-match":
      return createTripleMatchEngine();
    case "lane-runner":
      return createLaneRunnerEngine();
    case "parking-jam":
      return createParkingJamEngine();
    default:
      return createStackTowerEngine();
  }
}
