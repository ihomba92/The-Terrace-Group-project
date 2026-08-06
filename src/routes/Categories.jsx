import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Screen, Header, KindLabel } from "../components/UI";
import { Skeleton } from "../components/Skeleton";
import BottomNav from "../components/BottomNav";
import { articles } from "../data";
import api from "../api/client";
import { mapCategory } from "../api/mappers";

export default function Categories() {
  const [fetchedCategories, setFetchedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const trending = articles.slice(0, 3);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/categories")
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res.data) ? res.data : [];
          setFetchedCategories(items.map(mapCategory));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch categories:", err);
          setFetchedCategories([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen sidebar nav>
      <Header title="Browse" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="pt-5">
          <h2 className="font-display font-bold uppercase text-lg tracking-wide text-night-pitch dark:text-floodlight mb-3">
            Categories
          </h2>
        </div>

        {/* plain hard grid of categories, hairline dividers */}
        {loading ? (
          <div className="border-t border-black/10 dark:border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-4 border-b border-black/10 dark:border-white/10 md:border-r md:last:border-r-0">
                <Skeleton className="w-3/4 h-5 mb-2" />
                <Skeleton className="w-16 h-4" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="border-t border-black/10 dark:border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {fetchedCategories.map((c) => (
              <li key={c.name}>
                <Link
                  to={`/feed?category=${encodeURIComponent(c.name)}`}
                  className="flex items-center justify-between px-4 py-4 border-b border-black/10 dark:border-white/10 md:border-r md:last:border-r-0
                  text-night-pitch dark:text-floodlight hover:bg-black/5 dark:hover:bg-white/5
                  transition-colors duration-100">
                  <span className="font-display font-semibold uppercase tracking-wide text-lg min-w-0 truncate">
                    {c.name}
                  </span>
                  <span className="font-mono text-xs text-terracing/60 dark:text-floodlight/50">
                    {c.count} posts
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="pt-6">
          <h2 className="font-display font-bold uppercase text-lg tracking-wide text-night-pitch dark:text-floodlight mb-3">
            Trending Now
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {trending.map((a, i) => (
              <li key={a.id}>
                <Link
                  to={`/articles/${a.id}`}
                  className="flex gap-3 items-start border border-black/10 dark:border-white/10 bg-white/80 dark:bg-terracing/40 rounded-card p-3
                    transition-all duration-150 hover:border-amber-live/60 hover:-translate-y-0.5">
                  <span className="font-mono font-bold text-2xl text-terracing/60 dark:text-floodlight/50 tabular-nums leading-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <KindLabel>{a.kind}</KindLabel>
                    <span className="mt-1.5 block font-display font-semibold uppercase leading-tight text-night-pitch dark:text-floodlight truncate">
                      {a.title}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <BottomNav active="categories" />
    </Screen>
  );
}