import { redirect } from "next/navigation";

export default function GamePage() {
  redirect("/game/active_games");
} 