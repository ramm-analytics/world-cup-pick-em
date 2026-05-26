import { redirect } from "next/navigation";
import { demoLeague } from "@/lib/mock-data";

export default function LeaguesPage() {
  redirect(`/leagues/${demoLeague.id}`);
}
