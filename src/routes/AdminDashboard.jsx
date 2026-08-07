import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Screen, Header, KindLabel } from "../components/UI";
import { IconArrowLeft, IconCheck } from "../components/Icons";
import api from "../api/client";
import { mapArticle } from "../api/mappers";
import { useAuth } from "../context/AuthContext";

// Adjust here if mapArticle uses different field names for these.
const STATUS_FIELD = "status";
const AUTHOR_FIELD = "author";

// Matches AdminArticlePublishResource: PATCH /admin/articles/<article_id>/publish
async function publishArticle(id) {
  return api.patch(`/admin/articles/${id}/publish`);
}

// Matches AdminArticleRejectResource: PATCH /admin/articles/<article_id>/reject
async function rejectArticle(id, reason) {
  return api.patch(`/admin/articles/${id}/reject`, { reason });
}

export default function Admin() {
  const { user } = useAuth();
  const userRole = user?.profile?.role || user?.role;
  const isAdmin = userRole === "admin";

  const [allArticles, setAllArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  // Tracks per-row in-flight action so only that row's buttons disable,
  // and lets us show which action is running (approve vs reject).
  const [pendingAction, setPendingAction] = useState({}); // { [articleId]: "approve" | "reject" }
  const [actionError, setActionError] = useState(null);

  // Which row currently has the reject-reason input open, and its draft text
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    // status=all is admin-only — ArticlesResource enforces that server-side
    // via the JWT role claim, this isn't a client-side-only restriction.
    // per_page bumped up so the moderation queue isn't silently truncated
    // by the endpoint's default page size of 10.
    api
      .get("/articles?status=all&per_page=100")
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res.data?.articles) ? res.data.articles : [];
          setAllArticles(items.map(mapArticle));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch articles:", err);
          setAllArticles([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Everything below is derived from allArticles, so approving/rejecting
  // one article automatically keeps the queue and the metrics in sync.
  const queue = useMemo(
    () => allArticles.filter((a) => a[STATUS_FIELD] === "PENDING"),
    [allArticles]
  );

  const metricsDisplay = useMemo(() => {
    const published = allArticles.filter((a) => a[STATUS_FIELD] === "PUBLISHED").length;
    const rejected = allArticles.filter((a) => a[STATUS_FIELD] === "REJECTED").length;
    const authorCount = new Set(
      allArticles.map((a) => a[AUTHOR_FIELD]).filter(Boolean)
    ).size;

    return [
      ["Pending", queue.length],
      ["Published", published],
      ["Rejected", rejected],
      ["Authors", authorCount],
    ];
  }, [allArticles, queue.length]);

  const startReject = (articleId) => {
    setActionError(null);
    setRejectingId(articleId);
    setRejectReason("");
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectReason("");
  };

  const handleApprove = async (article) => {
    setActionError(null);
    setPendingAction((p) => ({ ...p, [article.id]: "approve" }));

    try {
      await publishArticle(article.id);
      setAllArticles((all) =>
        all.map((a) =>
          a.id === article.id ? { ...a, [STATUS_FIELD]: "PUBLISHED" } : a
        )
      );
    } catch (err) {
      console.error("Failed to approve article:", err);
      setActionError(`Couldn't approve "${article.title}" — try again.`);
    } finally {
      setPendingAction((p) => {
        const next = { ...p };
        delete next[article.id];
        return next;
      });
    }
  };

  const confirmReject = async (article) => {
    setActionError(null);
    setPendingAction((p) => ({ ...p, [article.id]: "reject" }));

    try {
      await rejectArticle(article.id, rejectReason.trim() || null);
      setAllArticles((all) =>
        all.map((a) =>
          a.id === article.id
            ? { ...a, [STATUS_FIELD]: "REJECTED", rejectionReason: rejectReason.trim() || null }
            : a
        )
      );
      setRejectingId(null);
      setRejectReason("");
    } catch (err) {
      console.error("Failed to reject article:", err);
      setActionError(`Couldn't reject "${article.title}" — try again.`);
    } finally {
      setPendingAction((p) => {
        const next = { ...p };
        delete next[article.id];
        return next;
      });
    }
  };

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
          {metricsDisplay.map(([label, value], i) => (
            <div
              key={label}
              className={
                "p-4 " +
                (i % 2 === 0 ? "border-r border-black/10 dark:border-white/10 " : "") +
                (i < 2 ? "border-b border-black/10 dark:border-white/10" : "")
              }
            >
              <div
                className={
                  "font-mono font-bold text-3xl tabular-nums leading-none " +
                  (label === "Rejected" && value > 0
                    ? "text-red-500"
                    : "text-night-pitch dark:text-floodlight")
                }
              >
                {loading ? "–" : value}
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

        {actionError && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-card border border-red-500/30 bg-red-500/5 font-mono text-xs text-red-500">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10">
            Loading queue...
          </div>
        ) : (
          <ul className="border-t border-black/10 dark:border-white/10">
            {queue.map((a) => {
              const busyWith = pendingAction[a.id];
              const isBusy = Boolean(busyWith);
              const isRejecting = rejectingId === a.id;

              return (
                <li
                  key={a.id}
                  className={
                    "px-4 py-4 border-b border-black/10 dark:border-white/10 transition-opacity duration-150 " +
                    (isBusy ? "opacity-50" : "")
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <KindLabel>{a.kind}</KindLabel>
                      <p className="mt-2 font-display font-semibold uppercase leading-tight text-night-pitch dark:text-floodlight truncate">
                        {a.title}
                      </p>
                      <p className="font-mono text-[11px] text-terracing/60 dark:text-floodlight/50 mt-1">
                        {a.author} · {a.time}
                      </p>
                    </div>

                    {!isRejecting && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          aria-label="Approve"
                          disabled={isBusy}
                          onClick={() => handleApprove(a)}
                          className="p-2 border border-black/10 dark:border-white/10 rounded-card text-night-pitch dark:text-floodlight
                          hover:bg-night-pitch hover:text-floodlight dark:hover:bg-floodlight dark:hover:text-night-pitch
                          transition-colors duration-100 active:translate-y-[2px]
                          disabled:pointer-events-none disabled:opacity-60"
                        >
                          {busyWith === "approve" ? (
                            <span className="block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          ) : (
                            <IconCheck className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => startReject(a.id)}
                          className="px-2 py-1 border border-red-500/20 rounded-card font-mono text-[10px] uppercase tracking-[0.08em] text-red-500/70
                          hover:bg-red-500 hover:text-white
                          transition-colors duration-100 active:translate-y-[2px]
                          disabled:pointer-events-none disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline reason capture — replaces the buttons for this row only */}
                  {isRejecting && (
                    <div className="mt-3 pl-0">
                      <label
                        htmlFor={`reject-reason-${a.id}`}
                        className="block font-mono text-[10px] uppercase tracking-[0.08em] text-terracing/60 dark:text-floodlight/50 mb-1.5"
                      >
                        Reason (sent to author, optional but recommended)
                      </label>
                      <textarea
                        id={`reject-reason-${a.id}`}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="e.g. Needs a source for the transfer fee claim in paragraph 2"
                        className="w-full px-3 py-2 rounded-card border border-black/10 dark:border-white/10 bg-white/80 dark:bg-terracing/40
                        text-sm text-night-pitch dark:text-floodlight placeholder:text-terracing/40 dark:placeholder:text-floodlight/30
                        focus:outline-none focus:border-red-500/40"
                        disabled={isBusy}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          disabled={isBusy}
                          onClick={() => confirmReject(a)}
                          className="px-3 py-1.5 rounded-card bg-red-500 text-white font-mono text-[10px] uppercase tracking-[0.08em]
                          hover:bg-red-600 transition-colors duration-100 active:translate-y-[2px]
                          disabled:pointer-events-none disabled:opacity-60"
                        >
                          {busyWith === "reject" ? "Rejecting..." : "Confirm reject"}
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={cancelReject}
                          className="px-3 py-1.5 rounded-card border border-black/10 dark:border-white/10 font-mono text-[10px] uppercase tracking-[0.08em]
                          text-terracing/70 dark:text-floodlight/60 hover:text-night-pitch dark:hover:text-floodlight
                          transition-colors duration-100 active:translate-y-[2px]
                          disabled:pointer-events-none disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
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