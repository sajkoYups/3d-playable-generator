import type { TemplateId } from "@/types/project";
import type { UpcomingGameId } from "@/features/projects/upcoming-games";

export type GlyphId = TemplateId | UpcomingGameId;

const GAME_COVERS: Partial<Record<GlyphId, string>> = {
  "lane-runner": "/game-covers/endless-car-runner-playable.png",
  "parking-jam": "/game-covers/parking-jam-3d.png",
  "triple-match": "/game-covers/triple-stack-3d-960x480.png",
  "match-3": "/game-covers/match-3-cover-960x480.png",
  "stack-tower": "/game-covers/stack-tower-3d-960x480.png",
  solitaire: "/game-covers/solitaire-2d-cover-960x480.png",
  domino: "/game-covers/exec-a58448f2-c357-4614-ac24-f21b1e36a34a.png",
  "tappy-plane": "/game-covers/tappy-plane-cover-960x480.png",
  "dress-up": "/game-covers/model-fashion-cover-960x480.png",
  "water-sort": "/game-covers/water-sort-cover-960x480.png",
};

export function TemplateGlyph({ templateId }: { templateId: GlyphId }) {
  const cover = GAME_COVERS[templateId];
  if (cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dashboard/export cards, not remote LCP
      <img src={cover} alt="" className="h-full w-full object-cover" aria-hidden />
    );
  }

  return (
    <svg viewBox="0 0 240 120" className="h-full w-full" aria-hidden>
      {templateId === "stack-tower" && (
        <>
          <rect x="90" y="70" width="60" height="18" rx="2" fill="#2a2e3a" />
          <rect x="96" y="50" width="48" height="18" rx="2" fill="#e07a3d" />
          <rect x="104" y="30" width="32" height="18" rx="2" fill="#2bb5a0" />
          <rect x="70" y="12" width="40" height="16" rx="2" fill="#7c5cff" opacity="0.9" />
        </>
      )}
      {templateId === "triple-match" && (
        <>
          <rect x="40" y="30" width="160" height="70" rx="10" fill="#3a2e22" />
          <circle cx="80" cy="58" r="12" fill="#e85d4c" />
          <circle cx="120" cy="58" r="12" fill="#f4c430" />
          <circle cx="160" cy="58" r="12" fill="#7c5cff" />
          <rect x="70" y="84" width="100" height="10" rx="3" fill="#1c1f2a" />
        </>
      )}
      {templateId === "tower-defense" && (
        <>
          <rect x="28" y="22" width="184" height="80" rx="8" fill="#3d5c32" />
          <path d="M40 48h70v14H92v28h70" fill="none" stroke="#7a5a32" strokeWidth="10" strokeLinejoin="round" />
          <rect x="58" y="28" width="14" height="28" rx="3" fill="#c4a574" />
          <rect x="118" y="58" width="16" height="32" rx="3" fill="#8a6a48" />
          <circle cx="176" cy="42" r="8" fill="#c45a3a" />
          <circle cx="196" cy="70" r="10" fill="#5cbf5a" />
        </>
      )}
      {templateId === "zombie-apocalypse" && (
        <>
          <rect x="20" y="18" width="200" height="90" rx="8" fill="#2a241c" />
          <rect x="36" y="42" width="28" height="52" fill="#3a3228" />
          <rect x="78" y="30" width="22" height="64" fill="#2e2820" />
          <rect x="168" y="38" width="34" height="56" fill="#3a3228" />
          <circle cx="198" cy="34" r="10" fill="#c4a050" opacity="0.85" />
          <rect x="108" y="68" width="12" height="28" rx="3" fill="#6a8a4a" />
          <circle cx="114" cy="62" r="7" fill="#7aa052" />
          <rect x="132" y="74" width="11" height="22" rx="3" fill="#5c7a40" />
          <circle cx="137" cy="70" r="6" fill="#6e9050" />
          <rect x="92" y="80" width="10" height="16" rx="2" fill="#4e6a38" />
          <circle cx="97" cy="76" r="5" fill="#628046" />
        </>
      )}
      {templateId === "water-sort" && (
        <>
          <rect x="52" y="28" width="22" height="70" rx="4" fill="none" stroke="#94a3b8" strokeWidth="3" />
          <rect x="56" y="62" width="14" height="14" fill="#ef4444" />
          <rect x="56" y="78" width="14" height="14" fill="#3b82f6" />
          <rect x="92" y="28" width="22" height="70" rx="4" fill="none" stroke="#34d399" strokeWidth="3" />
          <rect x="96" y="46" width="14" height="14" fill="#22c55e" />
          <rect x="96" y="62" width="14" height="14" fill="#22c55e" />
          <rect x="96" y="78" width="14" height="14" fill="#22c55e" />
          <rect x="132" y="28" width="22" height="70" rx="4" fill="none" stroke="#94a3b8" strokeWidth="3" />
          <rect x="136" y="78" width="14" height="14" fill="#eab308" />
          <rect x="172" y="28" width="22" height="70" rx="4" fill="none" stroke="#94a3b8" strokeWidth="3" />
        </>
      )}
      {templateId === "match-3" && (
        <>
          <rect x="48" y="22" width="144" height="80" rx="8" fill="#1e293b" />
          <circle cx="80" cy="50" r="12" fill="#f43f5e" />
          <circle cx="112" cy="50" r="12" fill="#38bdf8" />
          <circle cx="144" cy="50" r="12" fill="#a3e635" />
          <circle cx="80" cy="82" r="12" fill="#fbbf24" />
          <circle cx="112" cy="82" r="12" fill="#c084fc" />
          <circle cx="144" cy="82" r="12" fill="#f43f5e" />
        </>
      )}
      {templateId === "solitaire" && (
        <>
          <rect x="20" y="18" width="200" height="84" rx="8" fill="#14532d" />
          <rect x="42" y="32" width="34" height="48" rx="3" fill="#1e3a8a" />
          <rect x="82" y="32" width="34" height="48" rx="3" fill="#f8fafc" />
          <rect x="88" y="38" width="10" height="10" rx="1" fill="#dc2626" />
          <rect x="124" y="32" width="34" height="48" rx="3" fill="#f8fafc" />
          <rect x="164" y="32" width="34" height="48" rx="3" fill="#f8fafc" />
        </>
      )}
      {templateId === "domino" && (
        <>
          <rect x="20" y="18" width="200" height="84" rx="8" fill="#1e293b" />
          <rect x="48" y="50" width="52" height="24" rx="4" fill="#f1f5f9" />
          <circle cx="62" cy="62" r="3" fill="#0f172a" />
          <circle cx="86" cy="62" r="3" fill="#0f172a" />
          <rect x="108" y="50" width="52" height="24" rx="4" fill="#e2e8f0" />
          <circle cx="122" cy="56" r="3" fill="#0f172a" />
          <circle cx="122" cy="68" r="3" fill="#0f172a" />
          <circle cx="146" cy="62" r="3" fill="#0f172a" />
          <rect x="168" y="38" width="24" height="48" rx="4" fill="#f8fafc" />
        </>
      )}
      {templateId === "tappy-plane" && (
        <>
          <rect x="20" y="18" width="200" height="84" rx="8" fill="#7dd3fc" />
          <rect x="20" y="84" width="200" height="18" fill="#65a30d" />
          <path d="M54 28v56" stroke="#4b5563" strokeWidth="18" />
          <path d="M150 18v34" stroke="#4b5563" strokeWidth="18" />
          <ellipse cx="102" cy="58" rx="22" ry="12" fill="#38bdf8" />
          <path d="M92 58h28" stroke="#0f172a" strokeWidth="3" />
        </>
      )}
      {templateId === "racing-lap" && (
        <>
          <rect x="20" y="18" width="200" height="84" rx="8" fill="#4d7c0f" />
          <ellipse cx="120" cy="60" rx="70" ry="32" fill="none" stroke="#1f2937" strokeWidth="16" />
          <ellipse cx="120" cy="60" rx="70" ry="32" fill="none" stroke="#374151" strokeWidth="10" />
          <rect x="108" y="24" width="14" height="22" rx="3" fill="#ef4444" transform="rotate(18 115 35)" />
        </>
      )}
      {templateId === "top-down-shooter" && (
        <>
          <rect x="20" y="18" width="200" height="84" rx="8" fill="#3f6212" />
          <rect x="36" y="30" width="28" height="28" fill="#4d7c0f" />
          <rect x="176" y="64" width="28" height="28" fill="#4d7c0f" />
          <circle cx="120" cy="60" r="10" fill="#64748b" />
          <rect x="118" y="42" width="4" height="14" fill="#94a3b8" />
          <circle cx="86" cy="44" r="8" fill="#65a30d" />
          <circle cx="158" cy="78" r="8" fill="#3f6212" />
        </>
      )}
      {templateId === "dress-up" && (
        <>
          <rect x="20" y="18" width="200" height="84" rx="8" fill="#3b1d2a" />
          <ellipse cx="86" cy="96" rx="22" ry="6" fill="#1a1016" opacity="0.5" />
          <rect x="74" y="38" width="24" height="58" rx="10" fill="#e8b4a2" />
          <circle cx="86" cy="32" r="10" fill="#c48a72" />
          <path d="M70 58h32l6 36H64z" fill="#f4c9b8" />
          <rect x="128" y="46" width="28" height="36" rx="6" fill="#f8e7dc" />
          <rect x="164" y="46" width="28" height="36" rx="6" fill="#f8e7dc" />
          <rect x="134" y="54" width="16" height="20" rx="3" fill="#c45a6a" />
          <rect x="170" y="58" width="16" height="16" rx="3" fill="#2bb5a0" />
        </>
      )}
    </svg>
  );
}
