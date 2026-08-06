import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Screen, Header } from "../components/UI";
import BottomNav from "../components/BottomNav";
import ArticleCard from "../components/ArticleCard";
import { Scoreboard } from "../components/Scoreboard";
import { Skeleton } from "../components/Skeleton";
import { categories } from "../data";
import api, { matchesApi } from "../api/client";
import { mapArticle } from "../api/mappers";

const filters = ["For You", "Match Reports", "Fan Reactions", "Following"];

// Loose match against article.kind so this survives minor naming drift
// from the backend (e.g. "MATCH_REPORT" vs "Match Report" vs "match-report").
const normalize = (str) => (str || "").toUpperCase().replace(/[^A-Z]/g, "");

const FILTER_KIND_ALIASES = {
  "Match Reports": ["MATCHREPORT", "MATCHREPORTS", "REPORT"],
  "Fan Reactions": ["FANREACTION", "FANREACTIONS", "REACTION"],
};

export default function Feed() {
  const [articles, setArticles] = useState([]);
  const [liveMatch, setLiveMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(filters[0]);

  const [searchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchData = async () => {
      try {
        let categoryId = null;
        if (selectedCategory) {
          try {
            const catRes = await api.get("/categories");
            const dbCategories = Array.isArray(catRes.data) ? catRes.data : [];
            const found = dbCategories.find(
              (c) => (c.category_name || c.name || "").toLowerCase() === selectedCategory.toLowerCase()
            );
            if (found) categoryId = found.category_id || found.id;
          } catch {
            const found = categories.find(
              (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
            );
            if (found) categoryId = found.id;
          }
        }

        const endpoint = categoryId
          ? `/articles?category_id=${categoryId}`
          : "/articles";

        const [articlesRes, matchRes] = await Promise.allSettled([
          api.get(endpoint),
          matchesApi.getAll({ status: "LIVE" }).catch(() => null)
        ]);

        if (!cancelled) {
          if (articlesRes.status === "fulfilled") {
            const items = Array.isArray(articlesRes.value.data)
              ? articlesRes.value.data
              : (articlesRes.value.data?.articles || []);
            setArticles(items.map(mapArticle));
          }

          if (matchRes.status === "fulfilled" && matchRes.value) {
            const matchData = matchRes.value.data;
            const activeMatch = Array.isArray(matchData) ? matchData[0] : matchData;
            setLiveMatch(activeMatch || null);
          }

          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch feed data:", err);
          setArticles([]);
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  const filteredArticles = useMemo(() => {
    if (activeFilter === "For You") return articles;

    if (activeFilter === "Following") {
      // Needs a real "isFollowing" flag from the API — mapArticle doesn't
      // set one yet, so this correctly returns empty until that's wired up
      // rather than silently showing everything.
      return articles.filter((a) => a.isFollowing);
    }

    const aliases = FILTER_KIND_ALIASES[activeFilter] || [];
    return articles.filter((a) => aliases.includes(normalize(a.kind)));
  }, [articles, activeFilter]);

  return (
    <Screen sidebar nav>
      <Header title={selectedCategory ? selectedCategory : "Your Feed"} />

      <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8 py-3 border-b border-black/10 dark:border-white/10">
        {filters.map((f) => {
          const isActive = f === activeFilter;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={
                "shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.1em] px-3.5 py-1.5 rounded-full border-2 transition-all duration-150 active:translate-y-[1px] " +
                (isActive
                  ? "bg-amber-live text-night-pitch border-amber-live shadow-[0_2px_0_rgba(0,0,0,0.25)]"
                  : "border-black/10 dark:border-white/15 text-terracing/70 dark:text-floodlight/50 hover:border-amber-live hover:text-night-pitch dark:hover:text-floodlight")
              }>
              {f}
            </button>
          );
        })}
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="pt-4">
          <Scoreboard match={liveMatch} loading={loading && !liveMatch} />
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
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
        ) : filteredArticles.length === 0 ? (
          <div className="mt-6 py-14 text-center font-mono text-sm uppercase tracking-wide text-terracing/50 dark:text-floodlight/40 border-2 border-dashed border-black/10 dark:border-white/10 rounded-card">
            {activeFilter === "Following"
              ? "Follow authors to see their posts here."
              : `No ${activeFilter.toLowerCase()} to show right now.`}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {filteredArticles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </main>

      <BottomNav active="feed" />
    </Screen>
  );
}