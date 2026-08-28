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
    </svg>
  );
}
