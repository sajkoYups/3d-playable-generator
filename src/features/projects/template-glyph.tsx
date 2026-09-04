import type { TemplateId } from "@/types/project";

export function TemplateGlyph({ templateId }: { templateId: TemplateId }) {
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
      {templateId === "lane-runner" && (
        <>
          <rect x="70" y="10" width="8" height="100" fill="#f3ede0" opacity="0.3" />
          <rect x="116" y="10" width="8" height="100" fill="#f3ede0" opacity="0.3" />
          <rect x="162" y="10" width="8" height="100" fill="#f3ede0" opacity="0.3" />
          <rect x="108" y="78" width="24" height="28" rx="4" fill="#e07a3d" />
          <rect x="70" y="28" width="20" height="16" rx="2" fill="#e85d4c" />
          <circle cx="166" cy="40" r="8" fill="#e0b04a" />
        </>
      )}
      {templateId === "parking-jam" && (
        <>
          <rect x="40" y="20" width="160" height="80" fill="#2a2e3a" />
          <rect x="50" y="50" width="50" height="18" rx="3" fill="#e07a3d" />
          <rect x="110" y="28" width="18" height="54" rx="3" fill="#2bb5a0" />
          <rect x="140" y="60" width="46" height="18" rx="3" fill="#7c5cff" />
          <rect x="188" y="48" width="12" height="24" fill="#e07a3d" />
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
    </svg>
  );
}
