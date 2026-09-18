import type { Orientation, PlayableElement, ProjectData, TemplateId } from "@/types/project";
import { boardBackgroundForPlay, isFullBackgroundActive, screenVideoUrl } from "@/types/project";
import type { Playable3DEngine } from "@/playable-runtime/engines/types";
import type { NetworkAdapter } from "@/playable-runtime/networks";
import { applyStyle, backgroundToStyle, fullBackgroundToStyle, layoutToStyle } from "@/playable-runtime/layout/layout";
import { renderElement } from "@/playable-runtime/overlay/dom";
import { AudioBus } from "@/playable-runtime/audio/bus";
import { DEFAULT_TIMER_DURATION } from "@/playable-runtime/screens/format-time";
import { isGameplayDownloadCta, resolveStoreUrl } from "@/playable-runtime/store/url";
import { playableMediaSrc } from "@/playable-runtime/media/src";

export type MountOptions = {
  data: ProjectData;
  templateId: TemplateId;
  engine: Playable3DEngine;
  network: NetworkAdapter;
  forcedOrientation?: Orientation;
  jumpToEnd?: boolean;
  assets?: Record<string, string>;
};

export type MountedPlayable = {
  destroy(): void;
  setData(data: ProjectData): void;
};

function withInlinedAssets(data: ProjectData, assets?: Record<string, string>): ProjectData {
  if (!assets) return data;
  const entries = Object.entries(assets);
  if (entries.length === 0) return data;
  let json = JSON.stringify(data);
  for (const [url, dataUri] of entries) {
    if (!url || !dataUri) continue;
    json = json.split(JSON.stringify(url)).join(JSON.stringify(dataUri));
  }
  return JSON.parse(json) as ProjectData;
}

export function mountPlayable(root: HTMLElement, options: MountOptions): MountedPlayable {
  const audio = new AudioBus();
  let data = withInlinedAssets(options.data, options.assets);
  audio.setUrls(data.gameplay.audio);
  options.network.init();
  let phase: "start" | "game" | "end" = "start";
  if (options.jumpToEnd) phase = "end";
  else if (data.startScreen.hidden) phase = "game";
  let orientation: Orientation = options.forcedOrientation || "portrait";
  let size = { w: root.clientWidth || 320, h: root.clientHeight || 568 };
  let timerLeft: number | null = null;
  let timerId = 0;
  let muted = false;
  let gameBox: HTMLElement | null = null;
  let overlayRoot: HTMLElement | null = null;
  const engine = options.engine;
  let engineReady = false;
  let screenVideo: HTMLVideoElement | null = null;
  let audioUnlocked = false;

  root.style.position = "relative";
  root.style.width = "100%";
  root.style.height = "100%";
  root.style.overflow = "hidden";
  root.style.touchAction = "manipulation";

  const stage = document.createElement("div");
  stage.style.position = "absolute";
  stage.style.inset = "0";
  root.appendChild(stage);

  const onPointerDown = () => {
    audioUnlocked = true;
    audio.unlock();
    applyScreenMedia();
  };
  root.addEventListener("pointerdown", onPointerDown, { capture: true });

  function syncMuteButtons() {
    stage.querySelectorAll<HTMLElement>("[data-playable-mute]").forEach((btn) => {
      btn.textContent = muted ? btn.dataset.muteOn || "🔇" : btn.dataset.muteOff || "🔊";
    });
  }

  function currentScreenVideoUrl() {
    const screen = phase === "start" ? data.startScreen : phase === "end" ? data.endScreen : null;
    if (!screen || screen.background.type !== "video") return "";
    return screenVideoUrl(screen, orientation);
  }

  function applyScreenMedia() {
    try {
      if (screenVideo) {
        const live = audioUnlocked && !muted;
        screenVideo.muted = !live;
        if (live) {
          screenVideo.volume = 0.8;
          void screenVideo.play().catch(() => undefined);
        }
        return;
      }
      if (muted) return;
      if (phase === "start" && data.gameplay.audio.playFromStart) {
        audio.play("music");
        return;
      }
      if (phase === "game" && data.gameplay.audio.musicUrl && !audio.isMusicPlaying()) {
        audio.play("music");
      }
    } catch {
      /* media errors must not block taps / START */
    }
  }

  function discardScreenVideo() {
    if (!screenVideo) return;
    const video = screenVideo;
    screenVideo = null;
    video.onended = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  function measure() {
    size = { w: root.clientWidth || 320, h: root.clientHeight || 568 };
    orientation =
      options.forcedOrientation || (size.h >= size.w ? "portrait" : "landscape");
  }

  function beginGameplay() {
    if (phase !== "start") return;
    audioUnlocked = true;
    audio.unlock();
    discardScreenVideo();
    audio.play("music");
    setPhase("game");
  }

  function handleAction(type: string, element?: PlayableElement) {
    if (type === "START_PLAYABLE") {
      audio.play("tap");
      beginGameplay();
    }
    if (type === "REPLAY") {
      audio.play("tap");
      audio.play("music");
      setPhase("game");
    }
    if (type === "MUTE") {
      muted = !muted;
      audio.setMuted(muted);
      if (screenVideo) {
        screenVideo.muted = muted;
        if (!muted) void screenVideo.play().catch(() => undefined);
      } else if (!muted) {
        if (phase === "game" || data.gameplay.audio.playFromStart) audio.play("music");
      }
      if (phase === "game") paintGameOverlays();
      else syncMuteButtons();
    }
    if (type === "OPEN_APP_STORE" || type === "OPEN_GOOGLE_PLAY") {
      options.network.openStore(resolveStoreUrl(data.links, element));
    }
    if (type === "OPEN_POLICY") {
      const url = data.links.policyUrl;
      if (url) options.network.openStore(url);
    }
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = 0;
    timerLeft = null;
  }

  function startTimer() {
    stopTimer();
    const timerEl = data.gameplay.overlays.find((e) => e.type === "timer");
    const visible = Boolean(timerEl && timerEl.layout[orientation].visible);
    if (!visible || !timerEl) return;
    const duration = timerEl.content.durationSeconds ?? DEFAULT_TIMER_DURATION;
    timerLeft = duration;
    const startedAt = Date.now();
    timerId = window.setInterval(() => {
      const left = duration - (Date.now() - startedAt) / 1000;
      timerLeft = Math.max(0, left);
      paintGameOverlays();
      if (left <= 0) {
        stopTimer();
        setPhase("end");
      }
    }, 100);
  }

  function destroyEngine() {
    if (engineReady) {
      engine.destroy();
      engineReady = false;
    }
  }

  function bootEngine() {
    if (!gameBox || engineReady) return;
    engine.initialize({
      container: gameBox,
      orientation,
      camera: data.gameplay.camera[orientation],
      lighting: data.gameplay.lighting,
      assets: options.assets || {},
      ...({
        stackTower: data.gameplay.stackTower,
        tripleMatch: data.gameplay.tripleMatch,
        laneRunner: data.gameplay.laneRunner,
        parkingJam: data.gameplay.parkingJam,
        towerDefense: data.gameplay.towerDefense,
        playAllRounds: true,
        audioBus: audio,
        background: boardBackgroundForPlay(
          data.gameplay.background[orientation],
          data.gameplay.fullBackground,
        ),
        fullBackgroundActive: isFullBackgroundActive(data.gameplay.fullBackground),
        pieceImages: data.gameplay.pieceImages,
        match3: data.gameplay.match3,
        waterSort: data.gameplay.waterSort,
        solitaire: data.gameplay.solitaire,
        domino: data.gameplay.domino,
        tappyPlane: data.gameplay.tappyPlane,
        racingLap: data.gameplay.racingLap,
        topDownShooter: data.gameplay.topDownShooter,
        dressUp: data.gameplay.dressUp,
        hintHandUrl: data.gameplay.overlays.find((e) => e.id === "gameplay-hand")?.content.imageUrl || "",
        hintHandVisible: Boolean(
          data.gameplay.overlays.find((e) => e.id === "gameplay-hand")?.layout[orientation].visible,
        ),
      } as object),
    } as never);
    engine.onWin(() => {
      audio.play("win");
      audio.stopMusic();
      setPhase("end");
    });
    engine.onLose(() => {
      audio.play("lose");
      audio.stopMusic();
      setPhase("end");
    });
    engine.start();
    engineReady = true;
    if (!muted) {
      try {
        audio.play("music");
      } catch {
        /* music must not abort round flow */
      }
    }
  }

  function paintGameOverlays() {
    if (!overlayRoot) return;
    overlayRoot.innerHTML = "";
    data.gameplay.overlays
      .filter(
        (e) =>
          e.type !== "gameplayContainer" &&
          e.id !== "gameplay-hand" &&
          e.layout[orientation].visible,
      )
      .filter((e) => !isGameplayDownloadCta(e))
      .sort((a, b) => a.layout[orientation].zIndex - b.layout[orientation].zIndex)
      .forEach((el) => {
        const wrap = document.createElement("div");
        applyStyle(wrap, layoutToStyle(el.layout[orientation], size.w, size.h));
        wrap.style.pointerEvents = "auto";
        wrap.appendChild(
          renderElement(el, {
            interactive: true,
            remainingSeconds: el.type === "timer" ? (timerLeft ?? undefined) : undefined,
            muted,
            onAction: handleAction,
          }),
        );
        overlayRoot!.appendChild(wrap);
      });
  }

  function paintScreen() {
    measure();
    destroyEngine();
    gameBox = null;
    overlayRoot = null;
    discardScreenVideo();
    stage.innerHTML = "";
    const screen = phase === "start" ? data.startScreen : data.endScreen;
    const bg = document.createElement("div");
    bg.style.position = "absolute";
    bg.style.inset = "0";
    applyStyle(bg, backgroundToStyle(screen.background, orientation));
    const videoSrc = currentScreenVideoUrl();
    if (videoSrc) {
      const video = document.createElement("video");
      const startAfterVideo = phase === "start" && data.startScreen.startAfterVideo;
      video.src = playableMediaSrc(videoSrc);
      video.autoplay = true;
      video.loop = !startAfterVideo;
      video.muted = !audioUnlocked || muted;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.volume = 0.8;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      if (startAfterVideo) {
        video.onended = () => {
          if (screenVideo !== video || phase !== "start") return;
          beginGameplay();
        };
      }
      bg.appendChild(video);
      screenVideo = video;
    }
    screen.elements
      .filter((e) => e.layout[orientation].visible)
      .sort((a, b) => a.layout[orientation].zIndex - b.layout[orientation].zIndex)
      .forEach((el) => {
        const wrap = document.createElement("div");
        applyStyle(wrap, layoutToStyle(el.layout[orientation], size.w, size.h));
        wrap.appendChild(
          renderElement(el, { interactive: true, muted, onAction: handleAction }),
        );
        bg.appendChild(wrap);
      });
    stage.appendChild(bg);
    applyScreenMedia();
  }

  function paintGame() {
    measure();
    discardScreenVideo();
    stage.innerHTML = "";
    const bg = document.createElement("div");
    bg.style.position = "absolute";
    bg.style.inset = "0";
    applyStyle(bg, backgroundToStyle(data.gameplay.stageBackground[orientation], orientation));
    const fullStyle = fullBackgroundToStyle(data.gameplay.fullBackground, orientation);
    if (fullStyle) {
      const fullLayer = document.createElement("div");
      fullLayer.style.position = "absolute";
      fullLayer.style.inset = "0";
      fullLayer.style.zIndex = "0";
      fullLayer.style.pointerEvents = "none";
      applyStyle(fullLayer, fullStyle);
      bg.appendChild(fullLayer);
    }
    const box = data.gameplay.overlays.find((e) => e.type === "gameplayContainer");
    gameBox = document.createElement("div");
    gameBox.style.overflow = "hidden";
    if (box) applyStyle(gameBox, layoutToStyle(box.layout[orientation], size.w, size.h));
    else {
      gameBox.style.position = "absolute";
      gameBox.style.inset = "0";
      gameBox.style.zIndex = "1";
    }
    if (isFullBackgroundActive(data.gameplay.fullBackground)) {
      gameBox.style.background = "transparent";
    }
    bg.appendChild(gameBox);
    overlayRoot = document.createElement("div");
    overlayRoot.style.position = "absolute";
    overlayRoot.style.inset = "0";
    overlayRoot.style.pointerEvents = "none";
    overlayRoot.style.zIndex = "20";
    bg.appendChild(overlayRoot);
    stage.appendChild(bg);
    paintGameOverlays();
  }

  function setPhase(next: "start" | "game" | "end") {
    if (phase === "game" && next !== "game") {
      destroyEngine();
      stopTimer();
      audio.stopMusic();
    }
    const restartGame = next === "game";
    phase = next;
    if (next === "game") {
      if (restartGame) destroyEngine();
      paintGame();
      startTimer();
      bootEngine();
    } else {
      paintScreen();
    }
  }

  const ro = new ResizeObserver(() => {
    const prev = orientation;
    measure();
    if (phase === "game") {
      if (orientation !== prev) {
        destroyEngine();
        paintGame();
        bootEngine();
      } else {
        engine.resize?.(gameBox?.clientWidth || size.w, gameBox?.clientHeight || size.h);
        paintGameOverlays();
      }
    } else if (orientation !== prev) {
      paintScreen();
    }
  });
  ro.observe(root);
  options.network.onReady();
  if (phase === "game") {
    paintGame();
    startTimer();
    bootEngine();
  } else {
    paintScreen();
  }

  return {
    destroy() {
      ro.disconnect();
      stopTimer();
      discardScreenVideo();
      destroyEngine();
      audio.destroy();
      root.removeEventListener("pointerdown", onPointerDown, true);
      stage.remove();
    },
    setData(next) {
      data = withInlinedAssets(next, options.assets);
      audio.setUrls(data.gameplay.audio);
      engine.setOptions?.({
        camera: data.gameplay.camera[orientation],
        lighting: data.gameplay.lighting,
        orientation,
        stackTower: data.gameplay.stackTower,
        tripleMatch: data.gameplay.tripleMatch,
        laneRunner: data.gameplay.laneRunner,
        parkingJam: data.gameplay.parkingJam,
        towerDefense: data.gameplay.towerDefense,
        background: boardBackgroundForPlay(
          data.gameplay.background[orientation],
          data.gameplay.fullBackground,
        ),
        fullBackgroundActive: isFullBackgroundActive(data.gameplay.fullBackground),
        pieceImages: data.gameplay.pieceImages,
        match3: data.gameplay.match3,
        waterSort: data.gameplay.waterSort,
        solitaire: data.gameplay.solitaire,
        domino: data.gameplay.domino,
        tappyPlane: data.gameplay.tappyPlane,
        racingLap: data.gameplay.racingLap,
        topDownShooter: data.gameplay.topDownShooter,
        dressUp: data.gameplay.dressUp,
        hintHandUrl: data.gameplay.overlays.find((e) => e.id === "gameplay-hand")?.content.imageUrl || "",
        hintHandVisible: Boolean(
          data.gameplay.overlays.find((e) => e.id === "gameplay-hand")?.layout[orientation].visible,
        ),
      });
      if (phase === "game") paintGameOverlays();
      else paintScreen();
    },
  };
}
