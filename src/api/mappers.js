export const mapArticle = (a) => ({
  id: a.id,
  title: a.title,
  excerpt: a.content?.length > 120 ? a.content.slice(0, 120) + "…" : a.content,
  kind: a.category?.category_name?.toUpperCase().includes("MATCH")
    ? "MATCH REPORT"
    : "FAN REACTION",
  image: a.cover_image || "/placeholder.svg",
  author: a.author ? `${a.author.first_name} ${a.author.last_name}` : "Unknown",
  time: a.created_at ? new Date(a.created_at).toLocaleDateString() : "Recently",
  category: a.category?.category_name || "General",
  upvotes: a.likes_count || 0,
  comments: a.comments?.length || 0,
});

export const mapCategory = (c) => ({
  id: c.id,
  name: c.category_name,
  count: c.articles?.length || 0,
});

export const mapComment = (c) => ({
  id: c.id,
  body: c.content,
  author: c.user?.username || "Unknown",
  time: c.created_at,
});
