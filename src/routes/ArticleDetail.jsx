import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Screen, Header, KindLabel, MetaRow, Button } from "../components/UI";
import { IconArrowLeft, IconUpvote, IconBookmark } from "../components/Icons";
import CommentSection from "../components/CommentSection";
import api from "../api/client";
import { mapArticle } from "../api/mappers";
import { addBookmark, removeBookmark } from "../api/bookmarks";
import { reactionsApi } from "../services/api";

// Flattens { errors: { field: [msg, ...] } } or { message: "..." } into one
// readable string, so a 400's actual field-level reason is visible instead
// of just the generic "Validation error(s) occurred".
function extractErrorMessage(err, fallback) {
  const fieldErrors = err.response?.data?.errors;
  if (fieldErrors) {
    return Object.values(fieldErrors).flat().join(" ");
  }
  return err.response?.data?.message || fallback;
}

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
  // Guards the reaction/upvote/bookmark actions below against a resolved ID
  // that can't actually be sent to the API as a number.
  const numericArticleId = Number(resolvedArticleId);
  const hasValidArticleId = resolvedArticleId != null && !Number.isNaN(numericArticleId);

  useEffect(() => {
    if (!resolvedArticleId || isNaN(resolvedArticleId)) return;