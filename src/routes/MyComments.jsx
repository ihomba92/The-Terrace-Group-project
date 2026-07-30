import { useState, useEffect } from "react";
import { Screen, Header } from "../components/UI";
import BottomNav from "../components/BottomNav";
import { articles as mockArticles, users as mockUsers } from "../data";
import api from "../api/client";
import { mapComment } from "../api/mappers";
import { useAuth } from "../context/AuthContext";

export default function MyComments() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const userId = user?.id || user?.user_id;

  useEffect(() => {
    if (!userId) {
      setComments([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get(`/users/${userId}/comments`)
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res.data) ? res.data.map(mapComment) : [];
          setComments(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch user comments:", err);
          setComments([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const resolveArticle = (articleId) => {
    const found = mockArticles.find((a) => a.id === articleId);
    return found ? found.title : `Article #${articleId}`;
  };

  const resolveUser = (userId) => {
    const found = mockUsers.find((u) => u.id === userId);
    return found ? found : { name: user?.username || "You", avatar: "/images/default-avatar.png" };
  };

  if (loading) {
    return (
      <Screen sidebar nav>
        <Header title="My Comments" />
        <div className="max-w-2xl mx-auto px-4 py-6 pb-0 lg:pb-0">
          <p className="text-sm text-terracing/60 dark:text-floodlight/50 text-center py-12">Loading comments...</p>
        </div>
        <BottomNav active="comments" />
      </Screen>
    );
  }

  return (
    <Screen sidebar nav>
      <Header title="My Comments" />

      <div className="max-w-2xl mx-auto px-4 py-6 pb-0 lg:pb-0">
        {comments.length === 0 ? (
          <p className="text-sm text-terracing/60 dark:text-floodlight/50 text-center py-12">
            You haven't posted a comment yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => {
              const author = resolveUser(c.user_id || userId);
              return (
                <li key={c.id} className="p-4 border border-black/10 dark:border-white/10 rounded-card">
                  <div className="flex items-center gap-2">
                    <img
                      src={author.avatar || "/images/default-avatar.png"}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover bg-terracing/30"
                    />
                    <span className="font-display font-semibold uppercase text-sm tracking-wide text-night-pitch dark:text-floodlight">
                      {author.name || "You"}
                    </span>
                    <span className="font-mono text-[11px] text-terracing/60 dark:text-floodlight/50">
                      {c.time || "5 Minutes Ago"}
                    </span>
                  </div>

                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-terracing/60 dark:text-floodlight/50">
                    on &ldquo;{resolveArticle(c.article_id)}&rdquo;
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-night-pitch dark:text-floodlight/80">
                    {c.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BottomNav active="comments" />
    </Screen>
  );
}
