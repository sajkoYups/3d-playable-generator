"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditorStore } from "@/features/editor/store";

type UsedRow = {
  id: string;
  name: string;
  project: { id: string; name: string };
};

export function BrandUsedOnButton() {
  const brandId = useEditorStore((s) => s.brandId);
  const editorMode = useEditorStore((s) => s.editorMode);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>([]);

  useEffect(() => {
    if (!open || !brandId) return;
    void fetch(`/api/templates/${brandId}`)
      .then((r) => r.json())
      .then((data) => setRows((data.brand?.variations ?? []) as UsedRow[]));
  }, [open, brandId]);

  if (editorMode !== "brand" || !brandId) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Used on
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Used on</DialogTitle>
          </DialogHeader>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">Not stamped onto any variation yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/projects/${row.project.id}/variations/${row.id}/editor`}
                    className="text-accent underline"
                  >
                    {row.project.name} · {row.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
