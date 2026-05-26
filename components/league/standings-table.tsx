import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LeagueStanding } from "@/types/database";

export function StandingsTable({ standings }: { standings: LeagueStanding[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Manager</TableHead>
          <TableHead className="text-right">Teams</TableHead>
          <TableHead className="text-right">Players</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((standing) => (
          <TableRow key={standing.league_member_id}>
            <TableCell className="font-medium">{standing.rank}</TableCell>
            <TableCell>{standing.display_name}</TableCell>
            <TableCell className="text-right">{standing.team_points}</TableCell>
            <TableCell className="text-right">{standing.player_points}</TableCell>
            <TableCell className="text-right font-semibold">{standing.total_points}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
