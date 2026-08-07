from flask import make_response, request
from flask_restful import Resource
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    get_jwt,
    verify_jwt_in_request,
)
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
import bleach
import os
import requests

from models import db, Article, User, Category, Comment
from schemas import article_schema, articles_schema, comments_schema, comment_schema
from auth_utils import role_required

# Standard logging fallback
try:
    from extensions import log
except ImportError:
    import logging

    log = logging.getLogger(__name__)


# /articles
class ArticlesResource(Resource):
    # GET /articles - Public: only PUBLISHED articles.
    # Admins can pass ?status=all|PENDING|PUBLISHED|REJECTED to see everything
    # (used by AdminDashboard's moderation queue).
    def get(self):
        category_id = request.args.get("category_id")
        status_param = request.args.get("status")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)

        query = Article.query

        if category_id:
            query = query.filter_by(category_id=category_id)

        # Optional JWT check — endpoint stays public, but an authenticated
        # admin gets elevated visibility via status_param.
        is_admin = False
        verify_jwt_in_request(optional=True)
        if get_jwt_identity():
            claims = get_jwt() or {}
            is_admin = claims.get("role") == "admin"

        if is_admin and status_param:
            if status_param.upper() != "ALL":
                query = query.filter_by(status=status_param.upper())
            # status=all -> no filter, admin sees every status
        else:
            query = query.filter_by(status="PUBLISHED")

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        articles = pagination.items

        log.info(f"get_all_articles count={len(articles)} page={page} per_page={per_page}")

        return make_response({
            "articles": articles_schema.dump(articles),
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": per_page,
            "has_next": pagination.has_next,
            "has_prev": pagination.has_prev
        }, 200)

    # POST /articles - Protected: Create a new article (Admin/Author only)
    # New articles get status="PENDING" automatically from the model default.
    @role_required(["admin", "author"])
    def post(self):
        try:
            current_user_id = int(get_jwt_identity())
            data = request.get_json() or {}

            data["user_id"] = current_user_id
            validated_data = article_schema.load(data)

            if not User.query.filter_by(user_id=current_user_id).first():
                return make_response({"status": 404, "message": "User not found"}, 404)

            if "category_id" in validated_data and validated_data["category_id"]:
                if not Category.query.filter_by(
                    category_id=validated_data["category_id"]
                ).first():
                    return make_response(
                        {"status": 404, "message": "Category not found"}, 404
                    )

            raw_title = validated_data.get("title", "")
            raw_content = validated_data.get("content", "")

            clean_title = bleach.clean(raw_title, strip=True) if raw_title else raw_title
            clean_content = bleach.clean(raw_content, strip=True) if raw_content else raw_content

            new_article = Article(
                title=clean_title,
                content=clean_content,
                cover_image=validated_data.get("cover_image"),
                view_count=validated_data.get("view_count", 0),
                likes_count=validated_data.get("likes_count", 0),
                author_id=current_user_id,
                category_id=validated_data.get("category_id"),
            )

            db.session.add(new_article)
            db.session.commit()

            return make_response(article_schema.dump(new_article), 201)

        except ValidationError as err:
            log.error(f"validation_error: {err.messages}")
            return make_response(
                {
                    "status": 400,
                    "message": "Validation error(s) occurred",
                    "errors": {**err.messages},
                },
                400,
            )

        except IntegrityError as ie:
            db.session.rollback()
            log.error(f"integrity_error: {str(ie)}")
            return make_response(
                {"status": 409, "message": "Database constraint violation occurred"},
                409,
            )

        except Exception as e:
            db.session.rollback()
            log.error(f"unexpected_error: {str(e)}")
            return make_response({"status": 500, "message": "An error occurred"}, 500)


# /articles/<int:article_id>
class ArticleByIDResource(Resource):
    # GET /articles/<int:article_id> - Public: Fetch a single article by ID
    def get(self, article_id):
        article = Article.query.filter_by(article_id=article_id).first()
        if article:
            return make_response(article_schema.dump(article), 200)
        return make_response({"status": 404, "message": "Article not found"}, 404)

    # PATCH /articles/<int:article_id> - Protected: Update article (Owner or Admin)
    @jwt_required()
    def patch(self, article_id):
        current_user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_role = claims.get("role", "user")

        article = Article.query.filter_by(article_id=article_id).first()
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        if article.author_id != current_user_id and user_role != "admin":
            return make_response(
                {
                    "status": 403,
                    "message": "Permission denied: Cannot edit this article",
                },
                403,
            )

        try:
            data = request.get_json() or {}
            data.pop("user_id", None)

            # Non-admins may only move status to PENDING, and only from
            # REJECTED — i.e. resubmitting their own rejected article for
            # review. Everything else (self-publishing, un-rejecting into
            # PUBLISHED, etc.) stays admin-only via the dedicated
            # publish/reject endpoints.
            requested_status = data.get("status")
            is_resubmission = False
            if requested_status is not None and user_role != "admin":
                if requested_status.upper() != "PENDING" or article.status != "REJECTED":
                    return make_response(
                        {
                            "status": 403,
                            "message": "You can only resubmit a rejected article for review.",
                        },
                        403,
                    )
                is_resubmission = True

            validated_data = article_schema.load(data, partial=True)

            for key, value in validated_data.items():
                if hasattr(article, key):
                    if key in ["title", "content"] and isinstance(value, str):
                        value = bleach.clean(value, strip=True)
                    setattr(article, key, value)

            # Resubmitting clears the old rejection so the moderation queue
            # doesn't show a stale reason next to what's now new content.
            if is_resubmission:
                article.rejection_reason = None
                article.published_at = None

            db.session.commit()
            return make_response(article_schema.dump(article), 200)

        except ValidationError as err:
            log.error(f"validation_error: {err.messages}")
            return make_response(
                {
                    "status": 400,
                    "message": "Validation error(s) occurred",
                    "errors": {**err.messages},
                },
                400,
            )

        except IntegrityError as ie:
            db.session.rollback()
            log.error(f"integrity_error: {str(ie)}")
            return make_response(
                {"status": 409, "message": "Database constraint violation occurred"},
                409,
            )

        except Exception as e:
            db.session.rollback()
            log.error(f"unexpected_error: {str(e)}")
            return make_response({"status": 500, "message": "An error occurred"}, 500)

    # DELETE /articles/<int:article_id> - Protected: Delete article (Owner or Admin)
    @jwt_required()
    def delete(self, article_id):
        current_user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_role = claims.get("role", "user")

        article = Article.query.filter_by(article_id=article_id).first()
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        if article.author_id != current_user_id and user_role != "admin":
            return make_response(
                {
                    "status": 403,
                    "message": "Permission denied: Cannot delete this article",
                },
                403,
            )

        try:
            db.session.delete(article)
            db.session.commit()
            return make_response({"message": "Article deleted successfully"}, 200)
        except Exception as e:
            db.session.rollback()
            log.error(f"unexpected_error: {str(e)}")
            return make_response({"status": 500, "message": "An error occurred"}, 500)


# /articles/<int:article_id>/upvote
class ArticleUpvoteResource(Resource):
    # POST /articles/<int:article_id>/upvote - Protected: Increment upvote count for an article
    @jwt_required()
    def post(self, article_id):
        article = Article.query.filter_by(article_id=article_id).first()
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        try:
            article.likes_count = (article.likes_count or 0) + 1
            db.session.commit()
            return make_response(article_schema.dump(article), 200)
        except Exception as e:
            db.session.rollback()
            log.error(f"unexpected_error: {str(e)}")
            return make_response({"status": 500, "message": "An error occurred"}, 500)


# /articles/<int:article_id>/comments
class ArticleCommentsResource(Resource):
    # GET /articles/<int:article_id>/comments - Public: Fetch all comments for a specific article
    def get(self, article_id):
        article = Article.query.filter_by(article_id=article_id).first()
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        comments = getattr(article, "comments", [])
        return make_response(comments_schema.dump(comments), 200)

    # POST /articles/<int:article_id>/comments - Protected: Add a comment to an article
    @jwt_required()
    def post(self, article_id):
        article = Article.query.filter_by(article_id=article_id).first()
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        try:
            current_user_id = int(get_jwt_identity())
            data = request.get_json() or {}
            data["user_id"] = current_user_id
            data["article_id"] = article_id

            validated_data = comment_schema.load(data)
            raw_content = validated_data.get("content", "")
            clean_content = bleach.clean(raw_content, strip=True) if raw_content else raw_content

            new_comment = Comment(
                content=clean_content,
                user_id=current_user_id,
                article_id=article_id,
            )

            db.session.add(new_comment)
            db.session.commit()

            return make_response(comment_schema.dump(new_comment), 201)

        except ValidationError as err:
            log.error(f"validation_error: {err.messages}")
            return make_response(
                {
                    "status": 400,
                    "message": "Validation error(s) occurred",
                    "errors": {**err.messages},
                },
                400,
            )

        except Exception as e:
            db.session.rollback()
            log.error(f"unexpected_error: {str(e)}")
            return make_response({"status": 500, "message": "An error occurred"}, 500)


# /users/<int:user_id>/articles
class UserArticlesResource(Resource):
    # GET /users/<int:user_id>/articles - Public: Fetch all articles written by a specific user with pagination
    def get(self, user_id):
        user = User.query.filter_by(user_id=user_id).first()
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)

        pagination = Article.query.filter_by(author_id=user_id).paginate(page=page, per_page=per_page, error_out=False)
        articles = pagination.items

        return make_response({
            "articles": articles_schema.dump(articles),
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page
        }, 200)


# /news
class NewsResource(Resource):
    def get(self):
        try:
            query = request.args.get("q", "football")
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 10, type=int)

            query_mapping = {
                "la liga": "La Liga OR Real Madrid OR Barcelona",
                "serie a": "Serie A OR Juventus OR AC Milan OR Inter Milan",
                "bundesliga": "Bundesliga OR Bayern Munich OR Dortmund",
                "ligue 1": "Ligue 1 OR PSG",
                "champions league": "Champions League OR UEFA",
                "english premier league": "Premier League OR Arsenal OR Chelsea OR Manchester United OR Liverpool"
            }

            search_term = query_mapping.get(query.lower(), query)

            params = {
                "q": search_term,
                "language": "en",
                "sortBy": "publishedAt",
                "page": page,
                "pageSize": per_page
            }

            api_key = os.getenv("NEWS_API_KEY")
            if not api_key:
                return make_response({
                    "articles": [],
                    "total": 0,
                    "current_page": page,
                    "per_page": per_page,
                    "error": "News API key is not configured"
                }, 500)

            response = requests.get(
                "https://newsapi.org/v2/everything",
                params=params,
                headers={"X-Api-Key": api_key},
                timeout=10,
            )

            data = response.json()

            status = 200 if response.status_code < 400 else 500

            return make_response({
                "articles": data.get("articles", []) if status == 200 else [],
                "total": data.get("totalResults", 0) if status == 200 else 0,
                "current_page": page,
                "per_page": per_page,
                **({"error": "Upstream news provider rejected the request"} if status == 500 else {})
            }, status)

        except requests.RequestException as e:
            return make_response(
                {
                    "status": 500,
                    "message": "Failed to fetch news",
                    "error": str(e),
                },
                500,
            )