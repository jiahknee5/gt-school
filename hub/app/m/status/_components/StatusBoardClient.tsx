"use client";

import { useCallback, useState } from "react";
import type { StatusBoard, StatusStage, DrawerSection } from "@/lib/status/board";
import { StatusHero } from "./StatusHero";
import { StatusMatrix } from "./StatusMatrix";
import { StatusRail } from "./StatusRail";
import { StatusDrawer } from "./StatusDrawer";
import { AskTheHubStrip } from "./AskTheHubStrip";

export function StatusBoardClient({
  board,
  selectedWeek,
}: {
  board: StatusBoard;
  selectedWeek?: string;
}) {
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
    const ns = board.northStar;
    // Rubric-structured Answer: Where / On track / Why / Do — the C-suite read order.
    const answerSections: DrawerSection[] = (board.answer.sections ?? []).map((s) => ({
      heading: s.label,
      bullets: s.bullets,
    }));
    const sections: DrawerSection[] = [
      { heading: "The verdict", lines: [board.answer.headline] },
      ...(answerSections.length
        ? answerSections
        : [{ heading: "Why — full answer", bullets: board.answer.bullets }]),
      {
        heading: "North star · deposits",
        kv: [
          { label: "Current", value: String(ns.current) },
          { label: "Target", value: String(ns.target) },
          { label: "Pace marker", value: String(ns.pace) },
          {
            label: "Gap to pace",
            value: `${ns.gap >= 0 ? "+" : ""}${ns.gap}`,
            tone: ns.gap < 0 ? "bad" : "good",
          },
          { label: "Weekly now", value: `${ns.weeklyActual}/wk` },
          { label: "Weekly needed", value: `${ns.weeklyRequired}/wk` },
          {
            label: "Projection",
            value: String(ns.projection),
            tone: ns.projection < ns.target ? "bad" : "good",
          },
        ],
      },
      ...(conv ? conv.drawerSections : []),
    ];
    setDrawerTitle("The Answer · North Star");
    setDrawerSections(sections);
    setDrawerOpen(true);
  }, [board.answer, board.northStar, board.stages]);

  return (
    <>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2.5 px-4 py-3 sm:px-6 lg:px-8">
        <StatusHero board={board} onDrillHero={openHeroDrawer} askSlot={<AskTheHubStrip week={selectedWeek} />} />
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
