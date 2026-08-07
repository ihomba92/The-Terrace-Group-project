import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Screen, Header, Field, Button } from "../components/UI";
import { IconArrowLeft } from "../components/Icons";
import api from "../api/client";
import { mapCategory } from "../api/mappers";

const kinds = ["Match Report", "Fan Reaction"];

export default function PostArticle() {
  const { id: articleId } = useParams(); // present only on /edit-article/:id
  const isEditMode = Boolean(articleId);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Tracked separately from the form so we know whether to send status
  // back to PENDING on resubmit — only relevant if it was REJECTED.
  const [originalStatus, setOriginalStatus] = useState(null);

  const [form, setForm] = useState({
    title: "",
    kind: kinds[0],
    category_id: "",
    body: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/categories")
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res.data)
            ? res.data.map(mapCategory)
            : [];
          setCategories(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch categories:", err);
          setCategories([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Edit mode: load the existing article and prefill the form
  useEffect(() => {
    if (!isEditMode) return;

    let cancelled = false;
    api
      .get(`/articles/${articleId}`)
      .then((res) => {
        if (cancelled) return;
        const a = res.data || {};
        setForm({
          title: a.title || "",
          kind: kinds[0], // backend has no "kind" field to prefill from — see note below
          category_id: a.category_id ? String(a.category_id) : "",
          body: a.content || "",
        });
        setOriginalStatus(a.status || null);
        setLoadingArticle(false);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch article for editing:", err);
          setError("Couldn't load this article for editing.");
          setLoadingArticle(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, articleId]);

  const update = (key, value) => setForm({ ...form, [key]: value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      setSubmitting(true);

      if (isEditMode) {
        const payload = {
          title: form.title,
          content: form.body,
          category_id: form.category_id ? Number(form.category_id) : undefined,
        };
        // Only resubmitting a previously-rejected article moves it back
        // into the moderation queue — editing a published article as an
        // owner/admin shouldn't unpublish it.
        if (originalStatus === "REJECTED") {
          payload.status = "PENDING";
        }
        await api.patch(`/articles/${articleId}`, payload);
        navigate(`/articles/${articleId}`);
      } else {
        const payload = {
          title: form.title,
          content: form.body,
          category_id: form.category_id ? Number(form.category_id) : undefined,
          cover_image: "",
        };
        const res = await api.post("/articles", payload);
        navigate(`/articles/${res.data.id}`);
      }
    } catch (err) {
      console.error(`Failed to ${isEditMode ? "update" : "create"} article:`, err);
      setError(
        err.response?.data?.message ||
          `Failed to ${isEditMode ? "update" : "publish"} article.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isEditMode && loadingArticle) {
    return (
      <Screen>
        <Header
          title="Edit Post"
          left={
            <Link
              to="/my-articles"
              className="text-night-pitch dark:text-floodlight block"
              aria-label="Back">
              <IconArrowLeft className="w-6 h-6" />
            </Link>
          }
        />
        <div className="px-4 py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50">
          Loading article...
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={isEditMode ? "Edit Post" : "New Post"}
        left={
          <Link
            to={isEditMode ? "/my-articles" : "/user-profile"}
            className="text-night-pitch dark:text-floodlight block"
            aria-label="Back">
            <IconArrowLeft className="w-6 h-6" />
          </Link>
        }
      />

      {isEditMode && originalStatus === "REJECTED" && (
        <div className="mx-4 mt-4 px-3 py-2 rounded-card border border-amber-live/30 bg-amber-live/5 font-mono text-xs text-night-pitch dark:text-floodlight">
          Resubmitting will send this back to the moderation queue for review.
        </div>
      )}

      <form className="px-4 py-5 flex flex-col gap-5" onSubmit={handleSubmit}>
        <div>
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-terracing/70 dark:text-floodlight/50 mb-2">
            Post Type
          </span>
          <div className="flex gap-3">
            {kinds.map((k, _i) => (
              <button
                key={k}
                type="button"
                onClick={() => update("kind", k)}
                className={
                  "flex-1 font-display font-semibold uppercase tracking-wide text-sm px-3 py-2.5 rounded-card border transition-colors duration-100 active:translate-y-[2px] " +
                  (form.kind === k
                    ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                    : "bg-transparent text-terracing/70 dark:text-floodlight/50 hover:text-black dark:hover:text-white border-black/10 dark:border-white/10")
                }>
                {k}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-terracing/70 dark:text-floodlight/50 mb-1.5">
            Category
          </span>
          <select
            value={form.category_id}
            onChange={(e) => update("category_id", e.target.value)}
            required
            className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-card px-3 py-2.5 text-sm text-night-pitch dark:text-floodlight focus:outline-none focus:border-black/50 dark:focus:border-white/50">
            <option
              value=""
              disabled
              className="bg-floodlight dark:bg-night-pitch">
              {loading ? "Loading categories..." : "Select a category"}
            </option>
            {categories.map((c) => (
              <option
                key={c.id}
                value={c.id}
                className="bg-floodlight dark:bg-night-pitch">
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <Field
          label="Headline"
          placeholder="CITY STUNNED IN LATE DRAMA"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
        />

        {/* cover upload — dashed frame, no shadow */}
        <div>
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-terracing/70 dark:text-floodlight/50 mb-2">
            Cover Image
          </span>
          <div className="border border-dashed border-black/10 dark:border-white/10 rounded-card h-32 flex items-center justify-center text-center px-4">
            <span className="font-mono text-xs text-terracing/60 dark:text-floodlight/50">
              Tap to upload — photography for reports, illustration for takes
            </span>
          </div>
        </div>

        <label className="block">
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-terracing/70 dark:text-floodlight/50 mb-1.5">
            Body
          </span>
          <textarea
            rows={7}
            placeholder="Set the scene from the terrace…"
            value={form.body}
            onChange={(e) => update("body", e.target.value)}
            required
            className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-card px-3 py-2.5 text-sm text-night-pitch dark:text-floodlight
            placeholder:text-terracing/40 dark:placeholder:text-floodlight/40 focus:outline-none focus:border-black/50 dark:focus:border-white/50 resize-none"
          />
        </label>

        {error && (
          <p className="text-sm font-mono text-center text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="outline" type="button" disabled={submitting}>
            Save Draft
          </Button>
          <Button
            type="submit"
            disabled={submitting || !form.title || !form.body || !form.category_id}>
            {isEditMode ? "Resubmit" : "Publish"}
          </Button>
        </div>
      </form>
    </Screen>
  );
}