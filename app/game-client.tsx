"use client";

import { GameMount } from "./components/game-mount";

export default function GameClient() {
  return <GameMount loadModule={() => import("../src/main")} />;
}
