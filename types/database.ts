export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DraftableType = "team" | "player";
export type DraftStatus = "pending" | "active" | "complete";

export interface NationalTeam {
  id: string;
  fifa_code: string;
  name: string;
  confederation: string;
  group_name: string | null;
  flag_emoji: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  position: string;
  club: string | null;
  projected_points: number;
  national_teams?: Pick<NationalTeam, "name" | "flag_emoji" | "fifa_code">;
}

export interface League {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  max_members: number;
  roster_team_slots: number;
  roster_player_slots: number;
  scoring_rules: Json;
  created_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  display_name: string;
  draft_position: number | null;
  joined_at: string;
}

export interface Draft {
  id: string;
  league_id: string;
  status: DraftStatus;
  current_pick_number: number;
  round_count: number;
  seconds_per_pick: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface DraftPick {
  id: string;
  draft_id: string;
  league_member_id: string;
  pick_number: number;
  round_number: number;
  draftable_type: DraftableType;
  national_team_id: string | null;
  player_id: string | null;
  picked_at: string;
}

export interface LeagueStanding {
  league_id: string;
  league_member_id: string;
  display_name: string;
  total_points: number;
  team_points: number;
  player_points: number;
  rank: number;
}

export type Database = {
  public: {
    Tables: {
      leagues: {
        Row: League;
        Insert: Omit<League, "id" | "invite_code" | "created_at"> & Partial<Pick<League, "id" | "invite_code" | "created_at">>;
        Update: Partial<League>;
      };
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, "id" | "display_name"> & Partial<Pick<Profile, "avatar_url" | "created_at">>;
        Update: Partial<Profile>;
      };
      league_members: {
        Row: LeagueMember;
        Insert: Omit<LeagueMember, "id" | "joined_at"> & Partial<Pick<LeagueMember, "id" | "joined_at">>;
        Update: Partial<LeagueMember>;
      };
      national_teams: {
        Row: NationalTeam;
        Insert: Omit<NationalTeam, "id"> & Partial<Pick<NationalTeam, "id">>;
        Update: Partial<NationalTeam>;
      };
      players: {
        Row: Player;
        Insert: Omit<Player, "id" | "national_teams"> & Partial<Pick<Player, "id">>;
        Update: Partial<Omit<Player, "national_teams">>;
      };
      drafts: {
        Row: Draft;
        Insert: Omit<Draft, "id" | "updated_at"> & Partial<Pick<Draft, "id" | "updated_at">>;
        Update: Partial<Draft>;
      };
      draft_picks: {
        Row: DraftPick;
        Insert: Omit<DraftPick, "id" | "picked_at"> & Partial<Pick<DraftPick, "id" | "picked_at">>;
        Update: Partial<DraftPick>;
      };
    };
    Views: {
      league_standings: {
        Row: LeagueStanding;
      };
    };
    Functions: Record<string, never>;
    Enums: {
      draftable_type: DraftableType;
      draft_status: DraftStatus;
    };
  };
};
