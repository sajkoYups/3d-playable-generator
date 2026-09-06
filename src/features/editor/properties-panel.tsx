"use client";

import { useEditorStore, useSelectedElement } from "@/features/editor/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AssetUrlField } from "@/features/editor/asset-url-field";
import { ColorField } from "@/features/editor/color-field";
import { CAMERA_FOV_MAX, CAMERA_FOV_MIN, END_POLICY_SLOT_ID, UNLOCK_COIN_SLOT_ID, UNLOCK_END_BG_SLOT_ID, UNLOCK_LINKS_SLOT_ID, UNLOCK_START_BG_SLOT_ID, is2DTemplate, isBrandSlotId, isOverridableSlotId, type Background, type LaneRunnerConfig, type LaneRunnerRound, type LightingPreset, type ParkingJamConfig, type ParkingRound, type PlayableElement, type ProjectData, type TowerDefenseConfig, type TowerDefenseRound, type TripleMatchConfig, type TripleMatchRound } from "@/types/project";
import { MATCH3_PIECE_META, defaultPieceImages, stampCoinImage } from "@/lib/project-defaults";
import { TemplateSlotUnlockControls } from "@/features/editor/template-slot-unlock-controls";
import { isPlayableTemplateLocked } from "@/features/editor/store";
import { MATCH_ITEMS, OBSTACLES, VEHICLES } from "@/lib/model-library";
import { ensureParkingRounds, repairParkingCars, setParkingRoundCount, syncParkingRound } from "@/playable-runtime/engines/parking-jam/layout";
import { ensureMatchRounds, propagateMatchFoods, setMatchRoundCount, syncMatchRound } from "@/playable-runtime/engines/triple-match/rounds";
import { ensureLaneRounds, propagateLaneWinDistance, setLaneRoundCount, syncLaneRound } from "@/playable-runtime/engines/lane-runner/rounds";
import { ensureTdRounds, setTdRoundCount } from "@/playable-runtime/engines/tower-defense/rounds";

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function clampInt(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

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
      {is2DTemplate(templateId) && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Board background ({orientation})</h4>
            <p className="text-[11px] text-muted">Drawn inside the gameplay area.</p>
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
        </>
      )}
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
        {templateId === "tower-defense" && (
          <p className="text-[11px] text-muted">
            Music, tap, win, and lose play on the start/end flow. Tower fire and combat sounds are under Tower Defense below.
          </p>
        )}
      </div>

      {templateId !== "stack-tower" && templateId !== "water-sort" && (
        <>
          <Separator />
          <CoinIconField />
        </>
      )}

      {templateId === "water-sort" && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Water Sort</h4>
          <Label>Max moves</Label>
          <Input
            type="number"
            min={8}
            max={99}
            value={data.gameplay.waterSort.maxMoves}
            onChange={(e) =>
              updateData((d) => {
                d.gameplay.waterSort.maxMoves = Number(e.target.value) || 40;
              })
            }
          />
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
                <Label>Moves / round</Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={data.gameplay.match3.movesPerRound}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.match3.movesPerRound = Number(e.target.value) || 1;
                    })
                  }
                />
                <p className="text-[11px] text-muted">
                  Successful matches you can make this round. Not how many you need to advance.
                  Invalid swaps do not count.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Score target</Label>
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  value={data.gameplay.match3.scoreTarget}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.match3.scoreTarget = Number(e.target.value) || 1;
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
                <Label>Rounds to win</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={data.gameplay.match3.roundsToWin}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.match3.roundsToWin = Number(e.target.value) || 1;
                    })
                  }
                />
                <p className="text-[11px] text-muted">
                  How many rounds before the end screen (R1/2, then R2/2, then end).
                </p>
              </div>
              <div className="space-y-1">
                <Label>Reward / round</Label>
                <Input
                  type="number"
                  min={0}
                  max={9999}
                  value={data.gameplay.match3.rewardPerRound}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.match3.rewardPerRound = Number(e.target.value) || 0;
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
                <Label>Hint delay (ms)</Label>
                <Input
                  type="number"
                  min={500}
                  max={15000}
                  step={100}
                  value={data.gameplay.match3.hintDelayMs}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.match3.hintDelayMs = Number(e.target.value) || 2500;
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
        </>
      )}

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
                  <div>
                    <Label>Triples to win</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={round.triplesToWin}
                      onChange={(e) =>
                        patchMatchRound(updateData, roundIdx, (r) => {
                          r.triplesToWin = clampInt(Number(e.target.value), 1, 30, 4);
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
                        patchMatchRound(updateData, roundIdx, (r) => {
                          r.coins = clampInt(Number(e.target.value), 0, 9999, 50);
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Bar slots</Label>
                    <Input
                      type="number"
                      min={5}
                      max={10}
                      value={round.barSlots}
                      onChange={(e) =>
                        patchMatchRound(updateData, roundIdx, (r) => {
                          r.barSlots = clampInt(Number(e.target.value), 5, 10, 7);
                        })
                      }
                    />
                  </div>
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
                  <div>
                    <Label>Win distance</Label>
                    <Input
                      type="number"
                      min={40}
                      max={800}
                      value={round.winDistance}
                      onChange={(e) => {
                        const next = Math.min(800, Math.max(40, Number(e.target.value) || 180));
                        updateData((d) => {
                          propagateLaneWinDistance(d.gameplay.laneRunner, next);
                        });
                      }}
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
                        patchLaneRound(updateData, roundIdx, (r) => {
                          r.coins = clampInt(Number(e.target.value), 0, 9999, 50);
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Start speed</Label>
                    <Input
                      type="number"
                      min={4}
                      max={20}
                      step={0.5}
                      value={round.startSpeed}
                      onChange={(e) =>
                        patchLaneRound(updateData, roundIdx, (r) => {
                          r.startSpeed = Math.min(20, Math.max(4, Number(e.target.value) || 8));
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Speed ramp</Label>
                    <Input
                      type="number"
                      min={0}
                      max={4}
                      step={0.1}
                      value={round.speedRamp}
                      onChange={(e) =>
                        patchLaneRound(updateData, roundIdx, (r) => {
                          r.speedRamp = Math.min(4, Math.max(0, Number(e.target.value) || 0.6));
                        })
                      }
                    />
                  </div>
                </div>
                <Label>Lane switch speed</Label>
                <p className="text-[11px] text-muted">How fast the car slides left and right when you swipe (higher = snappier).</p>
                <Input
                  type="number"
                  min={4}
                  max={24}
                  step={1}
                  value={runner.laneSwitchSpeed ?? 10}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.laneRunner.laneSwitchSpeed = Math.min(
                        24,
                        Math.max(4, Number(e.target.value) || 10),
                      );
                    })
                  }
                />
                <Label>Lanes</Label>
                <Input
                  type="number"
                  min={3}
                  max={5}
                  value={runner.laneCount}
                  onChange={(e) =>
                    updateData((d) => {
                      d.gameplay.laneRunner.laneCount = clampInt(Number(e.target.value), 3, 5, 3);
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
                  <div>
                    <Label>Lives</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={td.lives}
                      onChange={(e) =>
                        updateData((d) => {
                          d.gameplay.towerDefense.lives = clampInt(Number(e.target.value), 1, 30, 8);
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Starting gold</Label>
                    <Input
                      type="number"
                      min={0}
                      max={9999}
                      value={td.startingGold}
                      onChange={(e) =>
                        updateData((d) => {
                          d.gameplay.towerDefense.startingGold = clampInt(Number(e.target.value), 0, 9999, 80);
                        })
                      }
                    />
                  </div>
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
                  <div>
                    <Label>Imps</Label>
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      value={round.impCount}
                      onChange={(e) =>
                        patchTdRound(updateData, roundIdx, (r) => {
                          r.impCount = clampInt(Number(e.target.value), 0, 40, 6);
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Puglins</Label>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={round.puglinCount}
                      onChange={(e) =>
                        patchTdRound(updateData, roundIdx, (r) => {
                          r.puglinCount = clampInt(Number(e.target.value), 0, 20, 0);
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Spawn interval</Label>
                    <Input
                      type="number"
                      min={0.2}
                      max={5}
                      step={0.05}
                      value={round.spawnInterval}
                      onChange={(e) =>
                        patchTdRound(updateData, roundIdx, (r) => {
                          r.spawnInterval = Math.min(5, Math.max(0.2, Number(e.target.value) || 1.1));
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
                        patchTdRound(updateData, roundIdx, (r) => {
                          r.coins = clampInt(Number(e.target.value), 0, 9999, 50);
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>HP scale</Label>
                    <Input
                      type="number"
                      min={0.4}
                      max={5}
                      step={0.05}
                      value={round.hpScale}
                      onChange={(e) =>
                        patchTdRound(updateData, roundIdx, (r) => {
                          r.hpScale = Math.min(5, Math.max(0.4, Number(e.target.value) || 1));
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Speed scale</Label>
                    <Input
                      type="number"
                      min={0.4}
                      max={3}
                      step={0.05}
                      value={round.speedScale}
                      onChange={(e) =>
                        patchTdRound(updateData, roundIdx, (r) => {
                          r.speedScale = Math.min(3, Math.max(0.4, Number(e.target.value) || 1));
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Gold bonus</Label>
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      value={round.goldBonus}
                      onChange={(e) =>
                        patchTdRound(updateData, roundIdx, (r) => {
                          r.goldBonus = clampInt(Number(e.target.value), 0, 999, 0);
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted">Tower costs</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["arrow", "cannon", "turret"] as const).map((kind) => (
                    <div key={kind}>
                      <Label className="capitalize">{kind}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        value={td.towers[kind].cost}
                        onChange={(e) =>
                          updateData((d) => {
                            d.gameplay.towerDefense.towers[kind].cost = clampInt(Number(e.target.value), 1, 999, 50);
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted">Sounds</p>
                <p className="text-[11px] leading-snug text-muted">
                  Upload short clips (mp3/wav/ogg). Empty slots still play a tiny built-in cue so you can test. Turret fire is throttled so a fast tower does not stack 5 samples a second. First tap on the canvas unlocks audio.
                </p>
                {(
                  [
                    ["arrowFireUrl", "Arrow fire"],
                    ["cannonFireUrl", "Cannon fire"],
                    ["turretFireUrl", "Turret fire"],
                    ["hitUrl", "Hit"],
                    ["deathUrl", "Enemy death"],
                    ["leakUrl", "Leak (life lost)"],
                    ["placeUrl", "Place tower"],
                    ["waveUrl", "Wave start"],
                  ] as const
                ).map(([key, label]) => (
                  <AssetUrlField
                    key={key}
                    label={label}
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
                disabled={fromBrand}
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
      {startVideoActive && !bgLocked && (
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
