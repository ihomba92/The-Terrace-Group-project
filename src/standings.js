export function computeStandings(league) {
  const teams = league?.teams || [];

  return teams.map((team, index) => ({
    rank: index + 1,
    team: team.name,
    played: team.played || 0,
    goal: team.goal_difference || team.goal || 0,
    points: team.points || 0,
  }));
}