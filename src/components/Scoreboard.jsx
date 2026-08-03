import { LivePip } from "./UI";
import { Skeleton } from "./Skeleton";

// Signature element: faint terracing-step texture behind the live scoreboard.
export function Scoreboard({ match, loading = false }) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-cardLg border border-black/10 dark:border-white/10 bg-night-pitch text-floodlight p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="w-16 h-4 rounded" />
          <Skeleton className="w-12 h-4 rounded" />
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <Skeleton className="w-1/2 h-8 rounded" />
          <Skeleton className="w-10 h-8 rounded" />
        </div>
        <div className="my-4 h-px bg-terracing/40" />
        <div className="flex items-center justify-between gap-4 py-2">
          <Skeleton className="w-1/2 h-8 rounded" />
          <Skeleton className="w-10 h-8 rounded" />
        </div>
      </div>
    );
  }

  const safeMatch = {
    home: { 
      name: match?.home?.name ?? "TBD", 
      score: match?.home?.score ?? 0 
    },
    away: { 
      name: match?.away?.name ?? "TBD", 
      score: match?.away?.score ?? 0 
    },
    status: match?.status ?? "SCHEDULED",
    minute: match?.minute ?? "",
  };

  return (
    <div className="relative overflow-hidden rounded-cardLg border border-black/10 dark:border-white/10 bg-night-pitch text-floodlight">
      <div className="absolute inset-0 bg-terracing-steps pointer-events-none" aria-hidden="true" />
      <div className="relative p-5">
        <div className="flex items-center justify-between">
          <LivePip />
          <span className="font-mono text-xs tracking-[0.1em] text-amber-live">
            {safeMatch.status} {safeMatch.minute}
          </span>
        </div>

        <Row name={safeMatch.home.name} score={safeMatch.home.score} />
        <div className="my-4 h-px bg-terracing/40" />
        <Row name={safeMatch.away.name} score={safeMatch.away.score} />
      </div>
    </div>
  );
}

function Row({ name, score }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-display font-bold uppercase leading-none text-3xl max-w-[70%] text-balance min-w-0 flex-1 truncate">
        {name}
      </span>
      <span className="font-mono font-bold text-5xl tabular-nums leading-none">
        {score}
      </span>
    </div>
  );
}

// Dense data uses a plain hard grid — no card wrapper, no color coding.
export function LeagueTable({ rows }) {
  return (
    <table className="w-full border-collapse font-mono text-xs">
      <thead>
        <tr className="text-left text-terracing/70 dark:text-floodlight/50 font-mono">
          <Th>Rank</Th>
          <Th>Team</Th>
          <Th className="text-right">Played</Th>
          <Th className="text-right">Goal</Th>
          <Th className="text-right">Points</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.rank} className="text-night-pitch dark:text-floodlight font-mono">
            <Td>{r.rank}</Td>
            <Td>{r.team}</Td>
            <Td className="text-right">{r.played}</Td>
            <Td className="text-right">{r.gd}</Td>
            <Td className="text-right">{r.points}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`border border-black/10 dark:border-white/10 px-2 py-1.5 font-medium ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return (
    <td className={`border border-black/10 dark:border-white/10 px-2 py-1.5 ${className}`}>
      {children}
    </td>
  );
}