"use client";

import { useCallback, useState } from "react";
import type { StatusBoard, StatusStage, DrawerSection } from "@/lib/status/board";
import { StatusHero } from "./StatusHero";
import { StatusMatrix } from "./StatusMatrix";
import { StatusRail } from "./StatusRail";
import { StatusDrawer } from "./StatusDrawer";
import { AskTheHubStrip } from "./AskTheHubStrip";

export function StatusBoardClient({ board }: { board: StatusBoard }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("Details");
  const [drawerSections, setDrawerSections] = useState<DrawerSection[]>([]);

  const openDrawer = useCallback((title: string, stage: StatusStage) => {
    setDrawerTitle(title);
    setDrawerSections(stage.drawerSections);
    setDrawerOpen(true);
  }, []);

  const openHeroDrawer = useCallback(() => {
    const conv = board.stages.find((s) => s.key === "conversion");
    if (!conv) return;
    setDrawerTitle("North Star · Deposits");
    setDrawerSections(conv.drawerSections);
    setDrawerOpen(true);
  }, [board.stages]);

  return (
    <>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <StatusHero board={board} onDrillHero={openHeroDrawer} askSlot={<AskTheHubStrip />} />
        <StatusMatrix board={board} onOpenStage={openDrawer} />
        <StatusRail board={board} />
      </div>
      <StatusDrawer
        open={drawerOpen}
        title={drawerTitle}
        sections={drawerSections}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
