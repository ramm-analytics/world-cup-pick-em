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
export type MatchStage = "group" | "round_of_32" | "round_of_16" | "quarterfinal" | "semifinal" | "third_place" | "final";

export type NationalTeam = {
  id: string;
  fifa_code: string;
  name: string;
  confederation: string;
  group_name: string | null;
  flag_emoji: string;
  external_source: string | null;
  external_id: string | null;
  logo_url: string | null;
};

export type Profile = {
  id: string;
  username: string | null;
  name: string;
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
  external_source: string | null;
  external_id: string | null;
  photo_url: string | null;
  national_teams?: Pick<NationalTeam, "name" | "flag_emoji" | "fifa_code">;
};

export type Match = {
  id: string;
  stage: MatchStage;
  home_team_id: string;
  away_team_id: string;
  starts_at: string;
  home_score: number | null;
  away_score: number | null;
  is_final: boolean;
  external_source: string | null;
  external_id: string | null;
  match_number: number | null;
  status: string | null;
  venue: string | null;
};

export type PlayerMatchStat = {
  id: string;
  match_id: string;
  player_id: string;
  goals: number;
  assists: number;
  clean_sheet: boolean;
  minutes: number;
  external_source: string | null;
  external_id: string | null;
};

export type DataSyncRun = {
  id: string;
  source: string;
  mode: string;
  status: "running" | "success" | "partial" | "skipped" | "failed";
  started_at: string;
  finished_at: string | null;
  counts: Json;
  error: string | null;
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
        Insert: DbRecord<Pick<Profile, "id" | "name"> & Partial<Pick<Profile, "username" | "avatar_url" | "created_at">>>;
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
        Insert: DbRecord<
          Omit<NationalTeam, "id" | "external_source" | "external_id" | "logo_url"> &
            Partial<Pick<NationalTeam, "id" | "external_source" | "external_id" | "logo_url">>
        >;
        Update: DbRecord<Partial<NationalTeam>>;
        Relationships: [];
      };
      players: {
        Row: DbRecord<Player>;
        Insert: DbRecord<
          Omit<Player, "id" | "national_teams" | "external_source" | "external_id" | "photo_url"> &
            Partial<Pick<Player, "id" | "external_source" | "external_id" | "photo_url">>
        >;
        Update: DbRecord<Partial<Omit<Player, "national_teams">>>;
        Relationships: [];
      };
      matches: {
        Row: DbRecord<Match>;
        Insert: DbRecord<Omit<Match, "id"> & Partial<Pick<Match, "id">>>;
        Update: DbRecord<Partial<Match>>;
        Relationships: [];
      };
      player_match_stats: {
        Row: DbRecord<PlayerMatchStat>;
        Insert: DbRecord<Omit<PlayerMatchStat, "id"> & Partial<Pick<PlayerMatchStat, "id">>>;
        Update: DbRecord<Partial<PlayerMatchStat>>;
        Relationships: [];
      };
      data_sync_runs: {
        Row: DbRecord<DataSyncRun>;
        Insert: DbRecord<
          Omit<DataSyncRun, "id" | "started_at" | "finished_at" | "counts" | "error"> &
            Partial<Pick<DataSyncRun, "id" | "started_at" | "finished_at" | "counts" | "error">>
        >;
        Update: DbRecord<Partial<DataSyncRun>>;
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
      match_stage: MatchStage;
    };
  };
};
