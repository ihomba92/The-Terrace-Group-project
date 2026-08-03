from flask import request, make_response
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity

from auth_utils import role_required
from models import db, User, Profile

VALID_ROLES = ["admin", "author", "user"]


class AdminReportsResource(Resource):
    @role_required(["admin"])
    def get(self):
        # Only users with role='admin' can reach this
        return {"reports": []}, 200


class AdminArticlePublishResource(Resource):
    @role_required(["admin"])
    def patch(self, article_id):
        # Admins can publish articles
        return {"message": f"Article {article_id} published successfully"}, 200


# /admin/users/<int:user_id>/role
class AdminUserRoleResource(Resource):
    # PATCH /admin/users/<int:user_id>/role - Admin Only: Promote or demote a user's role
    @role_required(["admin"])
    @jwt_required()
    def patch(self, user_id):
        current_user_id = int(get_jwt_identity())

        data = request.get_json() or {}
        new_role = data.get("role")

        if new_role not in VALID_ROLES:
            return make_response(
                {
                    "status": 400,
                    "message": f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}",
                },
                400,
            )

        user = db.session.get(User, user_id)
        if not user:
            return make_response({"status": 404, "message": "User not found"}, 404)

        if not user.profile:
            return make_response(
                {"status": 404, "message": "User has no profile to update"}, 404
            )

        # Prevent an admin from accidentally demoting themselves,
        # which could lock the app out of having any admin at all
        if user_id == current_user_id and new_role != "admin":
            return make_response(
                {
                    "status": 400,
                    "message": "You cannot demote your own account. Ask another admin to do this.",
                },
                400,
            )

        try:
            user.profile.role = new_role
            db.session.commit()
            return make_response(
                {
                    "message": f"User {user.username} role updated to '{new_role}'",
                    "user_id": user.user_id,
                    "role": new_role,
                },
                200,
            )
        except Exception as e:
            db.session.rollback()
            return make_response(
                {"status": 500, "message": "Failed to update role", "error": str(e)},
                500,
            )