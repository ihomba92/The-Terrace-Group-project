import os
import requests
from flask import request, make_response
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Article, Category
from auth_utils import role_required

try:
    from extensions import log
except ImportError:
    import logging
    log = logging.getLogger(__name__)


DEFAULT_CATEGORY_NAME = "Football News"


def get_or_create_default_category():
    category = Category.query.filter_by(category_name=DEFAULT_CATEGORY_NAME).first()
    if not category:
        category = Category(
            category_name=DEFAULT_CATEGORY_NAME,
            description="Imported articles from external news sources",
        )
        db.session.add(category)
        db.session.commit()
    return category
def import_article_from_newsapi_item(item, category_id):
    """Create an Article from a single NewsAPI result. Returns (article, created_bool) or (None, False) if skipped."""
    external_url = item.get("url")
    if not external_url:
        return None, False

    existing = Article.query.filter_by(external_url=external_url).first()
    if existing:
        return existing, False

    title = (item.get("title") or "Untitled").strip()
    title = title[:97] + "..." if len(title) > 100 else title

    # Also guard against title collisions (e.g. same story reached via
    # different tracking/query-param URLs)
    existing_by_title = Article.query.filter_by(title=title).first()
    if existing_by_title:
        return existing_by_title, False

    content = (item.get("content") or item.get("description") or "").strip()
    if not content:
        content = "Full content available at the original source."
    content = content[:1997] + "..." if len(content) > 2000 else content

    cover_image = (item.get("urlToImage") or "https://placeholder.com")[:500]

    source_name = ((item.get("source") or {}).get("name") or "")[:100]

    article = Article(
        title=title,
        content=content,
        cover_image=cover_image,
        author_id=None,
        category_id=category_id,
        published_at=item.get("publishedAt"),
        external_url=external_url,
        source_name=source_name or None,
    )
    db.session.add(article)
    return article, True


# /articles/import-external
class ImportExternalArticleResource(Resource):
    # POST /articles/import-external - Protected: Import a single external article (lazy import on interaction)
    @jwt_required()
    def post(self):
        data = request.get_json() or {}
        external_url = data.get("url")
        if not external_url:
            return make_response({"status": 400, "message": "url is required"}, 400)

        existing = Article.query.filter_by(external_url=external_url).first()
        if existing:
            return make_response(
                {"article_id": existing.article_id, "already_existed": True}, 200
            )

        category = get_or_create_default_category()

        try:
            article, created = import_article_from_newsapi_item(data, category.category_id)
            db.session.commit()
            return make_response(
                {"article_id": article.article_id, "already_existed": not created},
                201 if created else 200,
            )
        except Exception as e:
            db.session.rollback()
            log.error("import_external_article_error: %s", str(e))
            return make_response({"status": 500, "message": "Failed to import article"}, 500)


# /admin/seed-external-articles
class AdminSeedExternalArticlesResource(Resource):
    # POST /admin/seed-external-articles - Admin Only: Bulk-import articles from NewsAPI
    @role_required(["admin"])
    def post(self):
        api_key = os.getenv("NEWS_API_KEY")
        if not api_key:
            return make_response(
                {"status": 500, "message": "NEWS_API_KEY is not configured"}, 500
            )

        data = request.get_json() or {}
        query = data.get("q", "football")
        count = min(data.get("count", 30), 100)  # NewsAPI free tier caps pageSize at 100

        try:
            response = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": count,
                },
                headers={"X-Api-Key": api_key},
                timeout=15,
            )

            if response.status_code != 200:
                return make_response(
                    {
                        "status": 500,
                        "message": f"NewsAPI returned status {response.status_code}",
                    },
                    500,
                )

            items = response.json().get("articles", [])
            category = get_or_create_default_category()

            created_count = 0
            skipped_count = 0
            failed_count = 0

            for item in items:
                try:
                    article, created = import_article_from_newsapi_item(item, category.category_id)
                    if article is None:
                        skipped_count += 1
                    elif created:
                        db.session.commit()
                        created_count += 1
                    else:
                        skipped_count += 1
                except Exception as item_error:
                    db.session.rollback()
                    log.error("skipping_bad_article: %s", str(item_error))
                    failed_count += 1

            return make_response(
                {
                    "message": "Seed completed",
                    "created": created_count,
                    "skipped_existing": skipped_count,
                    "failed": failed_count,
                    "total_fetched": len(items),
                },
                200,
            )

        except Exception as e:
            db.session.rollback()
            log.error("seed_external_articles_error: %s", str(e))
            return make_response(
                {"status": 500, "message": "Failed to seed articles", "error": str(e)},
                500,
            )