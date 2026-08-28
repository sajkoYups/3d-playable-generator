"use client";

import { useEditorStore } from "@/features/editor/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AssetUrlField } from "@/features/editor/asset-url-field";
import { CAMERA_FOV_MAX, CAMERA_FOV_MIN, type Background, type LightingPreset, type ParkingJamConfig, type ParkingRound, type PlayableElement, type ProjectData } from "@/types/project";
import { MATCH_ITEMS, VEHICLES } from "@/lib/model-library";
import { ensureParkingRounds, repairParkingCars, setParkingRoundCount, syncParkingRound } from "@/playable-runtime/engines/parking-jam/layout";

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function clampInt(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function patchParkingRound(
  updateData: (updater: (draft: ProjectData) => void) => void,
  index: number,
  patch: (round: ParkingRound, jam: ParkingJamConfig) => void,
) {
  updateData((d) => {
    const jam = d.gameplay.parkingJam;
    ensureParkingRounds(jam);
    const i = Math.max(0, Math.min(index, jam.rounds.length - 1));
    patch(jam.rounds[i], jam);
    syncParkingRound(jam, i);
  });
}

function BackgroundEditor({
  background,
  orientation,
  onChange,
  allowTransparent,
  allowVideo,
  videoUrl = "",
}: {
  background: Background;
  orientation: "portrait" | "landscape";
  onChange: (next: Background, videoUrl?: string) => void;
  allowTransparent?: boolean;
  allowVideo?: boolean;
  videoUrl?: string;
}) {
  const types = [
    "solid",
    "gradient",
    "image",
    ...(allowVideo ? (["video"] as const) : []),
    ...(allowTransparent ? (["transparent"] as const) : []),
  ] as const;
  const active =
    allowVideo && (videoUrl || background.type === "video") ? "video" : background.type;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {types.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={active === t ? "default" : "outline"}
            onClick={() => {
              if (t === "video") onChange({ ...background, type: "video" });
              else onChange({ ...background, type: t }, allowVideo ? "" : undefined);
            }}
          >
            {t}
          </Button>
        ))}
      </div>
      {active === "solid" && (
        <Input type="color" value={background.color} onChange={(e) => onChange({ ...background, color: e.target.value })} />
      )}
      {active === "gradient" && (
        <div className="grid grid-cols-2 gap-2">
          <Input type="color" value={background.gradientFrom} onChange={(e) => onChange({ ...background, gradientFrom: e.target.value })} />
          <Input type="color" value={background.gradientTo} onChange={(e) => onChange({ ...background, gradientTo: e.target.value })} />
        </div>
      )}
      {active === "image" && (
        <AssetUrlField
          label={orientation === "portrait" ? "Portrait image" : "Landscape image"}
          accept="image/*"
          value={orientation === "portrait" ? background.portraitImageUrl || "" : background.landscapeImageUrl || ""}
          onChange={(url) =>
            onChange(
              orientation === "portrait"
                ? { ...background, portraitImageUrl: url }
                : { ...background, landscapeImageUrl: url },
            )
          }
        />
      )}
      {active === "video" && (
        <AssetUrlField
          label="Video"
          kind="video"
          accept="video/*"
          value={videoUrl}
          onChange={(url) => onChange({ ...background, type: "video" }, url)}
        />
      )}
    </div>
  );
}

function GameplaySettings() {
  const data = useEditorStore((s) => s.data);
  const templateId = useEditorStore((s) => s.templateId);
  const orientation = useEditorStore((s) => s.orientation);
  const updateData = useEditorStore((s) => s.updateData);
  const parkingRoundIndex = useEditorStore((s) => s.parkingRoundIndex);
  const setParkingRoundIndex = useEditorStore((s) => s.setParkingRoundIndex);
  const cam = data.gameplay.camera[orientation];

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-semibold">Gameplay</h3>
        <p className="text-xs text-muted">Engine is locked. Tune presentation and difficulty.</p>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Stage background ({orientation})</h4>
        <BackgroundEditor
          background={data.gameplay.stageBackground[orientation]}
          orientation={orientation}
          onChange={(next) =>
            updateData((draft) => {
              draft.gameplay.stageBackground[orientation] = next;
            })
          }
        />
      </div>
      <Separator />
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Camera</h4>
        <Label>FOV</Label>
        <Input
          type="number"
          min={CAMERA_FOV_MIN}
          max={CAMERA_FOV_MAX}
          step={1}
          value={cam.fov}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            updateData((d) => {
              d.gameplay.camera[orientation].fov = Math.min(CAMERA_FOV_MAX, Math.max(CAMERA_FOV_MIN, n));
            });
          }}
        />
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">pos {axis}</Label>
              <Input
                type="number"
                step="0.1"
                value={cam.position[axis]}
                onChange={(e) =>
                  updateData((d) => {
                    d.gameplay.camera[orientation].position[axis] = Number(e.target.value);
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">look {axis}</Label>
              <Input
                type="number"
                step="0.1"
                value={cam.target[axis]}
                onChange={(e) =>
                  updateData((d) => {
                    d.gameplay.camera[orientation].target[axis] = Number(e.target.value);
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label>Lighting</Label>
        <div className="flex flex-wrap gap-1">
          {(["studio", "sunset", "overcast", "neon"] as LightingPreset[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={data.gameplay.lighting === p ? "default" : "outline"}
              onClick={() =>
                updateData((d) => {
                  d.gameplay.lighting = p;
                })
              }
            >
              {p}
            </Button>
          ))}
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Audio</h4>
        <AssetUrlField label="Music" kind="audio" accept="audio/*" value={data.gameplay.audio.musicUrl} onChange={(url) => updateData((d) => { d.gameplay.audio.musicUrl = url; })} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="play-from-start">Play from start screen</Label>
            <p className="text-[11px] leading-snug text-muted">Video audio is used instead while a start video is present.</p>
          </div>
          <Switch
            id="play-from-start"
            checked={Boolean(data.gameplay.audio.playFromStart)}
            onCheckedChange={(checked) =>
              updateData((d) => {
                d.gameplay.audio.playFromStart = checked;
              })
            }
          />
        </div>
        <AssetUrlField label="Tap" kind="audio" accept="audio/*" value={data.gameplay.audio.tapUrl} onChange={(url) => updateData((d) => { d.gameplay.audio.tapUrl = url; })} />
        <AssetUrlField label="Win" kind="audio" accept="audio/*" value={data.gameplay.audio.winUrl} onChange={(url) => updateData((d) => { d.gameplay.audio.winUrl = url; })} />
        <AssetUrlField label="Lose" kind="audio" accept="audio/*" value={data.gameplay.audio.loseUrl} onChange={(url) => updateData((d) => { d.gameplay.audio.loseUrl = url; })} />
      </div>

      {templateId === "stack-tower" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Stack Tower</h4>
          <Label>Blocks to win</Label>
          <Input type="number" value={data.gameplay.stackTower.blocksToWin} onChange={(e) => updateData((d) => { d.gameplay.stackTower.blocksToWin = Number(e.target.value) || 10; })} />
          <Label>Speed</Label>
          <Input type="number" step="0.1" value={data.gameplay.stackTower.speed} onChange={(e) => updateData((d) => { d.gameplay.stackTower.speed = Number(e.target.value) || 1; })} />
          <Label>Miss limit</Label>
          <Input type="number" value={data.gameplay.stackTower.missLimit} onChange={(e) => updateData((d) => { d.gameplay.stackTower.missLimit = Number(e.target.value) || 3; })} />
          <div className="flex gap-1">
            {data.gameplay.stackTower.palette.map((c, i) => (
              <input
                key={i}
                type="color"
                value={c}
                onChange={(e) =>
                  updateData((d) => {
                    d.gameplay.stackTower.palette[i] = e.target.value;
                  })
                }
              />
            ))}
          </div>
          <div className="flex gap-1">
            {(["matte", "glossy", "metallic"] as const).map((f) => (
              <Button key={f} size="sm" variant={data.gameplay.stackTower.materialFinish === f ? "default" : "outline"} onClick={() => updateData((d) => { d.gameplay.stackTower.materialFinish = f; })}>
                {f}
              </Button>
            ))}
          </div>
          <AssetUrlField label="Face texture" accept="image/*" value={data.gameplay.stackTower.faceTextureUrl} onChange={(url) => updateData((d) => { d.gameplay.stackTower.faceTextureUrl = url; })} />
        </>
      )}

      {templateId === "triple-match" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Triple Match</h4>
          <Label>Triples to win</Label>
          <Input type="number" value={data.gameplay.tripleMatch.triplesToWin} onChange={(e) => updateData((d) => { d.gameplay.tripleMatch.triplesToWin = Number(e.target.value) || 6; })} />
          <Label>Bar slots</Label>
          <Input type="number" value={data.gameplay.tripleMatch.barSlots} onChange={(e) => updateData((d) => { d.gameplay.tripleMatch.barSlots = Number(e.target.value) || 7; })} />
          <Label>Tray color</Label>
          <Input type="color" value={data.gameplay.tripleMatch.trayColor} onChange={(e) => updateData((d) => { d.gameplay.tripleMatch.trayColor = e.target.value; })} />
          <p className="text-[11px] text-muted">Item slots (library id or uploaded GLB URL)</p>
          {data.gameplay.tripleMatch.itemSlots.map((slot, i) => (
            <div key={i} className="space-y-1">
              <select
                className="h-8 w-full rounded-md border border-border bg-[#161821] text-xs"
                value={MATCH_ITEMS.some((m) => m.id === slot) ? slot : ""}
                onChange={(e) =>
                  updateData((d) => {
                    d.gameplay.tripleMatch.itemSlots[i] = e.target.value;
                  })
                }
              >
                <option value="">Custom URL</option>
                {MATCH_ITEMS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <AssetUrlField accept=".glb,.gltf,model/gltf-binary" kind="model" value={slot.startsWith("/") || slot.startsWith("http") ? slot : ""} onChange={(url) => updateData((d) => { d.gameplay.tripleMatch.itemSlots[i] = url; })} />
            </div>
          ))}
        </>
      )}

      {templateId === "lane-runner" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Lane Runner</h4>
          <Label>Win distance</Label>
          <Input type="number" value={data.gameplay.laneRunner.winDistance} onChange={(e) => updateData((d) => { d.gameplay.laneRunner.winDistance = Number(e.target.value) || 180; })} />
          <Label>Start speed</Label>
          <Input type="number" value={data.gameplay.laneRunner.startSpeed} onChange={(e) => updateData((d) => { d.gameplay.laneRunner.startSpeed = Number(e.target.value) || 8; })} />
          <Label>Lanes</Label>
          <Input type="number" min={3} max={5} value={data.gameplay.laneRunner.laneCount} onChange={(e) => updateData((d) => { d.gameplay.laneRunner.laneCount = Number(e.target.value) || 3; })} />
          <div className="flex gap-1">
            {(["desert", "city", "neon"] as const).map((t) => (
              <Button key={t} size="sm" variant={data.gameplay.laneRunner.environmentTheme === t ? "default" : "outline"} onClick={() => updateData((d) => { d.gameplay.laneRunner.environmentTheme = t; })}>
                {t}
              </Button>
            ))}
          </div>
          <AssetUrlField label="Character GLB" kind="model" accept=".glb,.gltf" value={data.gameplay.laneRunner.characterModelUrl.startsWith("/") || data.gameplay.laneRunner.characterModelUrl.startsWith("http") ? data.gameplay.laneRunner.characterModelUrl : ""} onChange={(url) => updateData((d) => { d.gameplay.laneRunner.characterModelUrl = url || "runner"; })} />
        </>
      )}

      {templateId === "parking-jam" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Parking Jam</h4>
          {(() => {
            const jam = data.gameplay.parkingJam;
            const rounds = jam.rounds.length
              ? jam.rounds
              : [{ gridCols: jam.gridCols, gridRows: jam.gridRows, movesLimit: jam.movesLimit, coins: 50, cars: jam.cars }];
            const roundIdx = Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
            const round = rounds[roundIdx];
            return (
              <>
                <Label>How many rounds</Label>
                <p className="text-[11px] text-muted">
                  Click a number to set the playable length. 4 means rounds 1–4 play in order.
                </p>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 9 }, (_, i) => {
                    const count = i + 1;
                    const included = count <= rounds.length;
                    const selected = count === rounds.length;
                    return (
                      <Button
                        key={count}
                        size="sm"
                        variant={selected ? "default" : included ? "secondary" : "outline"}
                        aria-pressed={included}
                        onClick={() => {
                          if (count === rounds.length) return;
                          const preview = Math.min(roundIdx, count - 1);
                          updateData((d) => {
                            const j = d.gameplay.parkingJam;
                            setParkingRoundCount(j, count);
                            syncParkingRound(j, preview);
                          });
                          setParkingRoundIndex(preview);
                        }}
                      >
                        {count}
                      </Button>
                    );
                  })}
                </div>
                <Label>Preview</Label>
                <p className="text-[11px] text-muted">Shows this round in the canvas. Does not change how many rounds play.</p>
                <div className="flex flex-wrap gap-1">
                  {rounds.map((_, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={i === roundIdx ? "default" : "outline"}
                      aria-current={i === roundIdx ? "true" : undefined}
                      onClick={() => setParkingRoundIndex(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Moves limit</Label>
                    <Input
                      type="number"
                      min={8}
                      max={80}
                      value={round.movesLimit}
                      onChange={(e) =>
                        patchParkingRound(updateData, roundIdx, (r) => {
                          r.movesLimit = clampInt(Number(e.target.value), 8, 80, 24);
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Coins</Label>
                    <Input
                      type="number"
                      min={0}
                      max={9999}
                      value={round.coins}
                      onChange={(e) =>
                        patchParkingRound(updateData, roundIdx, (r) => {
                          r.coins = clampInt(Number(e.target.value), 0, 9999, 50);
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Grid cols</Label>
                    <Input
                      type="number"
                      min={4}
                      max={8}
                      value={round.gridCols}
                      onChange={(e) =>
                        patchParkingRound(updateData, roundIdx, (r) => {
                          r.gridCols = clampInt(Number(e.target.value), 4, 8, 6);
                          r.cars = repairParkingCars(r.cars, r.gridCols, r.gridRows);
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Grid rows</Label>
                    <Input
                      type="number"
                      min={4}
                      max={8}
                      value={round.gridRows}
                      onChange={(e) =>
                        patchParkingRound(updateData, roundIdx, (r) => {
                          r.gridRows = clampInt(Number(e.target.value), 4, 8, 6);
                          r.cars = repairParkingCars(r.cars, r.gridCols, r.gridRows);
                        })
                      }
                    />
                  </div>
                </div>
              </>
            );
          })()}
          <Label>Car model</Label>
          <div className="flex flex-wrap gap-1">
            {VEHICLES.map((v) => (
              <Button
                key={v.id}
                size="sm"
                variant={data.gameplay.parkingJam.carModelUrl === v.id ? "default" : "outline"}
                onClick={() =>
                  updateData((d) => {
                    d.gameplay.parkingJam.carModelUrl = v.id;
                  })
                }
              >
                {v.name}
              </Button>
            ))}
          </div>
          <AssetUrlField
            label="Custom car GLB"
            kind="model"
            accept=".glb,.gltf,model/gltf-binary"
            value={
              data.gameplay.parkingJam.carModelUrl.startsWith("/") ||
              data.gameplay.parkingJam.carModelUrl.startsWith("http") ||
              data.gameplay.parkingJam.carModelUrl.startsWith("data:")
                ? data.gameplay.parkingJam.carModelUrl
                : ""
            }
            onChange={(url) =>
              updateData((d) => {
                d.gameplay.parkingJam.carModelUrl = url || "sedan";
              })
            }
          />
          <AssetUrlField
            label="Parking surface"
            accept="image/*"
            value={data.gameplay.parkingJam.lotTextureUrl}
            onChange={(url) => updateData((d) => { d.gameplay.parkingJam.lotTextureUrl = url; })}
          />
          <AssetUrlField
            label="Pavement rim"
            accept="image/*"
            value={data.gameplay.parkingJam.pavementTextureUrl}
            onChange={(url) => updateData((d) => { d.gameplay.parkingJam.pavementTextureUrl = url; })}
          />
          <AssetUrlField
            label="Grass"
            accept="image/*"
            value={data.gameplay.parkingJam.grassTextureUrl}
            onChange={(url) => updateData((d) => { d.gameplay.parkingJam.grassTextureUrl = url; })}
          />
          <p className="text-[11px] text-muted">Leave empty to keep the Kenney defaults. Uploads replace that layer only.</p>
          <AssetUrlField
            label="Coin icon"
            accept="image/*"
            value={data.gameplay.parkingJam.coinImageUrl}
            onChange={(url) => updateData((d) => { d.gameplay.parkingJam.coinImageUrl = url; })}
          />
          <p className="text-[11px] text-muted">Empty uses the default coin. Shown in the HUD and payout animation.</p>
          <p className="text-[11px] text-muted">Car colors</p>
          {(data.gameplay.parkingJam.rounds[Math.max(0, Math.min(parkingRoundIndex, data.gameplay.parkingJam.rounds.length - 1))]?.cars
            ?? data.gameplay.parkingJam.cars).map((car) => (
            <div key={car.id} className="flex items-center gap-2">
              <Label className="w-16 truncate text-xs">{car.isHero ? "Hero" : car.id}</Label>
              <input
                type="color"
                value={car.color}
                onChange={(e) =>
                  patchParkingRound(updateData, parkingRoundIndex, (r) => {
                    const target = r.cars.find((c) => c.id === car.id);
                    if (target) target.color = e.target.value;
                  })
                }
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ContentEditor({ element }: { element: PlayableElement }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  return (
    <div className="space-y-3 p-4">
      <h3 className="font-semibold">{element.name}</h3>
      {(element.type === "text" || element.type === "button" || element.type === "storeButton" || element.type === "starRating") && (
        <div>
          <Label>Text</Label>
          <Input value={element.content.text || ""} onChange={(e) => updateElement(element.id, (el) => { el.content.text = e.target.value; })} />
        </div>
      )}
      {(element.type === "text" || element.type === "starRating") && (
        <div>
          <Label>Color</Label>
          <Input type="color" value={element.content.color || "#ffffff"} onChange={(e) => updateElement(element.id, (el) => { el.content.color = e.target.value; })} />
        </div>
      )}
      {element.type === "image" && (
        <AssetUrlField label="Image" accept="image/*" value={element.content.imageUrl || ""} onChange={(url) => updateElement(element.id, (el) => { el.content.imageUrl = url; })} />
      )}
      {(element.type === "button" || element.type === "storeButton") && (
        <>
          <Label>Button color</Label>
          <Input type="color" value={element.style.backgroundColor || "#e07a3d"} onChange={(e) => updateElement(element.id, (el) => { el.style.backgroundColor = e.target.value; })} />
        </>
      )}
      {element.type === "timer" && (
        <>
          <Label>Duration (s)</Label>
          <Input type="number" value={element.content.durationSeconds || 30} onChange={(e) => updateElement(element.id, (el) => { el.content.durationSeconds = Number(e.target.value); })} />
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y", "width", "height"] as const).map((key) => {
          const orientation = useEditorStore.getState().orientation;
          const box = element.layout[orientation];
          return (
            <div key={key}>
              <Label className="capitalize">{key}</Label>
              <Input
                type="number"
                step="0.01"
                value={Number(box[key].toFixed(3))}
                onChange={(e) => {
                  const n = clamp01(Number(e.target.value));
                  useEditorStore.getState().updateElementLayout(element.id, orientation, { [key]: n });
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const stage = useEditorStore((s) => s.stage);
  const selected = useEditorStore((s) => s.getSelectedElement());
  const data = useEditorStore((s) => s.data);
  const orientation = useEditorStore((s) => s.orientation);
  const updateData = useEditorStore((s) => s.updateData);

  if (stage === "gameplay" && !selected) return <GameplaySettings />;
  if (selected) return <ContentEditor element={selected} />;

  const screen = stage === "start" ? data.startScreen : data.endScreen;
  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold">Background</h3>
      <BackgroundEditor
        background={screen.background}
        orientation={orientation}
        allowVideo
        allowTransparent
        videoUrl={screen.videoUrl}
        onChange={(next, nextVideo) =>
          updateData((draft) => {
            const target = stage === "start" ? draft.startScreen : draft.endScreen;
            target.background = next;
            if (typeof nextVideo === "string") target.videoUrl = nextVideo;
          })
        }
      />
    </div>
  );
}
