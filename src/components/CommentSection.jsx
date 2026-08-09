import { useState, useEffect } from "react";
import { users } from "../data";
import api from "../api/client";
import { mapComment } from "../api/mappers";
import { useAuth } from "../context/AuthContext";

export default function CommentSection({ articleId, initialUpvotes = 0, onUpvoteUpdate }) {
  const [commentsList, setCommentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState("");
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  function resolveUser(userId) {
    return (
      users.find(function (u) {
        return u.id === userId;
      }) || {}
    );
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/articles/${articleId}/comments`)
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res.data) ? res.data.map(mapComment) : [];
          setCommentsList(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch comments:", err);
          setCommentsList([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  // Handle Upvote API Integration
  function handleUpvote() {
    api
      .post(`/articles/${articleId}/upvote`)
      .then((res) => {
        const updatedLikes = res.data.likes_count ?? upvotes + 1;
        setUpvotes(updatedLikes);
        if (onUpvoteUpdate) onUpvoteUpdate(updatedLikes);
      })
      .catch((err) => {
        console.error("Failed to upvote article:", err);
      });
  }

  function onAddComment(event) {
    event.preventDefault();

    if (newCommentText.trim() === "" || submitting) {
      return;
    }

    setSubmitting(true);
    const tempId = Date.now();
    const optimisticComment = {
      id: tempId,
      article_id: articleId,
      user_id: user?.id || user?.user_id,
      body: newCommentText,
      created_at: new Date().toISOString(),
    };

    setCommentsList((prev) => [...prev, optimisticComment]);
    const commentText = newCommentText;
    setNewCommentText("");

    api
      .post(`/articles/${articleId}/comments`, {
        content: commentText,
        body: commentText,
      })
      .then((res) => {
        setCommentsList((prev) =>
          prev.map((c) =>
            c.id === tempId ? { ...mapComment(res.data), id: res.data.id } : c
          )
        );
      })
      .catch((err) => {
        console.error("Failed to post comment:", err);
        setCommentsList((prev) => prev.filter((c) => c.id !== tempId));
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  return (
    <div className="relative">
      <div className="max-h-96 overflow-y-auto p-5 space-y-4">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.12em] text-terracing/70 dark:text-floodlight/50">
          Community Stances
        </h4>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start p-3 rounded-card border border-black/10 dark:border-white/10">
                <div className="w-8 h-8 rounded-full bg-terracing/20 dark:bg-terracing/40 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex justify-between">
                    <div className="w-24 h-4 bg-terracing/20 dark:bg-terracing/40 rounded" />
                    <div className="w-16 h-3 bg-terracing/20 dark:bg-terracing/40 rounded" />
                  </div>
                  <div className="w-full h-3 bg-terracing/20 dark:bg-terracing/40 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {commentsList.map(function (comment) {
              const author = resolveUser(comment.user_id);
              return (
                <div
                  key={comment.id}
                  className="flex gap-3 items-start bg-white/80 dark:bg-terracing/40 p-3 rounded-card border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-100">
                  <img
                    src={author?.avatar || users?.[0]?.avatar || "/images/default-avatar.png"}
                    alt={author?.name || "Anonymous"}
                    className="w-8 h-8 rounded-full bg-terracing/10 dark:bg-floodlight/10 border border-black/10 dark:border-white/10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold uppercase text-sm tracking-wide text-night-pitch dark:text-floodlight">
                          {author?.name || "Anonymous"}
                        </span>
                        <span className="font-mono text-[11px] text-terracing/60 dark:text-floodlight/50">
                          {comment.time || "5 Minutes Ago"}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-terracing/70 dark:text-floodlight/50 border border-black/10 dark:border-white/10 px-1.5 py-0.5 rounded-card">
                        {comment.reaction_type || "comment"}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-night-pitch dark:text-floodlight/80 mt-1">
                      {comment.details || comment.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upvote / Downvote Actions */}
        <div className="flex gap-4 items-center pt-2 text-xs text-terracing/60 dark:text-floodlight/50">
          <button
            onClick={handleUpvote}
            className="flex items-center gap-1 text-terracing/60 dark:text-floodlight/50 hover:text-black dark:hover:text-white transition-colors duration-100">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
            Upvote <span className="font-mono">{upvotes}</span>
          </button>
          <button
            onClick={function () {
              setDownvotes(downvotes + 1);
            }}
            className="flex items-center gap-1 text-terracing/60 dark:text-floodlight/50 hover:text-black dark:hover:text-white transition-colors duration-100">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            Downvote <span className="font-mono">{downvotes}</span>
          </button>
        </div>
      </div>

      {/* New Comment Input Form */}
      <form
        onSubmit={onAddComment}
        className="sticky bottom-0 bg-floodlight/95 dark:bg-night-pitch/95 border-t border-black/10 dark:border-white/10 p-3 flex gap-2 items-center">
        <img
          src={users?.[0]?.avatar || "/images/default-avatar.png"}
          alt="You"
          className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 flex-shrink-0"
        />
        <input
          type="text"
          placeholder="Type Something..."
          value={newCommentText}
          onChange={function (e) {
            setNewCommentText(e.target.value);
          }}
          className="flex-1 px-4 py-2.5 text-sm text-night-pitch dark:text-floodlight bg-transparent border border-black/10 dark:border-white/10 rounded-card focus:outline-none focus:border-black/50 dark:focus:border-white/50 transition-colors duration-100 placeholder:text-terracing/40 dark:placeholder:text-floodlight/40"
        />
        <button
          type="submit"
          disabled={!newCommentText.trim() || submitting}
          className={`w-10 h-10 rounded-card flex items-center justify-center transition-colors duration-100 flex-shrink-0 ${
            newCommentText.trim() && !submitting
              ? "bg-night-pitch text-floodlight border border-night-pitch hover:bg-floodlight hover:text-night-pitch dark:bg-floodlight dark:text-night-pitch dark:border-floodlight dark:hover:bg-night-pitch dark:hover:text-floodlight"
              : "bg-transparent text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10 cursor-not-allowed"
          }`}>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}