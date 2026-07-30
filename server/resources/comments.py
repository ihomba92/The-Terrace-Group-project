from flask import make_response, request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models import db, Comment, Article, User
from schemas import comment_schema, comments_schema
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
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

            # Create new comment
            new_comment = Comment(
                content=validated_data["content"],
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


# /users/<int:user_id>/comments
class UserCommentsResource(Resource):
    # GET /users/<int:user_id>/comments - Public: Fetch all comments by a specific user
    def get(self, user_id):
        user = db.session.get(User, user_id)
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)

        comments = Comment.query.filter_by(user_id=user_id).all()
        return make_response(comments_schema.dump(comments), 200)


# /comments/<int:comment_id>
class CommentByIDResource(Resource):
    # GET /comments/<int:comment_id> - Public: Fetch a single comment by ID
    def get(self, comment_id):
        comment = Comment.query.filter_by(comment_id=comment_id).first()
        if comment:
            return make_response(comment_schema.dump(comment), 200)

        return make_response({"status": 404, "message": "Comment not found"}, 404)

    # PATCH /comments/<int:comment_id> - Protected: Edit comment content (Owner only)
    @jwt_required()
    def patch(self, comment_id):
        current_user_id = int(get_jwt_identity())
        comment = Comment.query.filter_by(comment_id=comment_id).first()

        if not comment:
            return make_response({"status": 404, "message": "Comment not found"}, 404)

        # Ensure ownership
        if comment.user_id != current_user_id:
            return make_response(
                {"status": 403, "message": "Permission denied: You can only edit your own comments"}, 403
            )

        try:
            data = request.get_json() or {}
            validated_data = comment_schema.load(data, partial=True)

            # Update content
            if "content" in validated_data:
                comment.content = validated_data["content"]

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

        # Allow deletion if the user is either the original author OR an Admin
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