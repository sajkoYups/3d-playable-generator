"use client";

import { useEditorStore, useSelectedElement } from "@/features/editor/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AssetUrlField } from "@/features/editor/asset-url-field";
import { FieldHint, SoundsHintLabel } from "@/features/editor/field-hint";
import { ColorField } from "@/features/editor/color-field";
import { NumberField } from "@/features/editor/number-field";
import { CAMERA_FOV_MAX, CAMERA_FOV_MIN, END_POLICY_SLOT_ID, UNLOCK_COIN_SLOT_ID, UNLOCK_END_BG_SLOT_ID, UNLOCK_LINKS_SLOT_ID, UNLOCK_START_BG_SLOT_ID, is2DTemplate, isBrandSlotId, isFullBackgroundActive, isOverridableSlotId, type Background, type LaneRunnerConfig, type LaneRunnerRound, type LightingPreset, type ParkingJamConfig, type ParkingRound, type PlayableElement, type ProjectData, type StackTowerConfig, type StackTowerRound, type TowerDefenseConfig, type TowerDefenseRound, type TripleMatchConfig, type TripleMatchRound } from "@/types/project";
import { MATCH3_PIECE_META, defaultPieceImages, stampCoinImage } from "@/lib/project-defaults";
import { TemplateSlotUnlockControls } from "@/features/editor/template-slot-unlock-controls";
import { isPlayableTemplateLocked } from "@/features/editor/store";
import { MATCH_ITEMS, OBSTACLES, VEHICLES } from "@/lib/model-library";
import { ensureParkingRounds, repairParkingCars, setParkingRoundCount, syncParkingRound } from "@/playable-runtime/engines/parking-jam/layout";
import { ensureMatchRounds, propagateMatchFoods, setMatchRoundCount, syncMatchRound } from "@/playable-runtime/engines/triple-match/rounds";
import { ensureLaneRounds, propagateLaneWinDistance, setLaneRoundCount, syncLaneRound } from "@/playable-runtime/engines/lane-runner/rounds";
import { ensureTdRounds, setTdRoundCount } from "@/playable-runtime/engines/tower-defense/rounds";
import { ensureStackRounds, setStackRoundCount, syncStackRound } from "@/playable-runtime/engines/stack-tower/rounds";
import { ensureSolitaireRounds, setSolitaireRoundCount } from "@/playable-runtime/engines/solitaire/rounds";
import { ensureDominoRounds, setDominoRoundCount } from "@/playable-runtime/engines/domino/rounds";
import { ensureTappyRounds, setTappyRoundCount } from "@/playable-runtime/engines/tappy-plane/rounds";
import { ensureRacingRounds, setRacingRoundCount } from "@/playable-runtime/engines/racing-lap/rounds";
import { ensureShooterRounds, setShooterRoundCount } from "@/playable-runtime/engines/top-down-shooter/rounds";
import { ensureWaterSortRounds, setWaterSortRoundCount } from "@/playable-runtime/engines/water-sort/rounds";

function patchMatchRound(
  updateData: (updater: (draft: ProjectData) => void) => void,
  index: number,
  patch: (round: TripleMatchRound, cfg: TripleMatchConfig) => void,
) {
  updateData((d) => {
    const cfg = d.gameplay.tripleMatch;
    ensureMatchRounds(cfg);
    const i = Math.max(0, Math.min(index, cfg.rounds.length - 1));
    const round = cfg.rounds[i];
    if (!round) return;
    patch(round, cfg);
    syncMatchRound(cfg, i);
  });
}

function patchLaneRound(
  updateData: (updater: (draft: ProjectData) => void) => void,
  index: number,
  patch: (round: LaneRunnerRound, cfg: LaneRunnerConfig) => void,
) {
  updateData((d) => {
    const cfg = d.gameplay.laneRunner;
    ensureLaneRounds(cfg);
    const i = Math.max(0, Math.min(index, cfg.rounds.length - 1));
    const round = cfg.rounds[i];
    if (!round) return;
    patch(round, cfg);
    syncLaneRound(cfg, i);
  });
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

function patchTdRound(
  updateData: (updater: (draft: ProjectData) => void) => void,
  index: number,
  patch: (round: TowerDefenseRound, cfg: TowerDefenseConfig) => void,
) {
  updateData((d) => {
    const cfg = d.gameplay.towerDefense;
    ensureTdRounds(cfg);
    const i = Math.max(0, Math.min(index, cfg.rounds.length - 1));
    const round = cfg.rounds[i];
    if (!round) return;
    patch(round, cfg);
  });
}

function patchStackRound(
  updateData: (updater: (draft: ProjectData) => void) => void,
  index: number,
  patch: (round: StackTowerRound, cfg: StackTowerConfig) => void,
) {
  updateData((d) => {
    const cfg = d.gameplay.stackTower;
    ensureStackRounds(cfg);
    const i = Math.max(0, Math.min(index, cfg.rounds.length - 1));
    const round = cfg.rounds[i];
    if (!round) return;
    patch(round, cfg);
    syncStackRound(cfg, i);
  });
}

function RoundLengthPicker({
  count,
  preview,
  onCount,
  onPreview,
}: {
  count: number;
  preview: number;
  onCount: (count: number, preview: number) => void;
  onPreview: (index: number) => void;
}) {
  return (
    <>
      <Label>How many rounds</Label>
      <p className="text-[11px] text-muted">
        Click a number to set the playable length. 4 means rounds 1–4 play in order.
      </p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 9 }, (_, i) => {
          const n = i + 1;
          const included = n <= count;
          const selected = n === count;
          return (
            <Button
              key={n}
              size="sm"
              variant={selected ? "default" : included ? "secondary" : "outline"}
              aria-pressed={included}
              onClick={() => {
                if (n === count) return;
                onCount(n, Math.min(preview, n - 1));
              }}
            >
              {n}
            </Button>
          );
        })}
      </div>
      <Label>Preview</Label>
      <p className="text-[11px] text-muted">Shows this round in the canvas. Does not change how many rounds play.</p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: count }, (_, i) => (
          <Button
            key={i}
            size="sm"
            variant={i === preview ? "default" : "outline"}
            aria-current={i === preview ? "true" : undefined}
            onClick={() => onPreview(i)}
          >
            {i + 1}
          </Button>
        ))}
      </div>
    </>
  );
}

function BackgroundEditor({
  background,
  orientation,
  onChange,
  allowTransparent,
  allowVideo,
}: {
  background: Background;
  orientation: "portrait" | "landscape";
  onChange: (next: Background) => void;
  allowTransparent?: boolean;
  allowVideo?: boolean;
}) {
  const types = [
    "solid",
    "gradient",
    "image",
    ...(allowVideo ? (["video"] as const) : []),
    ...(allowTransparent ? (["transparent"] as const) : []),
  ] as const;
  const active = background.type;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {types.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={active === t ? "default" : "outline"}
            onClick={() => onChange({ ...background, type: t })}
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
          label={orientation === "portrait" ? "Portrait video" : "Landscape video"}
          kind="video"
          accept="video/*"
          value={
            orientation === "portrait"
              ? background.portraitVideoUrl || ""
              : background.landscapeVideoUrl || ""
          }
          onChange={(url) =>
            onChange(
              orientation === "portrait"
                ? { ...background, type: "video", portraitVideoUrl: url }
                : { ...background, type: "video", landscapeVideoUrl: url },
            )
          }
        />
      )}
    </div>
  );
}

function CoinIconField({ locked }: { locked?: boolean }) {
  const data = useEditorStore((s) => s.data);
  const updateData = useEditorStore((s) => s.updateData);
  const editorMode = useEditorStore((s) => s.editorMode);
  const brandId = useEditorStore((s) => s.brandId);
  const brandName = useEditorStore((s) => s.brandName);
  const unlockedSlotIds = useEditorStore((s) => s.unlockedSlotIds);
  const templateLinked = editorMode === "playable" && Boolean(brandId);
  const coinLocked =
    locked ??
    isPlayableTemplateLocked(editorMode, brandId, unlockedSlotIds, UNLOCK_COIN_SLOT_ID, "asset");
  const value =
    data.coinImageUrl ||
    data.gameplay.parkingJam.coinImageUrl ||
    data.gameplay.tripleMatch.coinImageUrl ||
    data.gameplay.laneRunner.coinImageUrl ||
    data.gameplay.towerDefense.coinImageUrl ||
    data.gameplay.stackTower.coinImageUrl ||
    data.gameplay.match3.coinImageUrl ||
    data.gameplay.waterSort.coinImageUrl ||
    data.gameplay.solitaire.coinImageUrl ||
    data.gameplay.domino.coinImageUrl ||
    data.gameplay.tappyPlane.coinImageUrl ||
    data.gameplay.racingLap.coinImageUrl ||
    data.gameplay.topDownShooter.coinImageUrl ||
    "";

  return (
    <div className="space-y-2">
      {templateLinked ? (
        <TemplateSlotUnlockControls slotId={UNLOCK_COIN_SLOT_ID} unlocked={unlockedSlotIds.includes(UNLOCK_COIN_SLOT_ID)} />
      ) : null}
      {coinLocked ? (
        <div className="space-y-1">
          <Label>Coin icon</Label>
          <div className="flex items-center gap-2 text-xs text-muted">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="h-8 w-8 rounded border border-border object-contain" />
            ) : null}
            <span>
              From {brandName || "the template"}.{" "}
              {brandId ? (
                <a href={`/templates/${brandId}`} className="text-accent underline">
                  Edit template
                </a>
              ) : null}
            </span>
          </div>
        </div>
      ) : (
        <>
          <AssetUrlField
            label="Coin icon"
            accept="image/*"
            value={value}
            onChange={(url) => updateData((d) => stampCoinImage(d, url))}
          />
          <p className="text-[11px] text-muted">
            Empty uses the default coin. Shown in the HUD and payout animation. Templates can set a per-geo coin.
          </p>
        </>
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
  const fullBg = data.gameplay.fullBackground;
  const fullBgOn = isFullBackgroundActive(fullBg);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-semibold">Gameplay</h3>
        <p className="text-xs text-muted">Engine is locked. Tune presentation and difficulty.</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">Full background</h4>
            <p className="text-[11px] leading-snug text-muted">
              Sits behind the game and HUD on the whole screen. Empty game pixels stay transparent so this image shows through.
            </p>
          </div>
          <Switch
            id="full-background"
            checked={fullBgOn}
            onCheckedChange={(checked) =>
              updateData((d) => {
                d.gameplay.fullBackground.enabled = checked;
              })
            }
          />
        </div>
        {fullBgOn ? (
          <>
            <AssetUrlField
              label={orientation === "portrait" ? "Portrait image" : "Landscape image"}
              accept="image/*"
              value={
                orientation === "portrait"
                  ? fullBg.portraitImageUrl || ""
                  : fullBg.landscapeImageUrl || ""
              }
              onChange={(url) =>
                updateData((d) => {
                  if (orientation === "portrait") d.gameplay.fullBackground.portraitImageUrl = url;
                  else d.gameplay.fullBackground.landscapeImageUrl = url;
                })
              }
            />
            <div className="flex flex-wrap gap-1">
              {(["cover", "contain", "stretch"] as const).map((fit) => (
                <Button
                  key={fit}
                  size="sm"
                  variant={fullBg.imageFit === fit ? "default" : "outline"}
                  onClick={() =>
                    updateData((d) => {
                      d.gameplay.fullBackground.imageFit = fit;
                    })
                  }
                >
                  {fit}
                </Button>
              ))}
            </div>
          </>
        ) : null}
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
      {is2DTemplate(templateId) && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Board background ({orientation})</h4>
            <p className="text-[11px] text-muted">
              {fullBgOn
                ? "Unused while Full background is on, so the image shows through the board."
                : "Drawn inside the gameplay area."}
            </p>
            <BackgroundEditor
              background={data.gameplay.background[orientation]}
              orientation={orientation}
              allowTransparent
              onChange={(next) =>
                updateData((draft) => {
                  draft.gameplay.background[orientation] = next;
                })
              }
            />
          </div>
        </>
      )}
      {!is2DTemplate(templateId) && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Camera</h4>
        <NumberField
          label="FOV"
          integer
          min={CAMERA_FOV_MIN}
          max={CAMERA_FOV_MAX}
          value={cam.fov}
          onChange={(n) =>
            updateData((d) => {
              d.gameplay.camera[orientation].fov = n;
            })
          }
        />
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} className="grid grid-cols-2 gap-2">
            <NumberField
              label={`pos ${axis}`}
              labelClassName="text-xs"
              step={0.1}
              value={cam.position[axis]}
              onChange={(n) =>
                updateData((d) => {
                  d.gameplay.camera[orientation].position[axis] = n;
                })
              }
            />
            <NumberField
              label={`look ${axis}`}
              labelClassName="text-xs"
              step={0.1}
              value={cam.target[axis]}
              onChange={(n) =>
                updateData((d) => {
                  d.gameplay.camera[orientation].target[axis] = n;
                })
              }
            />
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
        </>
      )}
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <h4 className="text-sm font-medium">Audio</h4>
          <FieldHint
            text={
              ["tower-defense", "triple-match", "parking-jam", "lane-runner", "stack-tower", "water-sort", "match-3", "solitaire", "tappy-plane", "dress-up"].includes(templateId)
                ? "Start and end screen sounds. In-game clips are under the game section below. First tap on the canvas unlocks audio."
                : "Start and end screen sounds. First tap on the canvas unlocks audio."
            }
          />
        </div>
        <AssetUrlField
          label="Music"
          hint="Background loop for the playable. Turn on Play from start to hear it on the first screen."
          kind="audio"
          accept="audio/*"
          value={data.gameplay.audio.musicUrl}
          onChange={(url) => updateData((d) => { d.gameplay.audio.musicUrl = url; })}
        />
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
        <AssetUrlField
          label="Tap"
          hint="Click sound for buttons on the start and end screens."
          kind="audio"
          accept="audio/*"
          value={data.gameplay.audio.tapUrl}
          onChange={(url) => updateData((d) => { d.gameplay.audio.tapUrl = url; })}
        />
        <AssetUrlField
          label="Win"
          hint={
            ["triple-match", "parking-jam", "water-sort", "match-3", "solitaire"].includes(templateId)
              ? "Final win screen after the last round. Round payouts use Round win under the game section."
              : "Plays on the win / end screen."
          }
          kind="audio"
          accept="audio/*"
          value={data.gameplay.audio.winUrl}
          onChange={(url) => updateData((d) => { d.gameplay.audio.winUrl = url; })}
        />
        <AssetUrlField
          label="Lose"
          hint="Plays on the fail / lose screen."
          kind="audio"
          accept="audio/*"
          value={data.gameplay.audio.loseUrl}
          onChange={(url) => updateData((d) => { d.gameplay.audio.loseUrl = url; })}
        />
      </div>

      {templateId !== "dress-up" && (
        <>
          <Separator />
          <CoinIconField />
        </>
      )}

      {templateId === "water-sort" && (() => {
        const cfg = data.gameplay.waterSort;
        const rounds = cfg.rounds.length
          ? cfg.rounds
          : [{ maxMoves: cfg.maxMoves || 40, coins: Math.round(cfg.rewardPerRound || 5), colorCount: 5 }];
        const roundIdx = Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
        const round = rounds[roundIdx];
        return (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Water Sort</h4>
          <RoundLengthPicker
            count={rounds.length}
            preview={roundIdx}
            onCount={(n, preview) => {
              updateData((d) => {
                setWaterSortRoundCount(d.gameplay.waterSort, n);
              });
              setParkingRoundIndex(preview);
            }}
            onPreview={setParkingRoundIndex}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Max moves"
              integer
              min={8}
              max={99}
              value={round.maxMoves}
              onChange={(n) =>
                updateData((d) => {
                  ensureWaterSortRounds(d.gameplay.waterSort);
                  d.gameplay.waterSort.rounds[roundIdx].maxMoves = n;
                })
              }
            />
            <NumberField
              label="Coins"
              integer
              min={0}
              max={9999}
              value={round.coins}
              onChange={(n) =>
                updateData((d) => {
                  ensureWaterSortRounds(d.gameplay.waterSort);
                  d.gameplay.waterSort.rounds[roundIdx].coins = n;
                })
              }
            />
            <NumberField
              label="Colors"
              integer
              min={2}
              max={5}
              value={round.colorCount}
              onChange={(n) =>
                updateData((d) => {
                  ensureWaterSortRounds(d.gameplay.waterSort);
                  d.gameplay.waterSort.rounds[roundIdx].colorCount = n;
                })
              }
            />
          </div>
          <p className="text-[11px] text-muted">
            Moves, coins, and how many tube colors this round uses. Preview switches the canvas to that round.
          </p>
          <div className="space-y-1">
            <Label>Reward prefix</Label>
            <Input
              value={data.gameplay.waterSort.rewardPrefix}
              onChange={(e) =>
                updateData((d) => {
                  d.gameplay.waterSort.rewardPrefix = e.target.value;
                })
              }
            />
            <p className="text-[11px] text-muted">Shown before the reward amount, for example $.</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Fail enabled</Label>
              <p className="text-[11px] text-muted">
                On = running out of moves ends the playable. Off = moves refill and you stay on the same board.
              </p>
            </div>
            <Switch
              checked={data.gameplay.waterSort.failEnabled}
              onCheckedChange={(v) =>
                updateData((d) => {
                  d.gameplay.waterSort.failEnabled = v;
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Show in HUD</Label>
            <p className="text-[11px] text-muted">
              {data.gameplay.waterSort.hudDisplay === "coins"
                ? "Coins hides remaining moves on the board. You still have a move limit. Use both while testing."
                : "Score shows remaining moves. Coins shows the payout. Both is easiest while testing."}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {(["score", "coins", "both"] as const).map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant={(data.gameplay.waterSort.hudDisplay || "both") === id ? "default" : "outline"}
                  className="h-8 capitalize"
                  onClick={() =>
                    updateData((d) => {
                      d.gameplay.waterSort.hudDisplay = id;
                    })
                  }
                >
                  {id}
                </Button>
              ))}
            </div>
          </div>
          <Label>Tube colors</Label>
          <div className="flex flex-wrap gap-1">
            {data.gameplay.waterSort.colors.map((c, i) => (
              <input
                key={i}
                type="color"
                value={c}
                className="h-8 w-8 cursor-pointer rounded border border-border bg-input"
                onChange={(e) =>
                  updateData((d) => {
                    d.gameplay.waterSort.colors[i] = e.target.value;
                  })
                }
              />
            ))}
          </div>
          <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
          {(
            [
              ["pourUrl", "Pour", "Plays when water pours into another tube."],
              ["denyUrl", "Deny", "Plays on an illegal pour. Empty uses a short beep."],
              ["payoutUrl", "Round win", "Plays when the board is solved. The shared Win clip is only the final end screen."],
            ] as const
          ).map(([key, label, hint]) => (
            <AssetUrlField
              key={key}
              label={label}
              hint={hint}
              kind="audio"
              accept="audio/*"
              value={data.gameplay.waterSort.sounds?.[key] ?? ""}
              onChange={(url) =>
                updateData((d) => {
                  d.gameplay.waterSort.sounds ??= { pourUrl: "", denyUrl: "", payoutUrl: "" };
                  d.gameplay.waterSort.sounds[key] = url;
                })
              }
            />
          ))}
        </>
        );
      })()}

      {templateId === "dress-up" && (
        <>
          <Separator />
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium">Fashion Dress-Up</h4>
              <p className="text-[11px] text-muted">
                Three rounds: dress, then shoes, then accessory. Each pick flies on and swaps to the
                matching character image. The tray hides after the last pick.
              </p>
            </div>
            <div className="space-y-2">
              {(
                [
                  ["promptOutfit", "Dress prompt"],
                  ["promptShoes", "Shoes prompt"],
                  ["promptAccessory", "Accessory prompt"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    value={data.gameplay.dressUp[key]}
                    onChange={(e) =>
                      updateData((d) => {
                        d.gameplay.dressUp[key] = e.target.value;
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <NumberField
              label="Reveal (ms)"
              integer
              min={200}
              max={4000}
              value={data.gameplay.dressUp.revealMs}
              onChange={(n) =>
                updateData((d) => {
                  d.gameplay.dressUp.revealMs = n;
                })
              }
            />
            <NumberField
              label="Hint delay (ms)"
              integer
              min={500}
              max={15000}
              step={100}
              value={data.gameplay.dressUp.hintDelayMs}
              onChange={(n) =>
                updateData((d) => {
                  d.gameplay.dressUp.hintDelayMs = n;
                })
              }
            />
            <div className="flex items-center justify-between gap-3">
              <Label>Hint hand</Label>
              <Switch
                checked={data.gameplay.dressUp.hintHandEnabled}
                onCheckedChange={(v) =>
                  updateData((d) => {
                    d.gameplay.dressUp.hintHandEnabled = v;
                  })
                }
              />
            </div>
            <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
            {(
              [
                ["selectUrl", "Select", "Plays when you tap an item in the tray."],
                ["dressUrl", "Dress", "Plays when the item flies onto the look."],
                ["revealUrl", "Reveal", "Wow sting when the final outfit lands. Shared Win is the end screen after that."],
              ] as const
            ).map(([key, label, hint]) => (
              <AssetUrlField
                key={key}
                label={label}
                hint={hint}
                kind="audio"
                accept="audio/*"
                value={data.gameplay.dressUp.sounds?.[key] ?? ""}
                onChange={(url) =>
                  updateData((d) => {
                    d.gameplay.dressUp.sounds ??= { selectUrl: "", dressUrl: "", revealUrl: "" };
                    d.gameplay.dressUp.sounds[key] = url;
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      {templateId === "match-3" && (
        <>
          <Separator />
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium">Match-3 rules</h4>
              <p className="text-[11px] text-muted">
                A round ends when you hit the score target, not after N matches. Three gems is 6
                points (2 per gem cleared); longer matches and cascades add more. After the last
                round, the end screen shows. Coins on the HUD are the payout, not the win
                condition.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <NumberField
                  label="Moves / round"
                  integer
                  min={1}
                  max={99}
                  value={data.gameplay.match3.movesPerRound}
                  onChange={(n) =>
                    updateData((d) => {
                      d.gameplay.match3.movesPerRound = n;
                    })
                  }
                />
                <p className="text-[11px] text-muted">
                  Successful matches you can make this round. Not how many you need to advance.
                  Invalid swaps do not count.
                </p>
              </div>
              <div className="space-y-1">
                <NumberField
                  label="Score target"
                  integer
                  min={1}
                  max={9999}
                  value={data.gameplay.match3.scoreTarget}
                  onChange={(n) =>
                    updateData((d) => {
                      d.gameplay.match3.scoreTarget = n;
                    })
                  }
                />
                <p className="text-[11px] text-muted">
                  Points to finish the round. A 3-match is 6, a 4-match is 8, a 5-match is 10.
                  Cascades count too. Always applies, even if the HUD is coins only. 80 is about
                  fourteen 3-matches.
                </p>
              </div>
              <div className="space-y-1">
                <NumberField
                  label="Rounds to win"
                  integer
                  min={1}
                  max={20}
                  value={data.gameplay.match3.roundsToWin}
                  onChange={(n) =>
                    updateData((d) => {
                      d.gameplay.match3.roundsToWin = n;
                    })
                  }
                />
                <p className="text-[11px] text-muted">
                  How many rounds before the end screen (R1/2, then R2/2, then end).
                </p>
              </div>
              <div className="space-y-1">
                <NumberField
                  label="Reward / round"
                  min={0}
                  max={9999}
                  value={data.gameplay.match3.rewardPerRound}
                  onChange={(n) =>
                    updateData((d) => {
                      d.gameplay.match3.rewardPerRound = n;
                    })
                  }
                />
                <p className="text-[11px] text-muted">
                  Money added to the HUD when a round ends (for example $5).
                </p>
              </div>
              <div className="space-y-1">
                <Label>Reward prefix</Label>
                <Input
                  value={data.gameplay.match3.rewardPrefix}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.match3.rewardPrefix = e.target.value;
                    })
                  }
                />
                <p className="text-[11px] text-muted">Shown before the reward amount, for example $.</p>
              </div>
              <div className="space-y-1">
                <NumberField
                  label="Hint delay (ms)"
                  integer
                  min={500}
                  max={15000}
                  step={100}
                  value={data.gameplay.match3.hintDelayMs}
                  onChange={(n) =>
                    updateData((d) => {
                      d.gameplay.match3.hintDelayMs = n;
                    })
                  }
                />
                <p className="text-[11px] text-muted">
                  Idle time before the animated hand shows a valid swap in preview and export.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Fail enabled</Label>
                <p className="text-[11px] text-muted">
                  On = running out of moves ends the round even if you are under the score target.
                  Off = moves refill and you stay on the same round until you hit the score.
                </p>
              </div>
              <Switch
                checked={data.gameplay.match3.failEnabled}
                onCheckedChange={(v) =>
                  updateData((d) => {
                    d.gameplay.match3.failEnabled = v;
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Tutorial hand</Label>
                <p className="text-[11px] text-muted">Animated hint in preview and export.</p>
              </div>
              <Switch
                checked={data.gameplay.match3.hintHandEnabled}
                onCheckedChange={(v) =>
                  updateData((d) => {
                    d.gameplay.match3.hintHandEnabled = v;
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Show in HUD</Label>
              <p className="text-[11px] text-muted">
                {data.gameplay.match3.hudDisplay === "coins"
                  ? "Coins hides score and remaining moves on the board. You still need the score target to finish the round. Use both while testing."
                  : "Score shows points. Coins shows the payout. Both is easiest while testing."}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {(["score", "coins", "both"] as const).map((id) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={data.gameplay.match3.hudDisplay === id ? "default" : "outline"}
                    className="h-8 capitalize"
                    onClick={() =>
                      updateData((d) => {
                        d.gameplay.match3.hudDisplay = id;
                      })
                    }
                  >
                    {id}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Transparent HUD bar</Label>
                <p className="text-[11px] text-muted">Hide the dark strip behind chips.</p>
              </div>
              <Switch
                checked={data.gameplay.match3.hudTransparent}
                onCheckedChange={(v) =>
                  updateData((d) => {
                    d.gameplay.match3.hudTransparent = v;
                  })
                }
              />
            </div>
            {data.gameplay.match3.hudDisplay !== "coins" && (
              <>
                <div className="space-y-1">
                  <Label>Score label</Label>
                  <Input
                    value={data.gameplay.match3.scoreLabel}
                    onChange={(e) =>
                      updateData((d) => {
                        d.gameplay.match3.scoreLabel = e.target.value;
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Score chip bg</Label>
                    <Input
                      type="color"
                      value={data.gameplay.match3.scoreChipBg || "#1e293b"}
                      onChange={(e) =>
                        updateData((d) => {
                          d.gameplay.match3.scoreChipBg = e.target.value;
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Score text</Label>
                    <Input
                      type="color"
                      value={data.gameplay.match3.scoreChipText || "#f8fafc"}
                      onChange={(e) =>
                        updateData((d) => {
                          d.gameplay.match3.scoreChipText = e.target.value;
                        })
                      }
                    />
                  </div>
                </div>
              </>
            )}
            {data.gameplay.match3.hudDisplay !== "score" && (
              <div className="space-y-1">
                <Label>Reward text</Label>
                <Input
                  type="color"
                  value={data.gameplay.match3.rewardTextColor || "#fbbf24"}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.match3.rewardTextColor = e.target.value;
                    })
                  }
                />
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Piece images</h4>
            <p className="text-[11px] text-muted">Empty slots fall back to a colored gem.</p>
            {MATCH3_PIECE_META.map((meta, index) => (
              <div key={meta.label} className="space-y-1 rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: meta.color }} />
                  <Label className="text-xs">{meta.label}</Label>
                </div>
                <AssetUrlField
                  label=""
                  accept="image/*"
                  value={data.gameplay.pieceImages[index] || ""}
                  onChange={(url) =>
                    updateData((d) => {
                      const next = [...(d.gameplay.pieceImages || defaultPieceImages())];
                      while (next.length < 5) next.push("");
                      next[index] = url;
                      d.gameplay.pieceImages = next.slice(0, 5);
                    })
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() =>
                    updateData((d) => {
                      const next = [...(d.gameplay.pieceImages || defaultPieceImages())];
                      while (next.length < 5) next.push("");
                      next[index] = meta.url;
                      d.gameplay.pieceImages = next.slice(0, 5);
                    })
                  }
                >
                  Reset default
                </Button>
              </div>
            ))}
          </div>
          <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
          {(
            [
              ["moveUrl", "Swap", "Plays when two adjacent gems swap."],
              ["matchUrl", "Match", "Plays when gems clear, including cascades."],
              ["denyUrl", "Deny", "Plays when a swap has no match and reverses. Empty uses a short beep."],
              ["payoutUrl", "Round win", "Plays when the score target is hit. The shared Win clip is only the final end screen."],
            ] as const
          ).map(([key, label, hint]) => (
            <AssetUrlField
              key={key}
              label={label}
              hint={hint}
              kind="audio"
              accept="audio/*"
              value={data.gameplay.match3.sounds?.[key] ?? ""}
              onChange={(url) =>
                updateData((d) => {
                  d.gameplay.match3.sounds ??= { moveUrl: "", matchUrl: "", denyUrl: "", payoutUrl: "" };
                  d.gameplay.match3.sounds[key] = url;
                })
              }
            />
          ))}
        </>
      )}

      {templateId === "solitaire" && (() => {
        const cfg = data.gameplay.solitaire;
        const rounds = cfg.rounds.length ? cfg.rounds : [{ cardsToWin: 13, tableauPiles: 7, coins: 40 }];
        const roundIdx = Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
        const round = rounds[roundIdx];
        return (
          <>
            <Separator />
            <h4 className="text-sm font-medium">Solitaire</h4>
            <p className="text-[11px] text-muted">Klondike: always 7 columns and 4 foundations. Draw-1 stock. Ace through King by suit. Drag cards or tap to send an Ace up.</p>
            <RoundLengthPicker
              count={rounds.length}
              preview={roundIdx}
              onCount={(n, preview) => {
                updateData((d) => {
                  setSolitaireRoundCount(d.gameplay.solitaire, n);
                });
                setParkingRoundIndex(preview);
              }}
              onPreview={setParkingRoundIndex}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Cards to win" integer min={4} max={52} value={round.cardsToWin} onChange={(n) => updateData((d) => { ensureSolitaireRounds(d.gameplay.solitaire); d.gameplay.solitaire.rounds[roundIdx].cardsToWin = n; })} />
              <NumberField label="Coins" integer min={0} max={9999} value={round.coins} onChange={(n) => updateData((d) => { ensureSolitaireRounds(d.gameplay.solitaire); d.gameplay.solitaire.rounds[roundIdx].coins = n; })} />
              <NumberField label="Hint delay (ms)" integer min={500} max={15000} step={100} value={cfg.hintDelayMs} onChange={(n) => updateData((d) => { d.gameplay.solitaire.hintDelayMs = n; })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Fail enabled</Label>
              <Switch checked={cfg.failEnabled} onCheckedChange={(v) => updateData((d) => { d.gameplay.solitaire.failEnabled = v; })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Tutorial hand</Label>
              <Switch checked={cfg.hintHandEnabled} onCheckedChange={(v) => updateData((d) => { d.gameplay.solitaire.hintHandEnabled = v; })} />
            </div>
            <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
            {(
              [
                ["flipUrl", "Flip", "Plays when you draw from the stock, recycle, or reveal a face-down card."],
                ["moveUrl", "Move", "Plays when a stack lands on the tableau."],
                ["placeUrl", "Place", "Plays when a card is placed on a foundation."],
                ["payoutUrl", "Round win", "Plays when the round is cleared. The shared Win clip is only the final end screen."],
              ] as const
            ).map(([key, label, hint]) => (
              <AssetUrlField
                key={key}
                label={label}
                hint={hint}
                kind="audio"
                accept="audio/*"
                value={cfg.sounds?.[key] ?? ""}
                onChange={(url) =>
                  updateData((d) => {
                    d.gameplay.solitaire.sounds ??= { flipUrl: "", moveUrl: "", placeUrl: "", payoutUrl: "" };
                    d.gameplay.solitaire.sounds[key] = url;
                  })
                }
              />
            ))}
          </>
        );
      })()}

      {templateId === "domino" && (() => {
        const cfg = data.gameplay.domino;
        const rounds = cfg.rounds.length ? cfg.rounds : [{ handSize: 7, playsToWin: 7, coins: 40 }];
        const roundIdx = Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
        const round = rounds[roundIdx];
        return (
          <>
            <Separator />
            <h4 className="text-sm font-medium">Domino</h4>
            <p className="text-[11px] text-muted">Play against the computer. Select a tile, then tap the highlighted domino. The round ends when either side cannot play. Whoever has fewer tiles left wins the round&apos;s coins.</p>
            <RoundLengthPicker
              count={rounds.length}
              preview={roundIdx}
              onCount={(n, preview) => {
                updateData((d) => { setDominoRoundCount(d.gameplay.domino, n); });
                setParkingRoundIndex(preview);
              }}
              onPreview={setParkingRoundIndex}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Hand size" integer min={3} max={10} value={round.handSize} onChange={(n) => updateData((d) => { ensureDominoRounds(d.gameplay.domino); d.gameplay.domino.rounds[roundIdx].handSize = n; })} />
              <NumberField label="Coins" integer min={0} max={9999} value={round.coins} onChange={(n) => updateData((d) => { ensureDominoRounds(d.gameplay.domino); d.gameplay.domino.rounds[roundIdx].coins = n; })} />
              <NumberField label="Hint delay (ms)" integer min={500} max={15000} step={100} value={cfg.hintDelayMs} onChange={(n) => updateData((d) => { d.gameplay.domino.hintDelayMs = n; })} />
            </div>
            <div>
              <Label>Your turn</Label>
              <Input
                value={cfg.yourTurnMessage ?? "Your turn — select a tile"}
                maxLength={80}
                onChange={(e) => updateData((d) => { d.gameplay.domino.yourTurnMessage = e.target.value; })}
              />
            </div>
            <div>
              <Label>Turn passed</Label>
              <Input
                value={cfg.passMessage ?? "Turn passed"}
                maxLength={80}
                onChange={(e) => updateData((d) => { d.gameplay.domino.passMessage = e.target.value; })}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label>Turn speed</Label>
                <span className="text-[11px] text-muted">{(2 / (cfg.turnSpeed || 1)).toFixed(1)}s</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">Slow</span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  aria-label="Turn speed"
                  value={cfg.turnSpeed ?? 1}
                  className="h-1.5 w-full cursor-pointer accent-amber-400"
                  onChange={(e) => updateData((d) => { d.gameplay.domino.turnSpeed = Number(e.target.value); })}
                />
                <span className="text-[10px] text-muted">Fast</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Fail enabled</Label>
              <Switch checked={cfg.failEnabled} onCheckedChange={(v) => updateData((d) => { d.gameplay.domino.failEnabled = v; })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Tutorial hand</Label>
              <Switch checked={cfg.hintHandEnabled} onCheckedChange={(v) => updateData((d) => { d.gameplay.domino.hintHandEnabled = v; })} />
            </div>
          </>
        );
      })()}

      {templateId === "tappy-plane" && (() => {
        const cfg = data.gameplay.tappyPlane;
        const rounds = cfg.rounds.length ? cfg.rounds : [{ gapsToWin: 5, speed: 1.5, gapSize: 0.42, coins: 40 }];
        const roundIdx = cfg.endless ? 0 : Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
        const round = rounds[roundIdx];
        return (
          <>
            <Separator />
            <h4 className="text-sm font-medium">Tappy Plane</h4>
            <p className="text-[11px] text-muted">Tap to flap through rock gaps. A hand hints the first tap.</p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Endless</Label>
                <p className="text-[11px] text-muted">One continuous round. Score until you crash.</p>
              </div>
              <Switch checked={Boolean(cfg.endless)} onCheckedChange={(v) => updateData((d) => { d.gameplay.tappyPlane.endless = v; })} />
            </div>
            {!cfg.endless && (
              <RoundLengthPicker
                count={rounds.length}
                preview={roundIdx}
                onCount={(n, preview) => {
                  updateData((d) => { setTappyRoundCount(d.gameplay.tappyPlane, n); });
                  setParkingRoundIndex(preview);
                }}
                onPreview={setParkingRoundIndex}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              {!cfg.endless && (
                <NumberField label="Gaps to win" integer min={2} max={20} value={round.gapsToWin} onChange={(n) => updateData((d) => { ensureTappyRounds(d.gameplay.tappyPlane); d.gameplay.tappyPlane.rounds[roundIdx].gapsToWin = n; })} />
              )}
              <NumberField label="Coins" integer min={0} max={9999} value={round.coins} onChange={(n) => updateData((d) => { ensureTappyRounds(d.gameplay.tappyPlane); d.gameplay.tappyPlane.rounds[roundIdx].coins = n; })} />
              <NumberField label="Speed" min={0.6} max={4} step={0.05} value={round.speed} onChange={(n) => updateData((d) => { ensureTappyRounds(d.gameplay.tappyPlane); d.gameplay.tappyPlane.rounds[roundIdx].speed = n; })} />
              <NumberField label="Gap size" min={0.22} max={0.7} step={0.01} value={round.gapSize} onChange={(n) => updateData((d) => { ensureTappyRounds(d.gameplay.tappyPlane); d.gameplay.tappyPlane.rounds[roundIdx].gapSize = n; })} />
              <NumberField label="Hint delay (ms)" integer min={500} max={15000} step={100} value={cfg.hintDelayMs} onChange={(n) => updateData((d) => { d.gameplay.tappyPlane.hintDelayMs = n; })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Fail enabled</Label>
              <Switch checked={cfg.failEnabled} onCheckedChange={(v) => updateData((d) => { d.gameplay.tappyPlane.failEnabled = v; })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Tutorial hand</Label>
              <Switch checked={cfg.hintHandEnabled} onCheckedChange={(v) => updateData((d) => { d.gameplay.tappyPlane.hintHandEnabled = v; })} />
            </div>
            <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
            {(
              [
                ["engineUrl", "Engine", "Quiet plane loop while flying. Starts on the first flap."],
                ["flapUrl", "Flap", "Plays on each tap. Leave empty for the built-in swoosh."],
                ["coinUrl", "Coin", "Plays when a gap coin is collected."],
                ["crashUrl", "Crash", "Plays on impact. The shared Lose clip is the fail screen after that."],
              ] as const
            ).map(([key, label, hint]) => (
              <AssetUrlField
                key={key}
                label={label}
                hint={hint}
                kind="audio"
                accept="audio/*"
                value={cfg.sounds?.[key] ?? ""}
                onChange={(url) =>
                  updateData((d) => {
                    d.gameplay.tappyPlane.sounds ??= { engineUrl: "", flapUrl: "", coinUrl: "", crashUrl: "" };
                    d.gameplay.tappyPlane.sounds[key] = url;
                  })
                }
              />
            ))}
          </>
        );
      })()}

      {templateId === "racing-lap" && (() => {
        const cfg = data.gameplay.racingLap;
        const rounds = cfg.rounds.length ? cfg.rounds : [{ lapsToWin: 1, speed: 1.4, coins: 40 }];
        const roundIdx = Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
        const round = rounds[roundIdx];
        return (
          <>
            <Separator />
            <h4 className="text-sm font-medium">Racing Lap</h4>
            <p className="text-[11px] text-muted">Left joystick steers. Auto-throttle. Stay on the oval.</p>
            <RoundLengthPicker
              count={rounds.length}
              preview={roundIdx}
              onCount={(n, preview) => {
                updateData((d) => { setRacingRoundCount(d.gameplay.racingLap, n); });
                setParkingRoundIndex(preview);
              }}
              onPreview={setParkingRoundIndex}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Laps to win" integer min={1} max={5} value={round.lapsToWin} onChange={(n) => updateData((d) => { ensureRacingRounds(d.gameplay.racingLap); d.gameplay.racingLap.rounds[roundIdx].lapsToWin = n; })} />
              <NumberField label="Coins" integer min={0} max={9999} value={round.coins} onChange={(n) => updateData((d) => { ensureRacingRounds(d.gameplay.racingLap); d.gameplay.racingLap.rounds[roundIdx].coins = n; })} />
              <NumberField label="Speed" min={0.6} max={4} step={0.05} value={round.speed} onChange={(n) => updateData((d) => { ensureRacingRounds(d.gameplay.racingLap); d.gameplay.racingLap.rounds[roundIdx].speed = n; })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Fail if off track</Label>
              <Switch checked={cfg.failEnabled} onCheckedChange={(v) => updateData((d) => { d.gameplay.racingLap.failEnabled = v; })} />
            </div>
          </>
        );
      })()}

      {templateId === "top-down-shooter" && (() => {
        const cfg = data.gameplay.topDownShooter;
        const rounds = cfg.rounds.length ? cfg.rounds : [{ enemyCount: 4, hpScale: 1, speedScale: 1, coins: 40 }];
        const roundIdx = Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
        const round = rounds[roundIdx];
        return (
          <>
            <Separator />
            <h4 className="text-sm font-medium">Top-down Shooter</h4>
            <p className="text-[11px] text-muted">Joystick to move. Auto-fires at the nearest enemy.</p>
            <RoundLengthPicker
              count={rounds.length}
              preview={roundIdx}
              onCount={(n, preview) => {
                updateData((d) => { setShooterRoundCount(d.gameplay.topDownShooter, n); });
                setParkingRoundIndex(preview);
              }}
              onPreview={setParkingRoundIndex}
            />
            <NumberField label="Lives" integer min={1} max={9} value={cfg.lives} onChange={(n) => updateData((d) => { d.gameplay.topDownShooter.lives = n; })} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Enemies" integer min={1} max={20} value={round.enemyCount} onChange={(n) => updateData((d) => { ensureShooterRounds(d.gameplay.topDownShooter); d.gameplay.topDownShooter.rounds[roundIdx].enemyCount = n; })} />
              <NumberField label="Coins" integer min={0} max={9999} value={round.coins} onChange={(n) => updateData((d) => { ensureShooterRounds(d.gameplay.topDownShooter); d.gameplay.topDownShooter.rounds[roundIdx].coins = n; })} />
              <NumberField label="HP scale" min={0.4} max={5} step={0.05} value={round.hpScale} onChange={(n) => updateData((d) => { ensureShooterRounds(d.gameplay.topDownShooter); d.gameplay.topDownShooter.rounds[roundIdx].hpScale = n; })} />
              <NumberField label="Speed scale" min={0.4} max={3} step={0.05} value={round.speedScale} onChange={(n) => updateData((d) => { ensureShooterRounds(d.gameplay.topDownShooter); d.gameplay.topDownShooter.rounds[roundIdx].speedScale = n; })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Fail enabled</Label>
              <Switch checked={cfg.failEnabled} onCheckedChange={(v) => updateData((d) => { d.gameplay.topDownShooter.failEnabled = v; })} />
            </div>
          </>
        );
      })()}

      {templateId === "stack-tower" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Stack Tower</h4>
          {(() => {
            const tower = data.gameplay.stackTower;
            const rounds = tower.rounds.length
              ? tower.rounds
              : [{
                  blocksToWin: tower.blocksToWin,
                  speed: tower.speed,
                  speedRamp: tower.speedRamp,
                  missLimit: tower.missLimit,
                  coins: 40,
                }];
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
                            const cfg = d.gameplay.stackTower;
                            setStackRoundCount(cfg, count);
                            syncStackRound(cfg, preview);
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
                  <NumberField
                    label="Blocks to win"
                    integer
                    min={3}
                    max={40}
                    value={round.blocksToWin}
                    onChange={(n) =>
                      patchStackRound(updateData, roundIdx, (r) => {
                        r.blocksToWin = n;
                      })
                    }
                  />
                  <NumberField
                    label="Coins"
                    integer
                    min={0}
                    max={9999}
                    value={round.coins}
                    onChange={(n) =>
                      patchStackRound(updateData, roundIdx, (r) => {
                        r.coins = n;
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Speed"
                    min={0.4}
                    max={4}
                    step={0.1}
                    value={round.speed}
                    onChange={(n) =>
                      patchStackRound(updateData, roundIdx, (r) => {
                        r.speed = n;
                      })
                    }
                  />
                  <NumberField
                    label="Speed ramp"
                    min={0}
                    max={0.4}
                    step={0.01}
                    value={round.speedRamp}
                    onChange={(n) =>
                      patchStackRound(updateData, roundIdx, (r) => {
                        r.speedRamp = n;
                      })
                    }
                  />
                </div>
                <NumberField
                  label="Miss limit"
                  integer
                  min={1}
                  max={8}
                  value={round.missLimit}
                  onChange={(n) =>
                    patchStackRound(updateData, roundIdx, (r) => {
                      r.missLimit = n;
                    })
                  }
                />
                <div className="flex gap-1">
                  {tower.palette.map((c, i) => (
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
                    <Button key={f} size="sm" variant={tower.materialFinish === f ? "default" : "outline"} onClick={() => updateData((d) => { d.gameplay.stackTower.materialFinish = f; })}>
                      {f}
                    </Button>
                  ))}
                </div>
                <AssetUrlField label="Face texture" accept="image/*" value={tower.faceTextureUrl} onChange={(url) => updateData((d) => { d.gameplay.stackTower.faceTextureUrl = url; })} />
                <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
                <AssetUrlField
                  label="Move"
                  hint="Plays when a slab is placed. Leave empty for the built-in swoosh."
                  kind="audio"
                  accept="audio/*"
                  value={tower.sounds?.moveUrl ?? ""}
                  onChange={(url) =>
                    updateData((d) => {
                      d.gameplay.stackTower.sounds ??= { moveUrl: "" };
                      d.gameplay.stackTower.sounds.moveUrl = url;
                    })
                  }
                />
              </>
            );
          })()}
        </>
      )}

      {templateId === "triple-match" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Triple Stack 3D</h4>
          {(() => {
            const match = data.gameplay.tripleMatch;
            const rounds = match.rounds.length
              ? match.rounds
              : [{
                  itemSlots: match.itemSlots,
                  trayColor: match.trayColor,
                  barSlots: match.barSlots,
                  triplesToWin: match.triplesToWin,
                  coins: 50,
                }];
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
                            const cfg = d.gameplay.tripleMatch;
                            setMatchRoundCount(cfg, count);
                            syncMatchRound(cfg, preview);
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
                  <NumberField
                    label="Triples to win"
                    integer
                    min={1}
                    max={30}
                    value={round.triplesToWin}
                    onChange={(n) =>
                      patchMatchRound(updateData, roundIdx, (r) => {
                        r.triplesToWin = n;
                      })
                    }
                  />
                  <NumberField
                    label="Coins"
                    integer
                    min={0}
                    max={9999}
                    value={round.coins}
                    onChange={(n) =>
                      patchMatchRound(updateData, roundIdx, (r) => {
                        r.coins = n;
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Bar slots"
                    integer
                    min={5}
                    max={10}
                    value={round.barSlots}
                    onChange={(n) =>
                      patchMatchRound(updateData, roundIdx, (r) => {
                        r.barSlots = n;
                      })
                    }
                  />
                  <div>
                    <Label>Tray color</Label>
                    <Input
                      type="color"
                      value={round.trayColor}
                      onChange={(e) =>
                        patchMatchRound(updateData, roundIdx, (r) => {
                          r.trayColor = e.target.value;
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted">
                  These four foods are used in every round. Tap one — it flies into a glowing tray slot. Three of a kind clears. Later rounds ask for more triples.
                </p>
                {match.itemSlots.map((slot, i) => (
                  <div key={i} className="space-y-1">
                    <select
                      className="h-8 w-full rounded-md border border-border bg-input text-xs"
                      value={MATCH_ITEMS.some((m) => m.id === slot) ? slot : ""}
                      onChange={(e) =>
                        updateData((d) => {
                          const cfg = d.gameplay.tripleMatch;
                          ensureMatchRounds(cfg);
                          cfg.itemSlots[i] = e.target.value;
                          propagateMatchFoods(cfg);
                        })
                      }
                    >
                      <option value="">Custom URL</option>
                      {MATCH_ITEMS.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <AssetUrlField
                      accept=".glb,.gltf,model/gltf-binary"
                      kind="model"
                      value={slot.startsWith("/") || slot.startsWith("http") ? slot : ""}
                      onChange={(url) =>
                        updateData((d) => {
                          const cfg = d.gameplay.tripleMatch;
                          ensureMatchRounds(cfg);
                          cfg.itemSlots[i] = url;
                          propagateMatchFoods(cfg);
                        })
                      }
                    />
                  </div>
                ))}
                <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
                {(
                  [
                    ["ambienceUrl", "Background", "Loop while the board is on screen. Leave empty for the built-in restaurant ambience."],
                    ["moveUrl", "Move", "Plays when a piece is picked up or dropped."],
                    ["matchUrl", "Match", "Plays when three matching items clear."],
                    ["payoutUrl", "Round win", "Plays when a round is completed. The shared Win clip is only the final end screen."],
                  ] as const
                ).map(([key, label, hint]) => (
                  <AssetUrlField
                    key={key}
                    label={label}
                    hint={hint}
                    kind="audio"
                    accept="audio/*"
                    value={match.sounds?.[key] ?? ""}
                    onChange={(url) =>
                      updateData((d) => {
                        d.gameplay.tripleMatch.sounds ??= {
                          ambienceUrl: "",
                          moveUrl: "",
                          matchUrl: "",
                          payoutUrl: "",
                        };
                        d.gameplay.tripleMatch.sounds[key] = url;
                      })
                    }
                  />
                ))}
              </>
            );
          })()}
        </>
      )}

      {templateId === "lane-runner" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Endless Car Driving</h4>
          {(() => {
            const runner = data.gameplay.laneRunner;
            const rounds = runner.rounds.length
              ? runner.rounds
              : [{
                  winDistance: runner.winDistance,
                  startSpeed: runner.startSpeed,
                  speedRamp: runner.speedRamp,
                  coins: 50,
                }];
            const roundIdx = Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
            const round = rounds[roundIdx];
            const trafficOptions = [...VEHICLES.filter((v) => v.id !== "sedan"), ...OBSTACLES.filter((o) => o.id === "cone")];
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
                            const cfg = d.gameplay.laneRunner;
                            setLaneRoundCount(cfg, count);
                            syncLaneRound(cfg, preview);
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
                  <NumberField
                    label="Win distance"
                    min={40}
                    max={800}
                    value={round.winDistance}
                    onChange={(n) =>
                      updateData((d) => {
                        propagateLaneWinDistance(d.gameplay.laneRunner, n);
                      })
                    }
                  />
                  <NumberField
                    label="Coins"
                    integer
                    min={0}
                    max={9999}
                    value={round.coins}
                    onChange={(n) =>
                      patchLaneRound(updateData, roundIdx, (r) => {
                        r.coins = n;
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Start speed"
                    min={4}
                    max={20}
                    step={0.5}
                    value={round.startSpeed}
                    onChange={(n) =>
                      patchLaneRound(updateData, roundIdx, (r) => {
                        r.startSpeed = n;
                      })
                    }
                  />
                  <NumberField
                    label="Speed ramp"
                    min={0}
                    max={4}
                    step={0.1}
                    value={round.speedRamp}
                    onChange={(n) =>
                      patchLaneRound(updateData, roundIdx, (r) => {
                        r.speedRamp = n;
                      })
                    }
                  />
                </div>
                <div>
                  <NumberField
                    label="Lane switch speed"
                    min={4}
                    max={24}
                    step={1}
                    value={runner.laneSwitchSpeed ?? 10}
                    onChange={(n) =>
                      updateData((d) => {
                        d.gameplay.laneRunner.laneSwitchSpeed = n;
                      })
                    }
                  />
                  <p className="text-[11px] text-muted">How fast the car slides left and right when you swipe (higher = snappier).</p>
                </div>
                <NumberField
                  label="Lanes"
                  integer
                  min={3}
                  max={5}
                  value={runner.laneCount}
                  onChange={(n) =>
                    updateData((d) => {
                      d.gameplay.laneRunner.laneCount = n;
                    })
                  }
                />
                <Label>Theme</Label>
                <div className="flex gap-1">
                  {(["desert", "city", "neon"] as const).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={runner.environmentTheme === t ? "default" : "outline"}
                      onClick={() => updateData((d) => { d.gameplay.laneRunner.environmentTheme = t; })}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
                <Label>Player car</Label>
                <div className="flex flex-wrap gap-1">
                  {VEHICLES.map((v) => (
                    <Button
                      key={v.id}
                      size="sm"
                      variant={runner.characterModelUrl === v.id ? "default" : "outline"}
                      onClick={() =>
                        updateData((d) => {
                          d.gameplay.laneRunner.characterModelUrl = v.id;
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
                    runner.characterModelUrl.startsWith("/") ||
                    runner.characterModelUrl.startsWith("http") ||
                    runner.characterModelUrl.startsWith("data:")
                      ? runner.characterModelUrl
                      : ""
                  }
                  onChange={(url) =>
                    updateData((d) => {
                      d.gameplay.laneRunner.characterModelUrl = url || "sedan";
                    })
                  }
                />
                <Label>Traffic</Label>
                <div className="flex flex-wrap gap-1">
                  {trafficOptions.map((v) => {
                    const on = runner.obstacleSet.includes(v.id);
                    return (
                      <Button
                        key={v.id}
                        size="sm"
                        variant={on ? "default" : "outline"}
                        onClick={() =>
                          updateData((d) => {
                            const set = d.gameplay.laneRunner.obstacleSet;
                            const has = set.includes(v.id);
                            if (has && set.length === 1) return;
                            d.gameplay.laneRunner.obstacleSet = has
                              ? set.filter((id) => id !== v.id)
                              : [...set, v.id];
                          })
                        }
                      >
                        {v.name}
                      </Button>
                    );
                  })}
                </div>
                <AssetUrlField
                  label="Road surface"
                  accept="image/*"
                  value={runner.roadTextureUrl}
                  onChange={(url) => updateData((d) => { d.gameplay.laneRunner.roadTextureUrl = url; })}
                />
                <AssetUrlField
                  label="Grass"
                  accept="image/*"
                  value={runner.grassTextureUrl}
                  onChange={(url) => updateData((d) => { d.gameplay.laneRunner.grassTextureUrl = url; })}
                />
                <p className="text-[11px] text-muted">Leave empty to keep the Kenney defaults. Uploads replace that layer only.</p>
                <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
                {(
                  [
                    ["ambienceUrl", "Background", "Loop while driving. Leave empty for the built-in traffic ambience."],
                    ["moveUrl", "Lane switch", "Plays when the car changes lanes."],
                  ] as const
                ).map(([key, label, hint]) => (
                  <AssetUrlField
                    key={key}
                    label={label}
                    hint={hint}
                    kind="audio"
                    accept="audio/*"
                    value={runner.sounds?.[key] ?? ""}
                    onChange={(url) =>
                      updateData((d) => {
                        d.gameplay.laneRunner.sounds ??= { ambienceUrl: "", moveUrl: "" };
                        d.gameplay.laneRunner.sounds[key] = url;
                      })
                    }
                  />
                ))}
              </>
            );
          })()}
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
                  <NumberField
                    label="Moves limit"
                    integer
                    min={8}
                    max={80}
                    value={round.movesLimit}
                    onChange={(n) =>
                      patchParkingRound(updateData, roundIdx, (r) => {
                        r.movesLimit = n;
                      })
                    }
                  />
                  <NumberField
                    label="Coins"
                    integer
                    min={0}
                    max={9999}
                    value={round.coins}
                    onChange={(n) =>
                      patchParkingRound(updateData, roundIdx, (r) => {
                        r.coins = n;
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Grid cols"
                    integer
                    min={4}
                    max={8}
                    value={round.gridCols}
                    onChange={(n) =>
                      patchParkingRound(updateData, roundIdx, (r) => {
                        r.gridCols = n;
                        r.cars = repairParkingCars(r.cars, r.gridCols, r.gridRows);
                      })
                    }
                  />
                  <NumberField
                    label="Grid rows"
                    integer
                    min={4}
                    max={8}
                    value={round.gridRows}
                    onChange={(n) =>
                      patchParkingRound(updateData, roundIdx, (r) => {
                        r.gridRows = n;
                        r.cars = repairParkingCars(r.cars, r.gridCols, r.gridRows);
                      })
                    }
                  />
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
          <p className="text-[11px] text-muted">
            {fullBgOn
              ? "Unused while Full background is on. That one image replaces parking surface, pavement, and grass."
              : "Leave empty to keep the Kenney defaults. Uploads replace that layer only."}
          </p>
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
          <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the built-in sound. First tap on the canvas unlocks audio." />
          {(
            [
              ["ambienceUrl", "Background", "Loop while the lot is on screen. Leave empty for the built-in traffic ambience."],
              ["moveUrl", "Move", "Plays when a car slides."],
              ["payoutUrl", "Round win", "Plays when a round is cleared. The shared Win clip is only the final end screen."],
            ] as const
          ).map(([key, label, hint]) => (
            <AssetUrlField
              key={key}
              label={label}
              hint={hint}
              kind="audio"
              accept="audio/*"
              value={data.gameplay.parkingJam.sounds?.[key] ?? ""}
              onChange={(url) =>
                updateData((d) => {
                  d.gameplay.parkingJam.sounds ??= { ambienceUrl: "", moveUrl: "", payoutUrl: "" };
                  d.gameplay.parkingJam.sounds[key] = url;
                })
              }
            />
          ))}
        </>
      )}

      {templateId === "tower-defense" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Tower Defense</h4>
          <p className="text-[11px] leading-snug text-muted">
            How to play: pick Arrow, Cannon, or Turret at the bottom of the canvas, then click a glowing pad beside the brown path. Gold buys towers. Monsters that reach the crystal cost lives — 0 lives loses, last wave wins. Preview (top) runs the full start → play → end ad.
          </p>
          {(() => {
            const td = data.gameplay.towerDefense;
            const rounds = td.rounds.length ? td.rounds : [{
              impCount: 6,
              puglinCount: 0,
              spawnInterval: 1.1,
              hpScale: 1,
              speedScale: 1,
              coins: 50,
              goldBonus: 0,
            }];
            const roundIdx = Math.max(0, Math.min(parkingRoundIndex, rounds.length - 1));
            const round = rounds[roundIdx];
            return (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Lives"
                    integer
                    min={1}
                    max={30}
                    value={td.lives}
                    onChange={(n) =>
                      updateData((d) => {
                        d.gameplay.towerDefense.lives = n;
                      })
                    }
                  />
                  <NumberField
                    label="Starting gold"
                    integer
                    min={0}
                    max={9999}
                    value={td.startingGold}
                    onChange={(n) =>
                      updateData((d) => {
                        d.gameplay.towerDefense.startingGold = n;
                      })
                    }
                  />
                </div>
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
                            setTdRoundCount(d.gameplay.towerDefense, count);
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
                <p className="text-[11px] text-muted">Shows this wave in the canvas. Does not change how many rounds play.</p>
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
                  <NumberField
                    label="Imps"
                    integer
                    min={0}
                    max={40}
                    value={round.impCount}
                    onChange={(n) =>
                      patchTdRound(updateData, roundIdx, (r) => {
                        r.impCount = n;
                      })
                    }
                  />
                  <NumberField
                    label="Puglins"
                    integer
                    min={0}
                    max={20}
                    value={round.puglinCount}
                    onChange={(n) =>
                      patchTdRound(updateData, roundIdx, (r) => {
                        r.puglinCount = n;
                      })
                    }
                  />
                  <NumberField
                    label="Spawn interval"
                    min={0.2}
                    max={5}
                    step={0.05}
                    value={round.spawnInterval}
                    onChange={(n) =>
                      patchTdRound(updateData, roundIdx, (r) => {
                        r.spawnInterval = n;
                      })
                    }
                  />
                  <NumberField
                    label="Coins"
                    integer
                    min={0}
                    max={9999}
                    value={round.coins}
                    onChange={(n) =>
                      patchTdRound(updateData, roundIdx, (r) => {
                        r.coins = n;
                      })
                    }
                  />
                  <NumberField
                    label="HP scale"
                    min={0.4}
                    max={5}
                    step={0.05}
                    value={round.hpScale}
                    onChange={(n) =>
                      patchTdRound(updateData, roundIdx, (r) => {
                        r.hpScale = n;
                      })
                    }
                  />
                  <NumberField
                    label="Speed scale"
                    min={0.4}
                    max={3}
                    step={0.05}
                    value={round.speedScale}
                    onChange={(n) =>
                      patchTdRound(updateData, roundIdx, (r) => {
                        r.speedScale = n;
                      })
                    }
                  />
                  <NumberField
                    label="Gold bonus"
                    integer
                    min={0}
                    max={999}
                    value={round.goldBonus}
                    onChange={(n) =>
                      patchTdRound(updateData, roundIdx, (r) => {
                        r.goldBonus = n;
                      })
                    }
                  />
                </div>
                <p className="text-[11px] text-muted">Tower costs</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["arrow", "cannon", "turret"] as const).map((kind) => (
                    <NumberField
                      key={kind}
                      label={kind}
                      labelClassName="capitalize"
                      integer
                      min={1}
                      max={999}
                      value={td.towers[kind].cost}
                      onChange={(n) =>
                        updateData((d) => {
                          d.gameplay.towerDefense.towers[kind].cost = n;
                        })
                      }
                    />
                  ))}
                </div>
                <SoundsHintLabel text="In-game clips. Leave a slot empty to keep the tiny built-in cue. First tap on the canvas unlocks audio." />
                {(
                  [
                    ["arrowFireUrl", "Arrow fire", "Plays when an arrow tower shoots."],
                    ["cannonFireUrl", "Cannon fire", "Plays when a cannon tower shoots."],
                    ["turretFireUrl", "Turret fire", "Plays when a turret shoots. Fire is throttled so a fast tower does not stack samples."],
                    ["hitUrl", "Hit", "Plays when a projectile hits an enemy."],
                    ["deathUrl", "Enemy death", "Plays when an enemy is defeated."],
                    ["leakUrl", "Leak (life lost)", "Plays when an enemy reaches the end of the path."],
                    ["placeUrl", "Place tower", "Plays when you place a tower."],
                    ["waveUrl", "Wave start", "Plays at the start of each wave."],
                  ] as const
                ).map(([key, label, hint]) => (
                  <AssetUrlField
                    key={key}
                    label={label}
                    hint={hint}
                    kind="audio"
                    accept="audio/*"
                    value={td.sounds?.[key] ?? ""}
                    onChange={(url) =>
                      updateData((d) => {
                        ensureTdRounds(d.gameplay.towerDefense);
                        d.gameplay.towerDefense.sounds[key] = url;
                      })
                    }
                  />
                ))}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

function ContentEditor({ element }: { element: PlayableElement }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const updateData = useEditorStore((s) => s.updateData);
  const editorMode = useEditorStore((s) => s.editorMode);
  const brandId = useEditorStore((s) => s.brandId);
  const brandName = useEditorStore((s) => s.brandName);
  const unlockedSlotIds = useEditorStore((s) => s.unlockedSlotIds);
  const policyUrl = useEditorStore((s) => s.data.links.policyUrl);
  const templateOwned = editorMode === "playable" && Boolean(brandId) && isBrandSlotId(element.id);
  const fromBrand = templateOwned && !unlockedSlotIds.includes(element.id);
  const textOnly = fromBrand && isOverridableSlotId(element.id);
  const styleLocked = fromBrand && !textOnly;
  const linksLocked = isPlayableTemplateLocked(
    editorMode,
    brandId,
    unlockedSlotIds,
    UNLOCK_LINKS_SLOT_ID,
    "asset",
  );

  return (
    <div className="space-y-3 p-4">
      <h3 className="font-semibold">{element.name}</h3>
      {templateOwned && (
        <TemplateSlotUnlockControls slotId={element.id} unlocked={unlockedSlotIds.includes(element.id)} />
      )}
      {fromBrand && (
        <div className="rounded-md border border-accent/40 bg-accent-muted p-2 text-xs text-accent">
          From {brandName || "template"}.{" "}
          {textOnly ? "You can override the copy and button colors here." : "Layout and art stay live-linked until you customize this layer."}{" "}
          {brandId ? (
            <a href={`/templates/${brandId}`} className="underline">
              Edit template
            </a>
          ) : null}
        </div>
      )}
      {(element.type === "text" || element.type === "button" || element.type === "storeButton" || element.type === "starRating") && (
        <div>
          <Label>Text</Label>
          <Input
            value={element.content.text || ""}
            disabled={fromBrand && !textOnly}
            onChange={(e) => updateElement(element.id, (el) => { el.content.text = e.target.value; })}
          />
        </div>
      )}
      {element.id === END_POLICY_SLOT_ID && (
        <div>
          <Label>Policy URL</Label>
          <Input
            value={policyUrl}
            disabled={linksLocked}
            placeholder="https://example.com/privacy"
            onChange={(e) =>
              updateData((draft) => {
                draft.links.policyUrl = e.target.value;
              }, false)
            }
          />
          <p className="mt-1 text-[11px] text-muted">
            {linksLocked
              ? "URL is owned by the template. Customize Links to change it on this playable."
              : "Opens when the player taps this link. Leave empty to do nothing."}
          </p>
        </div>
      )}
      {(element.type === "text" || element.type === "starRating") && (
        <ColorField
          label="Color"
          value={element.content.color}
          fallback="#ffffff"
          disabled={fromBrand && !textOnly}
          onChange={(hex) => updateElement(element.id, (el) => { el.content.color = hex; })}
        />
      )}
      {element.type === "image" && !fromBrand && (
        <AssetUrlField label="Image" accept="image/*" value={element.content.imageUrl || ""} onChange={(url) => updateElement(element.id, (el) => { el.content.imageUrl = url; })} />
      )}
      {element.type === "image" && fromBrand && (
        <div className="text-xs text-muted">Logo image is owned by the template.</div>
      )}
      {(element.type === "button" || element.type === "storeButton") && (
        <>
          <ColorField
            label="Fill"
            value={element.style.backgroundColor}
            fallback="#e07a3d"
            disabled={styleLocked}
            onChange={(hex) => updateElement(element.id, (el) => { el.style.backgroundColor = hex; })}
          />
          <ColorField
            label="Text color"
            value={element.style.textColor}
            fallback="#ffffff"
            disabled={styleLocked}
            onChange={(hex) => updateElement(element.id, (el) => { el.style.textColor = hex; })}
          />
        </>
      )}
      {element.type === "timer" && (
        <NumberField
          label="Duration (s)"
          value={element.content.durationSeconds ?? 30}
          onChange={(n) => updateElement(element.id, (el) => { el.content.durationSeconds = n; })}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y", "width", "height"] as const).map((key) => {
          const orientation = useEditorStore.getState().orientation;
          const box = element.layout[orientation];
          return (
            <NumberField
              key={key}
              label={key}
              labelClassName="capitalize"
              min={0}
              max={1}
              step={0.01}
              disabled={fromBrand}
              value={box[key]}
              onChange={(n) => {
                useEditorStore.getState().updateElementLayout(element.id, orientation, { [key]: n });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const stage = useEditorStore((s) => s.stage);
  const selected = useSelectedElement();
  const data = useEditorStore((s) => s.data);
  const orientation = useEditorStore((s) => s.orientation);
  const updateData = useEditorStore((s) => s.updateData);
  const editorMode = useEditorStore((s) => s.editorMode);
  const brandId = useEditorStore((s) => s.brandId);
  const brandName = useEditorStore((s) => s.brandName);
  const unlockedSlotIds = useEditorStore((s) => s.unlockedSlotIds);
  const addEndPolicy = useEditorStore((s) => s.addEndPolicy);
  const hasPolicy = data.endScreen.elements.some((el) => el.id === END_POLICY_SLOT_ID);

  if (stage === "gameplay" && !selected) {
    if (editorMode === "brand") {
      return (
        <div className="space-y-3 p-4">
          <h3 className="font-semibold">HUD</h3>
          <p className="text-sm text-muted">
            Select the logo. Coin art is used in every game this template is applied to.
          </p>
          <CoinIconField />
        </div>
      );
    }
    return <GameplaySettings />;
  }
  if (selected) return <ContentEditor element={selected} />;

  const screen = stage === "start" ? data.startScreen : data.endScreen;
  const startVideoActive = stage === "start" && screen.background.type === "video";
  const liveLinked = editorMode === "playable" && Boolean(brandId);
  const bgSlotId = stage === "start" ? UNLOCK_START_BG_SLOT_ID : UNLOCK_END_BG_SLOT_ID;
  const bgLocked = isPlayableTemplateLocked(editorMode, brandId, unlockedSlotIds, bgSlotId, "asset");
  return (
    <div className="space-y-4 p-4">
      {stage === "start" && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="hide-start-screen">Hide start screen</Label>
            <p className="text-[11px] leading-snug text-muted">
              Playables skip this card and open in gameplay for portrait and landscape.
            </p>
          </div>
          <Switch
            id="hide-start-screen"
            checked={Boolean(data.startScreen.hidden)}
            onCheckedChange={(checked) =>
              updateData((d) => {
                d.startScreen.hidden = checked;
              })
            }
          />
        </div>
      )}
      {stage === "start" && data.startScreen.hidden && (
        <p className="text-xs text-muted">
          This layout is still editable. Preview and export open in gameplay immediately.
        </p>
      )}
      <h3 className="font-semibold">Background</h3>
      {liveLinked && (
        <TemplateSlotUnlockControls slotId={bgSlotId} unlocked={!bgLocked} />
      )}
      {bgLocked && (
        <p className="text-xs text-accent">
          Start/end backgrounds come from {brandName || "the template"}.{" "}
          {brandId ? (
            <a href={`/templates/${brandId}`} className="underline">
              Edit template
            </a>
          ) : null}
        </p>
      )}
      {!bgLocked && (
        <BackgroundEditor
          background={screen.background}
          orientation={orientation}
          allowVideo
          allowTransparent
          onChange={(next) =>
            updateData((draft) => {
              const target = stage === "start" ? draft.startScreen : draft.endScreen;
              target.background = next;
              target.videoUrl = next.portraitVideoUrl || next.landscapeVideoUrl || "";
            })
          }
        />
      )}
      {startVideoActive && !bgLocked && !data.startScreen.hidden && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="start-after-video">Start after video ends</Label>
            <p className="text-[11px] leading-snug text-muted">
              When off, the playable starts on a button click. The CTA still skips the video if tapped early.
            </p>
          </div>
          <Switch
            id="start-after-video"
            checked={Boolean(data.startScreen.startAfterVideo)}
            onCheckedChange={(checked) =>
              updateData((d) => {
                d.startScreen.startAfterVideo = checked;
              })
            }
          />
        </div>
      )}
      {stage === "end" && !hasPolicy && (editorMode === "brand" || !brandId) && (
        <Button size="sm" variant="outline" onClick={() => addEndPolicy()}>
          Add Privacy Policy
        </Button>
      )}
      {stage === "end" && !hasPolicy && editorMode === "playable" && Boolean(brandId) && (
        <p className="text-xs text-muted">
          Add a privacy policy link in the template.{" "}
          {brandId ? (
            <a href={`/templates/${brandId}`} className="text-accent underline">
              Edit template
            </a>
          ) : null}
        </p>
      )}
    </div>
  );
}
