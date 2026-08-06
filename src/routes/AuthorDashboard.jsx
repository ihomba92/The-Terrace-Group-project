import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Screen, Header, KindLabel } from "../components/UI";
import BottomNav from "../components/BottomNav";
import { Skeleton } from "../components/Skeleton";
import { IconEdit } from "../components/Icons";
import api from "../api/client";
import { mapArticle } from "../api/mappers";
import { useAuth } from "../context/AuthContext";

const STATUS_META = {
  PENDING: { label: "In review", className: "text-amber-live" },
  PUBLISHED: { label: "Published", className: "text-night-pitch dark:text-floodlight" },
  REJECTED: { label: "Needs changes", className: "text-red-500" },
};

export default function AuthorDashboard() {
  const { user } = useAuth();
  const userId = user?.id || user?.user_id;

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setArticles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // UserArticlesResource returns everything by this author regardless
    // of status — no query param needed, unlike the public /articles list.
    api
      .get(`/users/${userId}/articles`)
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res.data?.articles) ? res.data.articles : [];
          setArticles(items.map(mapArticle));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch your articles:", err);
          setArticles([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const needsAttention = useMemo(
    () => articles.filter((a) => a.status === "REJECTED"),
    [articles]
  );
  const rest = useMemo(
    () => articles.filter((a) => a.status !== "REJECTED"),
    [articles]
  );

  return (
    <Screen sidebar nav>
      <Header
        title="Your Articles"
        right={
          <Link
            to="/create-article"
            className="text-night-pitch dark:text-floodlight block"
            aria-label="New article"
          >
            <IconEdit className="w-6 h-6" />
          </Link>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full pb-24 lg:pb-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-black/10 dark:border-white/10 rounded-card p-4">
                <Skeleton className="w-16 h-4 mb-2" />
                <Skeleton className="w-full h-6 mb-2" />
                <Skeleton className="w-2/3 h-4" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Rejected articles surfaced first and separately — these are
                the ones that actually need the author to do something. */}
            {needsAttention.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-display font-bold uppercase text-xl tracking-wide text-red-500">
                    Needs Your Attention
                  </h2>
                  <span className="h-[2px] flex-1 bg-red-500/30" />
                </div>
                <ul className="flex flex-col gap-3">
                  {needsAttention.map((a) => (
                    <li
                      key={a.id}
                      className="border border-red-500/25 bg-red-500/[0.03] rounded-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <KindLabel>{a.kind}</KindLabel>
                          <p className="mt-1.5 font-display font-semibold uppercase leading-tight text-night-pitch dark:text-floodlight truncate">
                            {a.title}
                          </p>
                        </div>
                        <Link
                          to={`/edit-article/${a.id}`}
                          className="shrink-0 px-3 py-1.5 rounded-card bg-red-500 text-white font-mono text-[10px] uppercase tracking-[0.08em]
                          hover:bg-red-600 transition-colors duration-100 active:translate-y-[2px]"
                        >
                          Edit & resubmit
                        </Link>
                      </div>

                      {(a.rejectionReason || a.rejection_reason) && (
                        <p className="mt-3 text-sm leading-relaxed text-night-pitch/80 dark:text-floodlight/70 border-l-2 border-red-500/40 pl-3">
                          {a.rejectionReason || a.rejection_reason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="font-display font-bold uppercase text-lg tracking-wide text-night-pitch dark:text-floodlight mb-3">
                All Articles
              </h2>

              {articles.length === 0 ? (
                <div className="py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10 rounded-card">
                  You haven't written anything yet.
                </div>
              ) : (
                <ul className="border-t border-black/10 dark:border-white/10">
                  {rest.map((a) => {
                    const meta = STATUS_META[a.status] || STATUS_META.PENDING;
                    return (
                      <li
                        key={a.id}
                        className="px-4 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <KindLabel>{a.kind}</KindLabel>
                          <p className="mt-1.5 font-display font-semibold uppercase leading-tight text-night-pitch dark:text-floodlight truncate">
                            {a.title}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav active="my-articles" />
    </Screen>
  );
}