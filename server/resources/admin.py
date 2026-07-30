from flask_restful import Resource
from flask import make_response
from datetime import datetime
from auth_utils import role_required
from models import Article
from schemas import article_schema

class AdminReportsResource(Resource):
    @role_required(["admin"])
    def get(self):
        from models import db
        article_count = Article.query.count()
        published_count = Article.query.filter(Article.published_at.isnot(None)).count()
        unpublished_count = article_count - published_count
        user_count = db.session.query("users").count() if hasattr(db, "session") else 0

        return make_response({
            "reports": {
                "total_articles": article_count,
                "published": published_count,
                "unpublished": unpublished_count,
                "total_users": user_count,
            }
        }, 200)

class AdminArticlePublishResource(Resource):
    @role_required(["admin"])
    def patch(self, article_id):
        article = Article.query.get(article_id)
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        article.published_at = datetime.utcnow()
        db.session.commit()

        return make_response({
            "message": f"Article {article_id} published successfully",
            "article": article_schema.dump(article),
        }, 200)