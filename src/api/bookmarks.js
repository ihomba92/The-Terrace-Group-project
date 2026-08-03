import api from "./client";

export async function getBookmarks(userId) {
  if (!userId) return [];
  try {
    const res = await api.get(`/users/${userId}/bookmarks`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("Failed to fetch bookmarks:", err);
    return [];
  }
}

export async function addBookmark(articleId) {
  try {
    await api.post(`/articles/${articleId}/bookmark`);
    return true;
  } catch (err) {
    console.error("Failed to add bookmark:", err);
    return false;
  }
}

export async function removeBookmark(articleId) {
  try {
    await api.delete(`/articles/${articleId}/bookmark`);
    return true;
  } catch (err) {
    console.error("Failed to remove bookmark:", err);
    return false;
  }
}