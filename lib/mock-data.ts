import type { Draft, DraftPick, League, LeagueMember, LeagueStanding, NationalTeam, Player } from "@/types/database";

export const demoLeague: League = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "North America 2026 Invitational",
  invite_code: "WC2026",
  owner_id: "22222222-2222-4222-8222-222222222222",
  max_members: 8,
  roster_team_slots: 2,
  roster_player_slots: 6,
  scoring_rules: {
    team_win: 3,
    team_draw: 1,
    team_goal: 1,
    player_goal: 4,
    player_assist: 3,
    clean_sheet: 2
  },
  created_at: new Date().toISOString()
};

export const demoMembers: LeagueMember[] = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    league_id: demoLeague.id,
    user_id: "22222222-2222-4222-8222-222222222221",
    display_name: "Ari",
    draft_position: 1,
    joined_at: new Date().toISOString()
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    league_id: demoLeague.id,
    user_id: "22222222-2222-4222-8222-222222222222",
    display_name: "Mina",
    draft_position: 2,
    joined_at: new Date().toISOString()
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    league_id: demoLeague.id,
    user_id: "22222222-2222-4222-8222-222222222223",
    display_name: "Sam",
    draft_position: 3,
    joined_at: new Date().toISOString()
  },
  {
    id: "33333333-3333-4333-8333-333333333334",
    league_id: demoLeague.id,
    user_id: "22222222-2222-4222-8222-222222222224",
    display_name: "Noor",
    draft_position: 4,
    joined_at: new Date().toISOString()
  }
];

export const demoTeams: NationalTeam[] = [
  { id: "44444444-4444-4444-8444-444444444441", fifa_code: "USA", name: "United States", confederation: "CONCACAF", group_name: "D", flag_emoji: "US" },
  { id: "44444444-4444-4444-8444-444444444442", fifa_code: "MEX", name: "Mexico", confederation: "CONCACAF", group_name: "A", flag_emoji: "MX" },
  { id: "44444444-4444-4444-8444-444444444443", fifa_code: "ARG", name: "Argentina", confederation: "CONMEBOL", group_name: "C", flag_emoji: "AR" },
  { id: "44444444-4444-4444-8444-444444444444", fifa_code: "BRA", name: "Brazil", confederation: "CONMEBOL", group_name: "E", flag_emoji: "BR" },
  { id: "44444444-4444-4444-8444-444444444445", fifa_code: "FRA", name: "France", confederation: "UEFA", group_name: "F", flag_emoji: "FR" },
  { id: "44444444-4444-4444-8444-444444444446", fifa_code: "ENG", name: "England", confederation: "UEFA", group_name: "G", flag_emoji: "EN" }
];

export const demoPlayers: Player[] = [
  { id: "55555555-5555-4555-8555-555555555551", team_id: demoTeams[2].id, name: "Lionel Messi", position: "FW", club: "Inter Miami", projected_points: 54, national_teams: { name: "Argentina", flag_emoji: "AR", fifa_code: "ARG" } },
  { id: "55555555-5555-4555-8555-555555555552", team_id: demoTeams[4].id, name: "Kylian Mbappe", position: "FW", club: "Real Madrid", projected_points: 56, national_teams: { name: "France", flag_emoji: "FR", fifa_code: "FRA" } },
  { id: "55555555-5555-4555-8555-555555555553", team_id: demoTeams[3].id, name: "Vinicius Junior", position: "FW", club: "Real Madrid", projected_points: 50, national_teams: { name: "Brazil", flag_emoji: "BR", fifa_code: "BRA" } },
  { id: "55555555-5555-4555-8555-555555555554", team_id: demoTeams[5].id, name: "Jude Bellingham", position: "MF", club: "Real Madrid", projected_points: 46, national_teams: { name: "England", flag_emoji: "EN", fifa_code: "ENG" } },
  { id: "55555555-5555-4555-8555-555555555555", team_id: demoTeams[0].id, name: "Christian Pulisic", position: "FW", club: "AC Milan", projected_points: 42, national_teams: { name: "United States", flag_emoji: "US", fifa_code: "USA" } }
];

export const demoDraft: Draft = {
  id: "66666666-6666-4666-8666-666666666666",
  league_id: demoLeague.id,
  status: "active",
  current_pick_number: 4,
  round_count: 8,
  seconds_per_pick: 90,
  started_at: new Date().toISOString(),
  completed_at: null,
  updated_at: new Date().toISOString()
};

export const demoPicks: DraftPick[] = [
  { id: "77777777-7777-4777-8777-777777777771", draft_id: demoDraft.id, league_member_id: demoMembers[0].id, pick_number: 1, round_number: 1, draftable_type: "player", player_id: demoPlayers[1].id, national_team_id: null, picked_at: new Date().toISOString() },
  { id: "77777777-7777-4777-8777-777777777772", draft_id: demoDraft.id, league_member_id: demoMembers[1].id, pick_number: 2, round_number: 1, draftable_type: "team", player_id: null, national_team_id: demoTeams[2].id, picked_at: new Date().toISOString() },
  { id: "77777777-7777-4777-8777-777777777773", draft_id: demoDraft.id, league_member_id: demoMembers[2].id, pick_number: 3, round_number: 1, draftable_type: "player", player_id: demoPlayers[2].id, national_team_id: null, picked_at: new Date().toISOString() }
];

export const demoStandings: LeagueStanding[] = [
  { league_id: demoLeague.id, league_member_id: demoMembers[1].id, display_name: "Mina", total_points: 18, team_points: 12, player_points: 6, rank: 1 },
  { league_id: demoLeague.id, league_member_id: demoMembers[0].id, display_name: "Ari", total_points: 16, team_points: 4, player_points: 12, rank: 2 },
  { league_id: demoLeague.id, league_member_id: demoMembers[2].id, display_name: "Sam", total_points: 11, team_points: 0, player_points: 11, rank: 3 },
  { league_id: demoLeague.id, league_member_id: demoMembers[3].id, display_name: "Noor", total_points: 0, team_points: 0, player_points: 0, rank: 4 }
];
