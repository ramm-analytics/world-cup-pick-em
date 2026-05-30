export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type DbRecord<T> = T & Record<string, unknown>;

export type DraftableType = "team" | "player";
export type DraftStatus = "pending" | "active" | "complete";

export type NationalTeam = {
  id: string;
  fifa_code: string;
  name: string;
  confederation: string;
  group_name: string | null;
  flag_emoji: string;
};

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type Player = {
  id: string;
  team_id: string;
  name: string;
  position: string;
  club: string | null;
  projected_points: number;
  national_teams?: Pick<NationalTeam, "name" | "flag_emoji" | "fifa_code">;
};

export type League = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  max_members: number;
  roster_team_slots: number;
  roster_player_slots: number;
  scoring_rules: Json;
  created_at: string;
};

export type LeagueMember = {
  id: string;
  league_id: string;
  user_id: string;
  display_name: string;
  draft_position: number | null;
  joined_at: string;
};

export type Draft = {
  id: string;
  league_id: string;
  status: DraftStatus;
  current_pick_number: number;
  round_count: number;
  seconds_per_pick: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type DraftPick = {
  id: string;
  draft_id: string;
  league_member_id: string;
  pick_number: number;
  round_number: number;
  draftable_type: DraftableType;
  national_team_id: string | null;
  player_id: string | null;
  picked_at: string;
};

export type LeagueStanding = {
  league_id: string;
  league_member_id: string;
  display_name: string;
  total_points: number;
  team_points: number;
  player_points: number;
  rank: number;
};

export type Database = {
  public: {
    Tables: {
      leagues: {
        Row: DbRecord<League>;
        Insert: DbRecord<Omit<League, "id" | "invite_code" | "created_at"> & Partial<Pick<League, "id" | "invite_code" | "created_at">>>;
        Update: DbRecord<Partial<League>>;
        Relationships: [];
      };
      profiles: {
        Row: DbRecord<Profile>;
        Insert: DbRecord<Pick<Profile, "id" | "display_name"> & Partial<Pick<Profile, "username" | "avatar_url" | "created_at">>>;
        Update: DbRecord<Partial<Profile>>;
        Relationships: [];
      };
      league_members: {
        Row: DbRecord<LeagueMember>;
        Insert: DbRecord<Omit<LeagueMember, "id" | "joined_at"> & Partial<Pick<LeagueMember, "id" | "joined_at">>>;
        Update: DbRecord<Partial<LeagueMember>>;
        Relationships: [];
      };
      national_teams: {
        Row: DbRecord<NationalTeam>;
        Insert: DbRecord<Omit<NationalTeam, "id"> & Partial<Pick<NationalTeam, "id">>>;
        Update: DbRecord<Partial<NationalTeam>>;
        Relationships: [];
      };
      players: {
        Row: DbRecord<Player>;
        Insert: DbRecord<Omit<Player, "id" | "national_teams"> & Partial<Pick<Player, "id">>>;
        Update: DbRecord<Partial<Omit<Player, "national_teams">>>;
        Relationships: [];
      };
      drafts: {
        Row: DbRecord<Draft>;
        Insert: DbRecord<Omit<Draft, "id" | "updated_at"> & Partial<Pick<Draft, "id" | "updated_at">>>;
        Update: DbRecord<Partial<Draft>>;
        Relationships: [];
      };
      draft_picks: {
        Row: DbRecord<DraftPick>;
        Insert: DbRecord<Omit<DraftPick, "id" | "picked_at"> & Partial<Pick<DraftPick, "id" | "picked_at">>>;
        Update: DbRecord<Partial<DraftPick>>;
        Relationships: [];
      };
    };
    Views: {
      league_standings: {
        Row: DbRecord<LeagueStanding>;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      draftable_type: DraftableType;
      draft_status: DraftStatus;
    };
  };
};
