import { useState, useEffect } from "react";
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

export default function Feed() {
  const [articles, setArticles] = useState([]);
  const [liveMatch, setLiveMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  
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

        // Fetch articles and live matches concurrently using the api client
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

  return (
    <Screen sidebar nav>
      <Header title={selectedCategory ? selectedCategory : "Your Feed"} />

      <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8 py-3 border-b border-black/10 dark:border-white/10">
        {filters.map((f, i) => (
          <button
            key={f}
            className={
              "shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] px-3 py-1.5 rounded-card border transition-colors duration-100 active:translate-y-[2px] " +
              (i === 0
                ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                : "bg-transparent text-terracing/70 dark:text-floodlight/50 hover:text-black dark:hover:text-white border-black/10 dark:border-white/10")
            }>
            {f}
          </button>
        ))}
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="pt-4">
          <Scoreboard match={liveMatch} />
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
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </main>

      <BottomNav active="feed" />
    </Screen>
  );
}