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

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState([]);

  // Re-fetch news whenever the active category changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // If "ALL" is selected, default to "football", otherwise use the category name
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
          
          // Check if rate-limited (429)
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
  }, [activeCategory]); // Triggers a new fetch when user clicks different category buttons

  const categoryNames = useMemo(
    () => ["ALL", ...(categories || []).map((c) => c.name)],
    [],
  );

  useEffect(() => {
    leaguesApi
      .getAll()
      .then((res) => {
        const leagues = res.data?.leagues || [];
        // Default to the first league (adjust if you want a specific one, e.g. Premier League)
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

  return (
    <Screen sidebar nav>
      <Header title="The Terrace" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 pb-3 border-b border-black/10 dark:border-white/10 mb-6">
          {categoryNames.map((name) => {
            const isActive = activeCategory === name;
            return (
              <button
                key={name}
                onClick={() => setActiveCategory(name)}
                className={
                  "shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] px-3 py-1.5 rounded-card border transition-colors duration-100 active:translate-y-[2px] " +
                  (isActive
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "border-black/10 dark:border-white/10 text-night-pitch dark:text-floodlight/80 hover:text-black dark:hover:text-white")
                }>
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
                className="flex flex-col border border-black/10 dark:border-white/10 rounded-card overflow-hidden">
                <Skeleton className="w-full h-40 rounded-none" />
                <div className="px-4 py-4 flex flex-col gap-3 flex-grow bg-white/80 dark:bg-terracing/40">
                  <Skeleton className="w-16 h-4" />
                  <Skeleton className="w-full h-6" />
                  <Skeleton className="w-3/4 h-4" />
                  <Skeleton className="w-20 h-4" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10 rounded-card">
            No articles match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {articles.map((a, index) => (
              <ArticleCard key={a.id || index} article={a} />
            ))}
          </div>
        )}

        {/* League Table Section */}
        <section className="py-6">
          <h2 className="font-display font-bold uppercase text-lg tracking-wide text-night-pitch dark:text-floodlight mb-3">
            League Table
          </h2>
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