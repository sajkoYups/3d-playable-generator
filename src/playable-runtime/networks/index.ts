import type { NetworkId } from "@/types/project";

export type NetworkAdapter = {
  id: NetworkId;
  name: string;
  sizeLimitBytes: number;
  init(): void;
  onReady(): void;
  openStore(url: string): void;
  wrapHtml(html: string): string;
};

/** Moloco/Meta scanners look for this exact call in the HTML source. */
export const META_CTA_CALL = "FbPlayableAd.onCTAClick()";

declare global {
  var FbPlayableAd: { onCTAClick: () => void };
  interface Window {
    __PLAYABLE_CONFIG__?: {
      data: unknown;
      templateId: string;
      networkId?: string;
    };
    ExitApi?: { exit: (url?: string) => void };
    FbPlayableAd?: { onCTAClick: () => void };
    mraid?: {
      getState: () => string;
      addEventListener: (e: string, cb: () => void) => void;
      open: (url: string) => void;
    };
    dapi?: {
      isReady: () => boolean;
      addEventListener: (e: string, cb: () => void) => void;
      openStoreUrl: () => void;
    };
    applyClickTag?: () => void;
    install?: (url?: string) => void;
    playableSDK?: { openAppStore: () => void };
    __playableOnCTAClick?: () => void;
  }
}

function openFallback(url: string) {
  if (url) window.open(url, "_blank");
}

export const NETWORK_LIMITS: Record<NetworkId, number> = {
  generic: 5 * 1024 * 1024,
  google: 5 * 1024 * 1024,
  meta: 5 * 1024 * 1024,
  applovin: 5 * 1024 * 1024,
  unity: 5 * 1024 * 1024,
  ironsource: 5 * 1024 * 1024,
  mintegral: 2 * 1024 * 1024,
  tiktok: 2 * 1024 * 1024,
};

export const NETWORK_LABELS: Record<NetworkId, string> = {
  generic: "Generic HTML",
  google: "Google Ads",
  meta: "Meta / Facebook",
  applovin: "AppLovin",
  unity: "Unity Ads",
  ironsource: "ironSource",
  mintegral: "Mintegral",
  tiktok: "TikTok",
};

function base(id: NetworkId, extra: Partial<NetworkAdapter> = {}): NetworkAdapter {
  return {
    id,
    name: NETWORK_LABELS[id],
    sizeLimitBytes: NETWORK_LIMITS[id],
    init() {},
    onReady() {},
    openStore(url) {
      openFallback(url);
    },
    wrapHtml(html) {
      return html;
    },
    ...extra,
  };
}

export function createNetworkAdapter(id: NetworkId): NetworkAdapter {
  switch (id) {
    case "google":
      return base("google", {
        wrapHtml(html) {
          return html.replace("<head>", "<head><script>window.ExitApi=window.ExitApi||{exit:function(u){window.open(u||'','_blank')}}</script>");
        },
        openStore(url) {
          if (window.ExitApi?.exit) window.ExitApi.exit(url);
          else openFallback(url);
        },
      });
    case "meta":
      return base("meta", {
        wrapHtml(html) {
          return html.replace(
            "<head>",
            "<head><script>window.FbPlayableAd=window.FbPlayableAd||{onCTAClick:function(){}};window.__playableOnCTAClick=function(){FbPlayableAd.onCTAClick()};</script>",
          );
        },
        openStore() {
          // Head helper keeps FbPlayableAd.onCTAClick() unminified for scanners.
          // Bare call is the runtime fallback; do not window.open — Meta handles the store.
          if (typeof window.__playableOnCTAClick === "function") window.__playableOnCTAClick();
          else if (typeof FbPlayableAd !== "undefined") FbPlayableAd.onCTAClick();
        },
      });
    case "applovin":
      return base("applovin", {
        wrapHtml(html) {
          return html.replace(
            "<head>",
            "<head><script>function mraidOpen(u){if(window.mraid){if(mraid.getState()==='loading'){mraid.addEventListener('ready',function(){mraid.open(u)})}else mraid.open(u)}else window.open(u,'_blank')}</script>",
          );
        },
        openStore(url) {
          const mraid = window.mraid;
          if (mraid) {
            if (mraid.getState() === "loading") mraid.addEventListener("ready", () => mraid.open(url));
            else mraid.open(url);
          } else openFallback(url);
        },
      });
    case "unity":
      return base("unity", {
        openStore(url) {
          if (typeof window.install === "function") window.install(url);
          else openFallback(url);
        },
      });
    case "ironsource":
      return base("ironsource", {
        wrapHtml(html) {
          return html.replace(
            "<head>",
            "<head><script src=\"https://static.ironsrc.com/adapters/dapi.js\"></script>",
          );
        },
        init() {
          const dapi = window.dapi;
          if (dapi && !dapi.isReady()) dapi.addEventListener("ready", () => undefined);
        },
        openStore() {
          window.dapi?.openStoreUrl();
        },
      });
    case "mintegral":
      return base("mintegral", {
        wrapHtml(html) {
          return html.replace(
            "</body>",
            "<script>window.gameReady&&window.gameReady();window.gameEnd=window.gameEnd||function(){};window.gameClose=window.gameClose||function(){};window.install=window.install||function(){window.open('','_blank')}</script></body>",
          );
        },
        openStore(url) {
          if (typeof window.install === "function") window.install(url);
          else openFallback(url);
        },
      });
    case "tiktok":
      return base("tiktok", {
        wrapHtml(html) {
          return html.replace(
            "<head>",
            "<head><script>window.playableSDK=window.playableSDK||{openAppStore:function(){}}</script>",
          );
        },
        openStore(url) {
          window.playableSDK?.openAppStore();
          openFallback(url);
        },
      });
    default:
      return base("generic");
  }
}
