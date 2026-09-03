import type { PlayableElement, ProjectLinks } from "@/types/project";

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

/** Generic Download CTA: App Store on iOS, Play Store on Android. */
export function storeUrlForDevice(links: ProjectLinks): string {
  if (isAndroidDevice()) return links.googlePlayUrl || links.appStoreUrl;
  if (isIosDevice()) return links.appStoreUrl || links.googlePlayUrl;
  return links.appStoreUrl || links.googlePlayUrl;
}

/**
 * Explicit store buttons keep their store. Download Now (no content.store) follows the OS.
 */
export function resolveStoreUrl(links: ProjectLinks, element?: PlayableElement): string {
  const store = element?.content.store;
  if (store === "appStore") return links.appStoreUrl || links.googlePlayUrl;
  if (store === "googlePlay") return links.googlePlayUrl || links.appStoreUrl;
  return storeUrlForDevice(links);
}

export function isGameplayDownloadCta(element: PlayableElement): boolean {
  return element.id === "gameplay-cta";
}
