import { useState, useMemo, useEffect } from "react";
import { Screen, Header } from "../components/UI";
import BottomNav from "../components/BottomNav";
import ArticleCard from "../components/ArticleCard";
import { LeagueTable } from "../components/Scoreboard";
import { Skeleton } from "../components/Skeleton";
import { categories, table } from "../data";
import api from "../api/client";
import { mapArticle } from "../api/mappers";

export default function HomeFeed() {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/articles")
      .then((res) => {
        if (!cancelled) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.articles ?? []);
          const items = Array.isArray(raw) ? raw : [];
          setArticles(items.map(mapArticle));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch articles:", err);
          setArticles([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryNames = useMemo(
    () => ["ALL", ...categories.map((c) => c.name)],
    [],
  );

  const filtered = useMemo(() => {
    if (activeCategory === "ALL") return articles;
    return articles.filter(
      (a) => a.category === activeCategory || a.kind === activeCategory,
    );
  }, [activeCategory, articles]);

  return (
    <Screen sidebar nav>
      <Header title="The Terrace" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col border border-black/10 dark:border-white/10 rounded-card overflow-hidden">
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
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10 rounded-card">
            No articles match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {filtered.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}

        <section className="py-6">
          <h2 className="font-display font-bold uppercase text-lg tracking-wide text-night-pitch dark:text-floodlight mb-3">
            League Table
          </h2>
          <LeagueTable rows={table} />
        </section>
      </main>

      <BottomNav active="home" />
    </Screen>
  );
}
