from flask import make_response, request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
import bleach

from models import db, Reaction, User, Article
from schemas import reaction_schema, reactions_schema
from auth_utils import role_required

# Standard logging fallback
try:
    from extensions import log
except ImportError:
    import logging

    log = logging.getLogger(__name__)


# /reactions
class ReactionsResource(Resource):
    # GET /reactions - Public: Fetch all reactions
    def get(self):
        reactions = Reaction.query.all()
        log.info("get_all_reactions %s", reactions_schema.dump(reactions))
        return make_response(reactions_schema.dump(reactions), 200)

    # POST /reactions - Protected: Create a new reaction
    @jwt_required()
    def post(self):
        try:
            current_user_id = int(get_jwt_identity())
            data = request.get_json() or {}

            data["user_id"] = current_user_id
            validated_data = reaction_schema.load(data)

            if not User.query.filter_by(user_id=current_user_id).first():
                return make_response({"status": 404, "message": "User not found"}, 404)
            if not Article.query.filter_by(
                article_id=validated_data["article_id"]
            ).first():
                return make_response(
                    {"status": 404, "message": "Article not found"}, 404
                )

            raw_body = validated_data.get("body", "")
            clean_body = bleach.clean(raw_body, strip=True) if raw_body else raw_body

            new_reaction = Reaction(
                body=clean_body,
                reaction_type=validated_data.get("reaction_type"),
                user_id=current_user_id,
                article_id=validated_data.get("article_id"),
            )

            db.session.add(new_reaction)
            db.session.commit()

            return make_response(reaction_schema.dump(new_reaction), 201)

        except ValidationError as err:
            log.error("validation_error: %s", err.messages)
            response = {
                "status": 400,
                "message": "Validation error(s) occurred",
                "errors": {**err.messages},
            }
            return make_response(response, 400)

        except IntegrityError as ie:
            db.session.rollback()
            log.error("integrity_error: %s", str(ie))
            response = {
                "status": 409,
                "message": "Database constraint violation occurred",
            }
            return make_response(response, 409)

        except Exception as e:
            db.session.rollback()
            log.error("unexpected_error: %s", str(e))
            response = {
                "status": 500,
                "message": "An error occurred",
            }
            return make_response(response, 500)


# /articles/<int:article_id>/reactions
class ArticleReactionsResource(Resource):
    # GET /articles/<int:article_id>/reactions - Public: Fetch all reactions for an article
    def get(self, article_id):
        article = Article.query.filter_by(article_id=article_id).first()
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        reactions = Reaction.query.filter_by(article_id=article_id).all()
        log.info(
            "get_article_%s_reactions %s", article_id, reactions_schema.dump(reactions)
        )
        return make_response(reactions_schema.dump(reactions), 200)


# /reactions/<int:reaction_id>
class ReactionByIDResource(Resource):
    # GET /reactions/<int:reaction_id> - Public: Fetch single reaction
    def get(self, reaction_id):
        reaction = Reaction.query.filter_by(reaction_id=reaction_id).first()

        if reaction:
            return make_response(reaction_schema.dump(reaction), 200)

        response = {"status": 404, "message": "Reaction not found"}
        return make_response(response, 404)

    # PATCH /reactions/<int:reaction_id> - Protected: Selective update (Owner only)
    @jwt_required()
    def patch(self, reaction_id):
        current_user_id = int(get_jwt_identity())
        reaction = Reaction.query.filter_by(reaction_id=reaction_id).first()

        if not reaction:
            return make_response({"status": 404, "message": "Reaction not found"}, 404)

        if reaction.user_id != current_user_id:
            return make_response(
                {
                    "status": 403,
                    "message": "Permission denied: You can only edit your own reactions",
                },
                403,
            )

        try:
            data = request.get_json() or {}
            data.pop("user_id", None)
            validated_data = reaction_schema.load(data, partial=True)

            for key, value in validated_data.items():
                if hasattr(reaction, key):
                    if key == "body" and isinstance(value, str):
                        value = bleach.clean(value, strip=True)
                    setattr(reaction, key, value)

            db.session.commit()
            return make_response(reaction_schema.dump(reaction), 200)

        except ValidationError as err:
            log.error("validation_error: %s", err.messages)
            response = {
                "status": 400,
                "message": "Validation error(s) occurred",
                "errors": {**err.messages},
            }
            return make_response(response, 400)

        except IntegrityError as ie:
            db.session.rollback()
            log.error("integrity_error: %s", str(ie))
            response = {
                "status": 409,
                "message": "Database constraint violation occurred",
            }
            return make_response(response, 409)

        except Exception as e:
            db.session.rollback()
            log.error("unexpected_error: %s", str(e))
            response = {
                "status": 500,
                "message": "An error occurred",
            }
            return make_response(response, 500)

    # DELETE /reactions/<int:reaction_id> - Protected: Delete reaction (Owner OR Admin)
    @jwt_required()
    def delete(self, reaction_id):
        current_user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_role = claims.get("role", "user")

        reaction = Reaction.query.filter_by(reaction_id=reaction_id).first()

        if not reaction:
            return make_response({"status": 404, "message": "Reaction not found"}, 404)

        if reaction.user_id != current_user_id and user_role != "admin":
            return make_response(
                {
                    "status": 403,
                    "message": "Permission denied: You cannot delete this reaction",
                },
                403,
            )

        try:
            db.session.delete(reaction)
            db.session.commit()
            return make_response({"message": "Reaction deleted successfully"}, 200)
        except Exception as e:
            db.session.rollback()
            log.error("unexpected_error", error=str(e))
            return make_response({"status": 500, "message": "An error occurred"}, 500)


# /reactions/<int:reaction_id>/upvote
class ReactionUpvoteResource(Resource):
    # POST /reactions/<int:reaction_id>/upvote - Protected: Increment upvote count for a reaction
    @jwt_required()
    def post(self, reaction_id):
        reaction = Reaction.query.filter_by(reaction_id=reaction_id).first()
        if not reaction:
            return make_response({"status": 404, "message": "Reaction not found"}, 404)

        try:
            reaction.upvotes = (reaction.upvotes or 0) + 1
            db.session.commit()
            return make_response(reaction_schema.dump(reaction), 200)
        except Exception as e:
            db.session.rollback()
            log.error("upvote_error: %s", str(e))
            return make_response({"status": 500, "message": "An error occurred"}, 500)


# /users/<int:user_id>/reactions
class UserReactionsResource(Resource):
    # GET /users/<int:user_id>/reactions - Public: Fetch all reactions created by a specific user
    def get(self, user_id):
        user = User.query.filter_by(user_id=user_id).first()
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)

        reactions = Reaction.query.filter_by(user_id=user_id).all()
        log.info("get_user_%s_reactions %s", user_id, reactions_schema.dump(reactions))

        return make_response(reactions_schema.dump(reactions), 200)