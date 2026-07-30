import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Screen, Header, KindLabel } from "../components/UI";
import { IconArrowLeft, IconCheck } from "../components/Icons";
import api from "../api/client";
import { mapArticle } from "../api/mappers";
import { useAuth } from "../context/AuthContext";

const metrics = [
  ["Pending", 7],
  ["Published", 128],
  ["Flagged", 3],
  ["Authors", 24],
];

export default function Admin() {
  const { user } = useAuth();
  const userRole = user?.profile?.role || user?.role;
  const isAdmin = userRole === "admin";

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get("/articles")
      .then((res) => {
        if (!cancelled) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.articles ?? []);
          const items = Array.isArray(raw) ? raw : [];
          setQueue(items.map(mapArticle));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch articles:", err);
          setQueue([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Screen>
        <Header
          title="Admin"
          left={
            <Link
              to="/"
              className="text-night-pitch dark:text-floodlight block"
              aria-label="Back"
            >
              <IconArrowLeft className="w-6 h-6" />
            </Link>
          }
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <div className="py-12 text-center font-mono text-sm text-red-600 dark:text-red-400 border border-black/10 dark:border-white/10 rounded-card">
            You do not have permission to access this page.
          </div>
        </main>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Admin"
        left={
          <Link
            to="/"
            className="text-night-pitch dark:text-floodlight block"
            aria-label="Back"
          >
            <IconArrowLeft className="w-6 h-6" />
          </Link>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* metrics grid */}
        <div className="mx-4 mt-5 grid grid-cols-2 border border-black/10 dark:border-white/10">
          {metrics.map(([label, value], i) => (
            <div
              key={label}
              className={
                "p-4 " +
                (i % 2 === 0 ? "border-r border-black/10 dark:border-white/10 " : "") +
                (i < 2 ? "border-b border-black/10 dark:border-white/10" : "")
              }
            >
              <div className="font-mono font-bold text-3xl text-night-pitch dark:text-floodlight tabular-nums leading-none">
                {value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-terracing/60 dark:text-floodlight/50 mt-1.5">
                {label}
              </div>
            </div>
          ))}
        </div>

        <h2 className="px-4 mt-7 mb-2 font-display font-bold uppercase text-lg tracking-wide text-night-pitch dark:text-floodlight">
          Moderation Queue
        </h2>

        {loading ? (
          <div className="py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10">
            Loading queue...
          </div>
        ) : (
          <ul className="border-t border-black/10 dark:border-white/10">
            {queue.map((a) => (
              <li
                key={a.id}
                className="px-4 py-4 border-b border-black/10 dark:border-white/10 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <KindLabel>{a.kind}</KindLabel>
                  <p className="mt-2 font-display font-semibold uppercase leading-tight text-night-pitch dark:text-floodlight truncate">
                    {a.title}
                  </p>
                  <p className="font-mono text-[11px] text-terracing/60 dark:text-floodlight/50 mt-1">
                    {a.author} · {a.time}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    aria-label="Approve"
                    className="p-2 border border-black/10 dark:border-white/10 rounded-card text-night-pitch dark:text-floodlight
                    hover:bg-night-pitch hover:text-floodlight dark:hover:bg-floodlight dark:hover:text-night-pitch
                    transition-colors duration-100 active:translate-y-[2px]"
                  >
                    <IconCheck className="w-4 h-4" />
                  </button>
                  <button
                    className="px-2 py-1 border border-black/10 dark:border-white/10 rounded-card font-mono text-[10px] uppercase tracking-[0.08em] text-terracing/60 dark:text-floodlight/50
                    hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
                    transition-colors duration-100 active:translate-y-[2px]"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
            {!loading && queue.length === 0 && (
              <li className="px-4 py-8 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50">
                Queue is empty.
              </li>
            )}
          </ul>
        )}
      </main>
    </Screen>
  );
}
