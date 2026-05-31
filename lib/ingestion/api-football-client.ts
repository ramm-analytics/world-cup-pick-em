import { env } from "@/lib/env";
import type { SyncCounts } from "@/lib/ingestion/types";

type ApiFootballPaging = {
  current: number;
  total: number;
};

export type ApiFootballResponse<T> = {
  errors?: unknown;
  paging?: ApiFootballPaging;
  response: T[];
};

export type ApiFootballTeam = {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string | null;
    logo: string | null;
  };
};

export type ApiFootballFixture = {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods?: { first: number | null; second: number | null };
    venue?: { id: number | null; name: string | null; city: string | null };
    status: { long: string; short: string; elapsed: number | null };
  };
  league?: {
    id: number;
    name: string;
    season: number;
    round: string;
  };
  teams: {
    home: { id: number | null; name: string; logo?: string | null; winner?: boolean | null };
    away: { id: number | null; name: string; logo?: string | null; winner?: boolean | null };
  };
  goals: { home: number | null; away: number | null };
};

export type ApiFootballStandingGroup = Array<{
  rank: number;
  team: { id: number; name: string; logo: string | null };
  group: string;
}>;

export type ApiFootballStanding = {
  league: {
    standings: ApiFootballStandingGroup[];
  };
};

export type ApiFootballPlayer = {
  player: {
    id: number;
    name: string;
    firstname?: string;
    lastname?: string;
    age?: number | null;
    nationality?: string | null;
    photo?: string | null;
  };
  statistics: Array<{
    team?: { id: number; name: string; logo?: string | null };
    games?: { position?: string | null };
  }>;
};

export type ApiFootballFixturePlayers = {
  team: { id: number; name: string };
  players: Array<{
    player: { id: number; name: string; photo?: string | null };
    statistics: Array<{
      games?: { minutes?: number | null; position?: string | null };
      goals?: { total?: number | null; assists?: number | null; conceded?: number | null };
    }>;
  }>;
};

export class RequestBudget {
  private spent = 0;

  constructor(private readonly maxRequests: number, private readonly alreadyUsed = 0) {}

  get remaining() {
    return Math.max(this.maxRequests - this.alreadyUsed - this.spent, 0);
  }

  get count() {
    return this.spent;
  }

  spend() {
    if (this.remaining <= 0) {
      throw new Error("API-Football request budget exhausted.");
    }

    this.spent += 1;
  }
}

export class ApiFootballClient {
  private lastRequestAt = 0;

  constructor(
    private readonly apiKey = env.apiFootballKey,
    private readonly baseUrl = env.apiFootballBaseUrl,
    private readonly minIntervalMs = env.apiFootballMinIntervalMs
  ) {}

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  async get<T>(path: string, params: Record<string, string | number | undefined>, budget: RequestBudget): Promise<ApiFootballResponse<T>> {
    if (!this.apiKey) {
      throw new Error("Missing API_FOOTBALL_KEY.");
    }

    budget.spend();
    await this.waitForSpacing();

    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: {
        "x-apisports-key": this.apiKey
      },
      cache: "no-store"
    });

    if (response.status === 429) {
      throw new Error("API-Football rate limit reached.");
    }

    if (!response.ok) {
      throw new Error(`API-Football request failed with ${response.status}.`);
    }

    const body = (await response.json()) as ApiFootballResponse<T>;
    if (body.errors && hasApiErrors(body.errors)) {
      throw new Error(`API-Football returned errors: ${JSON.stringify(body.errors)}`);
    }

    return body;
  }

  private async waitForSpacing() {
    const waitMs = this.minIntervalMs - (Date.now() - this.lastRequestAt);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.lastRequestAt = Date.now();
  }
}

function hasApiErrors(errors: unknown) {
  if (!errors) {
    return false;
  }

  if (Array.isArray(errors)) {
    return errors.length > 0;
  }

  if (typeof errors === "object") {
    return Object.keys(errors).length > 0;
  }

  return true;
}

export function makeApiFootballCounts(budget: RequestBudget): Pick<SyncCounts, "apiRequests"> {
  return { apiRequests: budget.count };
}
