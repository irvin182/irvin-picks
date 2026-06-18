// lib/leagueConfig.ts

export type LeagueSettings = {
  reliability: number;
  goalFactor: number;
  banned: boolean;
};

const DEFAULT_CONFIG: LeagueSettings = {
  reliability: 0.7,
  goalFactor: 1.0,
  banned: false,
};

export const leagueConfig: Record<string, LeagueSettings> = {};

export function getLeagueSettings(leagueName?: string): LeagueSettings {
  if (!leagueName) return DEFAULT_CONFIG;

  return leagueConfig[leagueName] ?? DEFAULT_CONFIG;
}