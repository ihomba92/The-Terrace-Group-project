from flask import make_response, request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
import bleach

from models import db, Comment, Article, User
from schemas import comment_schema, comments_schema
from auth_utils import role_required

# Standard logging fallback
try:
    from extensions import log
except ImportError:
    import logging
    log = logging.getLogger(__name__)


# /comments
class CommentsResource(Resource):
    # GET /comments - Admin-only endpoint for moderation/debugging
    @role_required(["admin"])
    def get(self):
        comments = Comment.query.all()
        return make_response(comments_schema.dump(comments), 200)

    # POST /comments - Protected: Post a new comment on an article (Any logged-in user)
    @jwt_required()
    def post(self):
        try:
            current_user_id = int(get_jwt_identity())
            data = request.get_json() or {}

            # Override/assign user_id from the authenticated token
            data["user_id"] = current_user_id

            # Validate input using Marshmallow schema
            validated_data = comment_schema.load(data)

            # Ensure the target article exists
            article = Article.query.filter_by(article_id=validated_data["article_id"]).first()
            if not article:
                return make_response({"status": 404, "message": "Article not found"}, 404)

            raw_content = validated_data.get("content", "")
            clean_content = bleach.clean(raw_content, strip=True) if raw_content else raw_content

            # Create new comment
            new_comment = Comment(
                content=clean_content,
                article_id=validated_data["article_id"],
                user_id=current_user_id,
            )

            db.session.add(new_comment)
            db.session.commit()

            return make_response(comment_schema.dump(new_comment), 201)

        except ValidationError as err:
            log.error("validation_error: %s", err.messages)
            return make_response({
                "status": 400,
                "message": "Validation error(s) occurred",
                "errors": {**err.messages}
            }, 400)

        except IntegrityError as ie:
            db.session.rollback()
            log.error("integrity_error: %s", str(ie))
            return make_response({"status": 409, "message": "Database constraint error"}, 409)

        except Exception as e:
            db.session.rollback()
            log.error("unexpected_error: %s", str(e))
            return make_response({"status": 500, "message": "An error occurred"}, 500)


# /comments/<int:comment_id>
class CommentByIDResource(Resource):
    # GET /comments/<int:comment_id> - Public: Fetch a single comment by ID
    def get(self, comment_id):
        comment = Comment.query.filter_by(comment_id=comment_id).first()
        if comment:
            return make_response(comment_schema.dump(comment), 200)

        return make_response({"status": 404, "message": "Comment not found"}, 404)

    # POST /comments/<int:comment_id> - Protected: Reply/comment on an existing comment
    @jwt_required()
    def post(self, comment_id):
        try:
            current_user_id = int(get_jwt_identity())
            parent_comment = Comment.query.filter_by(comment_id=comment_id).first()

            if not parent_comment:
                return make_response({"status": 404, "message": "Parent comment not found"}, 404)

            data = request.get_json() or {}
            data["user_id"] = current_user_id
            data["article_id"] = parent_comment.article_id
            data["parent_id"] = comment_id

            validated_data = comment_schema.load(data)

            raw_content = validated_data.get("content", "")
            clean_content = bleach.clean(raw_content, strip=True) if raw_content else raw_content

            new_reply = Comment(
                content=clean_content,
                article_id=parent_comment.article_id,
                user_id=current_user_id,
                parent_id=comment_id,
            )

            db.session.add(new_reply)
            db.session.commit()

            return make_response(comment_schema.dump(new_reply), 201)

        except ValidationError as err:
            log.error("validation_error: %s", err.messages)
            return make_response({
                "status": 400,
                "message": "Validation error(s) occurred",
                "errors": {**err.messages}
            }, 400)

        except IntegrityError as ie:
            db.session.rollback()
            log.error("integrity_error: %s", str(ie))
            return make_response({"status": 409, "message": "Database constraint error"}, 409)

        except Exception as e:
            db.session.rollback()
            log.error("unexpected_error: %s", str(e))
            return make_response({"status": 500, "message": "An error occurred"}, 500)

    # PATCH /comments/<int:comment_id> - Protected: Edit comment content (Owner only)
    @jwt_required()
    def patch(self, comment_id):
        current_user_id = int(get_jwt_identity())
        comment = Comment.query.filter_by(comment_id=comment_id).first()

        if not comment:
            return make_response({"status": 404, "message": "Comment not found"}, 404)

        if comment.user_id != current_user_id:
            return make_response(
                {"status": 403, "message": "Permission denied: You can only edit your own comments"}, 403
            )

        try:
            data = request.get_json() or {}
            validated_data = comment_schema.load(data, partial=True)

            if "content" in validated_data:
                raw_content = validated_data["content"]
                comment.content = bleach.clean(raw_content, strip=True) if raw_content else raw_content

            db.session.commit()
            return make_response(comment_schema.dump(comment), 200)

        except ValidationError as err:
            log.error("validation_error: %s", err.messages)
            return make_response({
                "status": 400,
                "message": "Validation error(s) occurred",
                "errors": {**err.messages}
            }, 400)

        except Exception as e:
            db.session.rollback()
            log.error("unexpected_error: %s", str(e))
            return make_response({"status": 500, "message": "An error occurred"}, 500)

    # DELETE /comments/<int:comment_id> - Protected: Delete a comment (Owner OR Admin)
    @jwt_required()
    def delete(self, comment_id):
        current_user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_role = claims.get("role", "user")

        comment = Comment.query.filter_by(comment_id=comment_id).first()

        if not comment:
            return make_response({"status": 404, "message": "Comment not found"}, 404)

        if comment.user_id != current_user_id and user_role != "admin":
            return make_response(
                {"status": 403, "message": "Permission denied: You can only delete your own comments"}, 403
            )

        try:
            db.session.delete(comment)
            db.session.commit()
            return make_response({"message": "Comment deleted successfully"}, 200)

        except Exception as e:
            db.session.rollback()
            log.error("unexpected_error: %s", str(e))
            return make_response({"status": 500, "message": "An error occurred"}, 500)