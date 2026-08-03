import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Screen, Header, KindLabel, MetaRow, Button } from "../components/UI";
import { IconArrowLeft, IconUpvote, IconBookmark } from "../components/Icons";
import CommentSection from "../components/CommentSection";
import api from "../api/client";
import { mapArticle } from "../api/mappers";
import { addBookmark, removeBookmark } from "../api/bookmarks";
import { reactionsApi } from "../services/api";

export default function ArticleDetail() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [showReactionForm, setShowReactionForm] = useState(false);
  const [reactionBody, setReactionBody] = useState("");
  const [reactionType, setReactionType] = useState("comment");
  const [reactionSubmitting, setReactionSubmitting] = useState(false);
  const [reactionError, setReactionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/articles/${id}`)
      .then((res) => {
        if (!cancelled) {
          setArticle(mapArticle(res.data));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch article:", err);
          setError(err.response?.data?.message || "Failed to load article.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Safely resolve the ID regardless of whether the mapper/backend uses id or article_id
  const resolvedArticleId = article?.id || article?.article_id || id;

  useEffect(() => {
    if (!resolvedArticleId || isNaN(resolvedArticleId)) return;
    let cancelled = false;
    reactionsApi
      .getByArticle(resolvedArticleId)
      .then((res) => {
        if (!cancelled) {
          setReactions(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch reactions:", err);
          setReactions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedArticleId]);

  // Upvote button handler using the robust resolved identifier
  const handleUpvote = () => {
    api
      .post(`/articles/${resolvedArticleId}/upvote`)
      .then((res) => {
        setArticle(mapArticle(res.data));
      })
      .catch((err) => {
        console.error("Failed to upvote article:", err);
      });
  };

  const handleBookmarkToggle = async () => {
    setBookmarkLoading(true);
    const success = isBookmarked
      ? await removeBookmark(resolvedArticleId)
      : await addBookmark(resolvedArticleId);

    if (success) {
      setIsBookmarked((prev) => !prev);
    }
    setBookmarkLoading(false);
  };

  const handleReactionUpvote = (reactionId) => {
    reactionsApi
      .upvote(reactionId)
      .then((res) => {
        setReactions((prev) =>
          prev.map((r) => (r.id === reactionId ? res.data : r))
        );
      })
      .catch((err) => {
        console.error("Failed to upvote reaction:", err);
      });
  };

  const handleReactionSubmit = async (e) => {
    e.preventDefault();
    if (!reactionBody.trim()) return;

    setReactionSubmitting(true);
    setReactionError("");

    try {
      const res = await reactionsApi.create({
        article_id: Number(resolvedArticleId),
        body: reactionBody.trim(),
        reaction_type: reactionType,
      });
      setReactions((prev) => [res.data, ...prev]);
      setReactionBody("");
      setReactionType("comment");
      setShowReactionForm(false);
    } catch (err) {
      console.error("Failed to submit reaction:", err);
      setReactionError(
        err.response?.data?.message || "Failed to post reaction."
      );
    } finally {
      setReactionSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Header
          title="Report"
          left={
            <Link
              to="/"
              className="text-night-pitch dark:text-floodlight block"
              aria-label="Back">
              <IconArrowLeft className="w-6 h-6" />
            </Link>
          }
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <div className="py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10 rounded-card">
            Loading article...
          </div>
        </div>
      </Screen>
    );
  }

  if (error || !article) {
    return (
      <Screen>
        <Header
          title="Report"
          left={
            <Link
              to="/"
              className="text-night-pitch dark:text-floodlight block"
              aria-label="Back">
              <IconArrowLeft className="w-6 h-6" />
            </Link>
          }
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <div className="py-12 text-center font-mono text-sm text-red-600 dark:text-red-400 border border-black/10 dark:border-white/10 rounded-card">
            {error || "Article not found."}
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Report"
        left={
          <Link
            to="/"
            className="text-night-pitch dark:text-floodlight block"
            aria-label="Back">
            <IconArrowLeft className="w-6 h-6" />
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
          <article className="lg:col-span-2">
            <div className="w-full h-64 overflow-hidden bg-terracing/20 dark:bg-terracing/40">
              <img
                src={article.image || "/placeholder.svg"}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="pt-4">
              <KindLabel>{article.kind}</KindLabel>
              <h1 className="mt-3 font-display font-bold uppercase leading-none text-4xl text-night-pitch dark:text-floodlight text-balance">
                {article.title}
              </h1>
              <p className="mt-3 font-mono text-xs text-terracing/60 dark:text-floodlight/50">
                By {article.author} · {article.time} ago
              </p>
            </div>

            <div className="pt-5 space-y-4 text-[15px] leading-relaxed text-night-pitch dark:text-floodlight">
              <p>{article.excerpt}</p>
            </div>

            {/* MetaRow updated to support click actions for upvoting and bookmarking */}
            <div className="pt-5 flex items-center justify-between">
              <MetaRow upvotes={article.upvotes} comments={article.comments} />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpvote}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-black/10 dark:border-white/10 rounded font-mono text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <IconUpvote className="w-4 h-4" />
                  <span>Upvote Article</span>
                </button>
                <button
                  onClick={handleBookmarkToggle}
                  disabled={bookmarkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-black/10 dark:border-white/10 rounded font-mono text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
                  <IconBookmark className="w-4 h-4" />
                  <span>{isBookmarked ? "Bookmarked" : "Bookmark"}</span>
                </button>
              </div>
            </div>

            {/* Reactions section */}
            <section className="mt-8 border-t border-black/10 dark:border-white/10 pt-5">
              <h2 className="font-display font-bold uppercase text-lg tracking-wide text-night-pitch dark:text-floodlight">
                Fan Reactions
              </h2>
              {reactions.length === 0 ? (
                <p className="mt-3 text-sm font-mono text-terracing/60 dark:text-floodlight/50">
                  No reactions yet. Be the first to react.
                </p>
              ) : (
                <ul className="mt-3">
                  {reactions.map((r) => (
                    <li
                      key={r.id}
                      className="py-4 border-b border-black/10 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <img
                          src="/images/avatar.png"
                          alt=""
                          className="w-7 h-7 rounded-full object-cover bg-terracing/30"
                        />
                        <span className="font-display font-semibold uppercase text-sm tracking-wide text-night-pitch dark:text-floodlight min-w-0 truncate">
                          {r.user?.username || "Unknown"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-night-pitch dark:text-floodlight/80">
                        {r.body}
                      </p>
                      <button
                        onClick={() => handleReactionUpvote(r.id)}
                        className="mt-2 flex items-center gap-1.5 text-terracing/60 dark:text-floodlight/50 hover:text-terracing dark:hover:text-floodlight transition-colors duration-100 active:translate-y-[2px]">
                        <IconUpvote className="w-4 h-4" />
                        <span className="font-mono text-xs">{r.upvotes}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pt-4">
                {!showReactionForm ? (
                  <Button variant="outline" onClick={() => setShowReactionForm(true)}>
                    Add your reaction
                  </Button>
                ) : (
                  <form onSubmit={handleReactionSubmit} className="space-y-3">
                    <select
                      value={reactionType}
                      onChange={(e) => setReactionType(e.target.value)}
                      className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-card p-2.5 text-sm text-night-pitch dark:text-floodlight focus:outline-none focus:border-black/50 dark:focus:border-white/50">
                      <option value="comment">Comment</option>
                      <option value="prediction">Prediction</option>
                      <option value="analysis">Analysis</option>
                      <option value="hot take">Hot Take</option>
                    </select>

                    <textarea
                      placeholder="Share your take..."
                      value={reactionBody}
                      onChange={(e) => setReactionBody(e.target.value)}
                      rows={3}
                      required
                      className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-card p-2.5 text-sm text-night-pitch dark:text-floodlight placeholder:text-terracing/40 dark:placeholder:text-floodlight/40 focus:outline-none focus:border-black/50 dark:focus:border-white/50 resize-none"
                    />

                    {reactionError && (
                      <p className="text-sm font-mono text-red-600 dark:text-red-400">
                        {reactionError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button type="submit" disabled={reactionSubmitting}>
                        {reactionSubmitting ? "Posting..." : "Post Reaction"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowReactionForm(false);
                          setReactionError("");
                        }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-4">
            <CommentSection articleId={resolvedArticleId} />
          </aside>
        </div>
      </div>
    </Screen>
  );
}