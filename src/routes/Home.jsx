import { useState, useMemo, useEffect } from "react";
import { Screen, Header } from "../components/UI";
import BottomNav from "../components/BottomNav";
import ArticleCard from "../components/ArticleCard";
import { LeagueTable } from "../components/Scoreboard";
import { Skeleton } from "../components/Skeleton";
import { categories } from "../data";
import { leaguesApi } from "../services/api";
import { computeStandings } from "../utils/standings";
import { externalNewsApi } from "../services/api";
import { mapArticle } from "../api/mappers";

// Scoreboard-style scrolling ticker — the page's signature element

// function TickerTape({ items }) {
//   if (!items || items.length === 0) return null;
//   return (
//     <div className="relative overflow-hidden bg-night-pitch border-y border-amber-live/30">
//       <div className="flex whitespace-nowrap animate-[ticker_28s_linear_infinite] hover:[animation-play-state:paused]">
//         {[...items, ...items].map((t, i) => (
//           <span
//             key={i}
//             className="font-mono text-[11px] tracking-[0.12em] uppercase text-amber-live px-6 py-2 shrink-0"
//           >
//             <span className="text-red-600 mr-2">●</span>
//             {t}
//           </span>
//         ))}
//       </div>
//       <style>{`
//         @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
//         @media (prefers-reduced-motion: reduce) {
//           .animate-\\[ticker_28s_linear_infinite\\] { animation: none; }
//         }
//       `}</style>
//     </div>
//   );
// }

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const searchQuery = activeCategory === "ALL" ? "football" : activeCategory;

    externalNewsApi
      .getExternal({ q: searchQuery })
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res.data?.articles)
            ? res.data.articles
            : [];
          setArticles(items.map(mapArticle));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch articles:", err);
          if (err.response?.status === 429) {
            setArticles([{
              id: "rate-limit",
              title: "Rate Limit Exceeded",
              description: "You've made too many requests. Please wait a moment before trying again.",
            }]);
          } else {
            setArticles([]);
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  const categoryNames = useMemo(
    () => ["ALL", ...(categories || []).map((c) => c.name)],
    [],
  );

  useEffect(() => {
    leaguesApi
      .getAll()
      .then((res) => {
        const leagues = res.data?.leagues || [];
        const primaryLeague = leagues[0];
        if (primaryLeague) {
          setStandings(computeStandings(primaryLeague));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch leagues:", err);
        setStandings([]);
      });
  }, []);

  const tickerHeadlines = useMemo(
    () => articles.slice(0, 6).map((a) => a.title).filter(Boolean),
    [articles],
  );

  return (
    <Screen sidebar nav>
      <Header title="The Terrace" />

      <TickerTape items={tickerHeadlines} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full bg-[#F5F3EC] dark:bg-[#0B1F17]">
        {/* Category Filter Pills — styled like matchday squad-number tabs */}
        <div className="flex gap-2 overflow-x-auto px-1 pb-3 mb-6 border-b-2 border-[#C9C2B4]/40 dark:border-[#E8A33D]/15">
          {categoryNames.map((name) => {
            const isActive = activeCategory === name;
            return (
              <button
                key={name}
                onClick={() => setActiveCategory(name)}
                className={
                  "shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.1em] px-3.5 py-1.5 rounded-full border-2 transition-all duration-150 active:translate-y-[1px] " +
                  (isActive
                    ? "bg-[#E8A33D] text-[#0B1F17] border-[#E8A33D] shadow-[0_2px_0_rgba(0,0,0,0.25)]"
                    : "border-[#C9C2B4]/50 text-[#0B1F17]/70 dark:text-[#F5F3EC]/70 dark:border-[#F5F3EC]/15 hover:border-[#E8A33D] hover:text-[#0B1F17] dark:hover:text-[#F5F3EC]")
                }
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* Article Cards Grid & Skeleton Loader */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col border-2 border-[#C9C2B4]/30 dark:border-[#F5F3EC]/10 rounded-xl overflow-hidden bg-white dark:bg-[#0B1F17]"
              >
                <Skeleton className="w-full h-40 rounded-none" />
                <div className="px-4 py-4 flex flex-col gap-3 flex-grow">
                  <Skeleton className="w-16 h-4" />
                  <Skeleton className="w-full h-6" />
                  <Skeleton className="w-3/4 h-4" />
                  <Skeleton className="w-20 h-4" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="py-14 text-center font-mono text-sm uppercase tracking-wide text-[#0B1F17]/50 dark:text-[#F5F3EC]/40 border-2 border-dashed border-[#C9C2B4]/50 dark:border-[#F5F3EC]/15 rounded-xl">
            No articles match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {articles.map((a, index) => (
              <ArticleCard key={a.id || index} article={a} />
            ))}
          </div>
        )}

        {/* League Table Section — framed like a real scoreboard */}
 
      <section className="py-8">
        <div className="mb-4">
          <span className="block h-[3px] w-full bg-amber-live mb-3" />
          <h2 className="font-display font-bold uppercase text-2xl tracking-wide text-night-pitch dark:text-floodlight">
            League Table
          </h2>
        </div>
        {standings.length > 0 ? (
          <LeagueTable rows={standings} />
        ) : (
          <p className="font-mono text-sm text-terracing/60 dark:text-floodlight/50">
            No standings available yet.
          </p>
        )}
      </section>
      </main>

      <BottomNav active="home" />
    </Screen>
  );
}