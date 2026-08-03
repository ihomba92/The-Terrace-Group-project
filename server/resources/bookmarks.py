from flask import make_response
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Bookmark, Article
from schemas import articles_schema

try:
    from extensions import log
except ImportError:
    import logging
    log = logging.getLogger(__name__)


# /articles/<int:article_id>/bookmark
class ArticleBookmarkResource(Resource):
    # POST /articles/<int:article_id>/bookmark - Protected: Bookmark an article
    @jwt_required()
    def post(self, article_id):
        current_user_id = int(get_jwt_identity())

        article = Article.query.filter_by(article_id=article_id).first()
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        existing = Bookmark.query.filter_by(
            user_id=current_user_id, article_id=article_id
        ).first()
        if existing:
            return make_response({"message": "Already bookmarked", "bookmarked": True}, 200)

        try:
            bookmark = Bookmark(user_id=current_user_id, article_id=article_id)
            db.session.add(bookmark)
            db.session.commit()
            return make_response({"message": "Article bookmarked", "bookmarked": True}, 201)
        except Exception as e:
            db.session.rollback()
            log.error("bookmark_create_error: %s", str(e))
            return make_response({"status": 500, "message": "Failed to bookmark article"}, 500)

    # DELETE /articles/<int:article_id>/bookmark - Protected: Remove a bookmark
    @jwt_required()
    def delete(self, article_id):
        current_user_id = int(get_jwt_identity())

        bookmark = Bookmark.query.filter_by(
            user_id=current_user_id, article_id=article_id
        ).first()
        if not bookmark:
            return make_response({"message": "Bookmark not found", "bookmarked": False}, 200)

        try:
            db.session.delete(bookmark)
            db.session.commit()
            return make_response({"message": "Bookmark removed", "bookmarked": False}, 200)
        except Exception as e:
            db.session.rollback()
            log.error("bookmark_delete_error: %s", str(e))
            return make_response({"status": 500, "message": "Failed to remove bookmark"}, 500)


# /users/<int:user_id>/bookmarks
class UserBookmarksResource(Resource):
    # GET /users/<int:user_id>/bookmarks - Protected: Fetch all bookmarked articles for a user
    @jwt_required()
    def get(self, user_id):
        current_user_id = int(get_jwt_identity())

        if user_id != current_user_id:
            return make_response(
                {"status": 403, "message": "You can only view your own bookmarks"}, 403
            )

        bookmarks = Bookmark.query.filter_by(user_id=user_id).all()
        articles = [b.article for b in bookmarks if b.article]

        return make_response(articles_schema.dump(articles), 200)