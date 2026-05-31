export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  cronSecret: process.env.CRON_SECRET,
  apiFootballKey: process.env.API_FOOTBALL_KEY,
  apiFootballBaseUrl: process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io",
  apiFootballLeagueId: process.env.API_FOOTBALL_LEAGUE_ID ?? "1",
  apiFootballSeason: process.env.API_FOOTBALL_SEASON ?? "2026",
  apiFootballDailyBudget: Number(process.env.API_FOOTBALL_DAILY_BUDGET ?? "90"),
  apiFootballMinIntervalMs: Number(process.env.API_FOOTBALL_MIN_INTERVAL_MS ?? "1500"),
  openFootballWorldCupUrl:
    process.env.OPENFOOTBALL_WORLD_CUP_URL ?? "https://raw.githubusercontent.com/openfootball/worldcup/master/2026--usa/cup.txt"
};

export function hasSupabaseEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
