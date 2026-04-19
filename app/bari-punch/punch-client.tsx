"use client";

import { GameMount } from "../components/game-mount";

function decoratePunchInterface(root: HTMLDivElement) {
  root.dataset.bariInterface = "punch";

  const inventoryTitle = root.querySelector("#inventory-header h2");
  if (inventoryTitle) {
    inventoryTitle.textContent = "Idea Keys";
  }

  const restartButton = root.querySelector("#restart-btn");
  if (restartButton) {
    restartButton.textContent = "Reset Composition";
  }

  const scoreboardButton = root.querySelector("#scoreboard-btn");
  if (scoreboardButton) {
    scoreboardButton.setAttribute("title", "View composition log");
  }
}

export default function PunchClient() {
  return (
    <GameMount
      loadModule={() => import("../../src/main")}
      shellClassName="bari-punch-shell"
      decorate={decoratePunchInterface}
    />
  );
}
