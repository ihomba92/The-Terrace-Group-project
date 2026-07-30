import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Screen, Header, KindLabel, MetaRow } from "../components/UI";
import BottomNav from "../components/BottomNav";
import { IconBookmark } from "../components/Icons";
import { articles as mockArticles } from "../data";
import api from "../api/client";
import { mapArticle } from "../api/mappers";
import { getBookmarks, removeBookmark } from "../api/bookmarks";

export default function Bookmarks() {
  const [bookmarkedArticles, setBookmarkedArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ids = getBookmarks();

    if (ids.length === 0) {
      setBookmarkedArticles([]);
      setLoading(false);
      return;
    }

    api
      .get("/articles")
      .then((res) => {
        if (!cancelled) {
          const raw = Array.isArray(res.data) ? res.data : (res.data?.articles ?? []);
          const items = Array.isArray(raw) ? raw : [];
          const mapped = items.map(mapArticle);
          const filtered = mapped.filter((a) => ids.includes(a.id));
          setBookmarkedArticles(filtered);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch bookmarked articles:", err);
          const fallback = mockArticles.filter((a) => ids.includes(a.id));
          setBookmarkedArticles(fallback);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = (articleId) => {
    removeBookmark(articleId);
    setBookmarkedArticles((prev) => prev.filter((a) => a.id !== articleId));
  };

  if (loading) {
    return (
      <Screen sidebar nav>
        <Header title="Bookmarks" />
        <div className="max-w-2xl mx-auto px-4 py-16 pb-0 lg:pb-0 flex flex-col items-center text-center">
          <IconBookmark className="w-10 h-10 text-floodlight/50 dark:text-floodlight/40" />
          <p className="mt-4 text-sm text-terracing/60 dark:text-floodlight/50">Loading bookmarks...</p>
        </div>
        <BottomNav active="bookmarks" />
      </Screen>
    );
  }

  if (bookmarkedArticles.length === 0) {
    return (
      <Screen sidebar nav>
        <Header title="Bookmarks" />
        <div className="max-w-2xl mx-auto px-4 py-16 pb-0 lg:pb-0 flex flex-col items-center text-center">
          <IconBookmark className="w-10 h-10 text-floodlight/50 dark:text-floodlight/40" />
          <p className="mt-4 text-sm text-terracing/60 dark:text-floodlight/50">
            No saved articles yet. Bookmark an article to see it here.
          </p>
        </div>
        <BottomNav active="bookmarks" />
      </Screen>
    );
  }

  return (
    <Screen sidebar nav>
      <Header title="Bookmarks" />
      <div className="max-w-2xl mx-auto px-4 py-6 pb-0 lg:pb-0">
        <ul className="space-y-4">
          {bookmarkedArticles.map((a) => (
            <li key={a.id} className="p-4 border border-black/10 dark:border-white/10 rounded-card">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/articles/${a.id}`}
                  className="flex-1 min-w-0">
                  <KindLabel>{a.kind}</KindLabel>
                  <p className="mt-2 font-display font-semibold uppercase leading-tight text-night-pitch dark:text-floodlight">
                    {a.title}
                  </p>
                  <div className="mt-2">
                    <MetaRow upvotes={a.upvotes} comments={a.comments} />
                  </div>
                </Link>
                <button
                  onClick={() => handleRemove(a.id)}
                  className="p-2 border border-black/10 dark:border-white/10 rounded-card text-terracing/60 dark:text-floodlight/50 hover:text-black dark:hover:text-white transition-colors duration-100 active:translate-y-[2px] shrink-0"
                  aria-label="Remove bookmark"
                >
                  <IconBookmark className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <BottomNav active="bookmarks" />
    </Screen>
  );
}
