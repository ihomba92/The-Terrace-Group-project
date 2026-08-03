export const mapArticle = (a) => ({
  id: a.article_id ?? a.id,
  isExternal: !a.article_id && !a.id,
  url: a.url || "#",
  title: a.title,
  excerpt: a.excerpt || a.description,
  kind: a.kind || (a.article_id ? "ARTICLE" : "FAN REACTION"),
  upvotes: a.likes_count ?? a.upvotes ?? 0,
  comments: a.comments?.length ?? a.comments ?? 0,
  image: a.cover_image || a.image || "/placeholder.svg",
  author: a.author || "External Source",
  time: a.time || "Recently",
});

export const mapCategory = (c) => ({
  id: c.category_id || c.id,
  name: c.category_name,
  count: c.articles?.length || 0,
});

export const mapComment = (c) => ({
  id: c.comment_id ?? c.reaction_id ?? c.id,
  body: c.content ?? c.body,
  author: {
    id: c.user?.id,
    username: c.user?.username || "Unknown",
  },
  articleId: c.article?.id ?? c.article_id,
  articleTitle: c.article?.title,
  time: c.created_at,
  reaction_type: c.reaction_type || "comment",
});