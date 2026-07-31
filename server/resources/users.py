from flask import request, make_response
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, func
from marshmallow import ValidationError

from models import db, User, Profile, Article, Prediction, Reaction, Follow, Category
from schemas import user_schema, users_schema, profile_schema
from auth_utils import role_required

try:
    from extensions import log
except ImportError:
    import logging
    log = logging.getLogger(__name__)


# /users
class UsersResource(Resource):
    @role_required(["admin"])
    # GET /users - Public: List/search users with pagination
    def get(self):
        try:
            q = request.args.get('q', default='', type=str).strip()
            page = request.args.get('page', default=1, type=int)
            limit = request.args.get('limit', default=10, type=int)

            query = User.query
            if q:
                search_term = f"%{q}%"
                query = query.filter(
                    or_(
                        User.username.ilike(search_term),
                        User.first_name.ilike(search_term),
                        User.last_name.ilike(search_term),
                        User.email.ilike(search_term)
                    )
                )

            paginated = query.paginate(page=page, per_page=limit, error_out=False)
            return make_response({
                "users": users_schema.dump(paginated.items),
                "pagination": {
                    "total_items": paginated.total,
                    "total_pages": paginated.pages,
                    "current_page": paginated.page,
                    "limit": limit
                }
            }, 200)
        except Exception as e:
            return make_response({"message": str(e)}, 500)


# /users/<int:user_id>
class UserByIDResource(Resource):
    # GET /users/<int:user_id> - Public: Fetch profile details
    def get(self, user_id):
        user = db.session.get(User, user_id)
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)
        return make_response(user_schema.dump(user), 200)

    # PATCH /users/<int:user_id> - Protected: Update user profile (Owner only)
    @jwt_required()
    def patch(self, user_id):
        current_user_id = int(get_jwt_identity())

        # Ownership check
        if current_user_id != user_id:
            return make_response(
                {"status": 403, "message": "Permission denied: You can only edit your own profile"}, 403
            )

        user = db.session.get(User, user_id)
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)

        data = request.get_json() or {}

        try:
            # Update basic user fields if sent
            if "first_name" in data:
                user.first_name = data["first_name"]
            if "last_name" in data:
                user.last_name = data["last_name"]

            # Update profile table fields if sent
            if user.profile:
                if "bio" in data:
                    user.profile.bio = data["bio"]
                if "avatar" in data or "profile_pic" in data:
                    user.profile.profile_pic = data.get("avatar") or data.get("profile_pic")
                if "role" in data:
                    user.profile.role = data["role"]
                if "gender" in data:
                    user.profile.gender = data["gender"]

            db.session.commit()
            return make_response(user_schema.dump(user), 200)
        except Exception as e:
            db.session.rollback()
            return make_response({"message": str(e)}, 400)


# /users/<int:user_id>/stats
class UserStatsResource(Resource):
    # GET /users/<int:user_id>/stats - Public: Fetch user activity stats
    def get(self, user_id):
        user = db.session.get(User, user_id)
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)

        posts_count = Article.query.filter_by(author_id=user_id).count()
        predictions_count = Prediction.query.filter_by(user_id=user_id).count()

        # Dynamic calculation of total likes/upvotes received across the user's articles
        total_upvotes = db.session.query(
            func.coalesce(func.sum(Article.likes_count), 0)
        ).filter(Article.author_id == user_id).scalar()

        # Dynamic calculation of category follow counts
        following_count = Follow.query.filter_by(user_id=user_id).count()
        followers_count = Follow.query.filter_by(category_id=user_id).count()

        # Calculate accuracy from resolved predictions
        resolved_preds = Prediction.query.filter(
            Prediction.user_id == user_id,
            Prediction.status.in_(["CORRECT", "INCORRECT"])
        ).all()
        correct_preds = sum(1 for p in resolved_preds if p.status == "CORRECT")
        accuracy = (correct_preds / len(resolved_preds) * 100) if resolved_preds else 0.0

        return make_response({
            "user_id": user_id,
            "posts": posts_count,
            "predictions": predictions_count,
            "accuracy_percentage": round(accuracy, 2),
            "upvotes": total_upvotes,
            "followers": followers_count,
            "following": following_count
        }, 200)


# /users/<int:user_id>/follow
class UserFollowResource(Resource):
    # POST /users/<int:user_id>/follow - Protected: Follow or unfollow a category/entity
    @jwt_required()
    def post(self, user_id):
        current_user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        category_id = data.get("category_id") or request.args.get("category_id", type=int)

        if not category_id:
            return make_response({"status": 400, "message": "category_id parameter is required"}, 400)

        category = db.session.get(Category, category_id)
        if not category:
            return make_response({"status": 404, "message": "Category not found"}, 404)

        existing_follow = Follow.query.filter_by(
            user_id=current_user_id,
            category_id=category_id
        ).first()

        try:
            if existing_follow:
                db.session.delete(existing_follow)
                db.session.commit()
                return make_response({"message": f"Successfully unfollowed category {category_id}", "is_following": False}, 200)
            else:
                new_follow = Follow(user_id=current_user_id, category_id=category_id)
                db.session.add(new_follow)
                db.session.commit()
                return make_response({"message": f"Successfully followed category {category_id}", "is_following": True}, 201)
        except Exception as e:
            db.session.rollback()
            return make_response({"status": 500, "message": str(e)}, 500)


# /users/<int:user_id>/followers
class UserFollowersResource(Resource):
    # GET /users/<int:user_id>/followers - Public: Fetch followers list
    def get(self, user_id):
        user = db.session.get(User, user_id)
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)

        followers = Follow.query.filter_by(category_id=user_id).all()
        follower_user_ids = [f.user_id for f in followers]
        follower_users = User.query.filter(User.user_id.in_(follower_user_ids)).all() if follower_user_ids else []

        return make_response({"followers": users_schema.dump(follower_users)}, 200)


# /users/<int:user_id>/following
class UserFollowingResource(Resource):
    # GET /users/<int:user_id>/following - Public: Fetch following list
    def get(self, user_id):
        user = db.session.get(User, user_id)
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)

        following = Follow.query.filter_by(user_id=user_id).all()
        followed_category_ids = [f.category_id for f in following]

        return make_response({"following_category_ids": followed_category_ids}, 200)