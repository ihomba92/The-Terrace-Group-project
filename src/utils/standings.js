/**
 * Computes league standings (played, goal difference, points) from a league's
 * teams and matches, matching the shape LeagueTable expects.
 */
export function computeStandings(league) {
  const teams = league?.teams || [];
  const matches = league?.matches || [];

  const stats = {};
  teams.forEach((t) => {
    stats[t.id] = {
      team: t.name,
      played: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
  });

  matches
    .filter((m) => m.status === "FINISHED")
    .forEach((m) => {
      const home = stats[m.home_team?.id];
      const away = stats[m.away_team?.id];
      if (!home || !away) return;

      const hs = m.home_score ?? 0;
      const as = m.away_score ?? 0;

      home.played += 1;
      away.played += 1;
      home.goalsFor += hs;
      home.goalsAgainst += as;
      away.goalsFor += as;
      away.goalsAgainst += hs;

      if (hs > as) {
        home.points += 3;
      } else if (as > hs) {
        away.points += 3;
      } else {
        home.points += 1;
        away.points += 1;
      }
    });

  const rows = Object.values(stats)
    .map((s) => ({
      team: s.team,
      played: s.played,
      gd: s.goalsFor - s.goalsAgainst,
      points: s.points,
    }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd);

  return rows.map((r, i) => ({
    rank: i + 1,
    team: r.team,
    played: r.played,
    gd: r.gd >= 0 ? `+${r.gd}` : `${r.gd}`,
    points: r.points,
  }));
}