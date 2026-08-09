from datetime import datetime
from flask import request, make_response, jsonify
from flask_restful import Resource
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from models import db, User, Profile, TokenBlocklist, Invite
from schemas import user_schema, login_schema, register_schema


class RegisterResource(Resource):
    def post(self):
        try:
            data = request.get_json() or {}
            validated_data = register_schema.load(data)

            existing_user = db.session.execute(
                db.select(User).filter(
                    (User.username == validated_data["username"])
                    | (User.email == validated_data["email"])
                )
            ).scalar_one_or_none()

            if existing_user:
                if existing_user.username == validated_data["username"]:
                    return make_response(
                        {"status": 400, "message": "Username already taken"}, 400
                    )
                return make_response(
                    {"status": 400, "message": "Email already registered"}, 400
                )

            # Resolve role purely from a valid invite — never trust a
            # client-supplied "role" field directly (RegisterSchema still
            # accepts one for other reasons, but it's intentionally unused
            # here; only invite_code can elevate a new account above "user").
            assigned_role = "user"
            invite = None
            invite_code = validated_data.get("invite_code")
            if invite_code:
                invite = db.session.execute(
                    db.select(Invite).filter_by(code=invite_code)
                ).scalar_one_or_none()

                if not invite or not invite.is_valid:
                    return make_response(
                        {"status": 400, "message": "Invalid or expired invite code"}, 400
                    )
                if invite.email and invite.email.lower() != validated_data["email"].lower():
                    return make_response(
                        {"status": 400, "message": "This invite is tied to a different email address"}, 400
                    )
                assigned_role = invite.role

            user = User(
                first_name=validated_data["first_name"],
                last_name=validated_data["last_name"],
                username=validated_data["username"],
                email=validated_data["email"],
            )
            user.set_password(validated_data["password"])

            db.session.add(user)
            db.session.flush()

            profile = Profile(
                user_id=user.user_id,
                role=assigned_role,
                bio="",
                gender="Not Specified",
            )
            db.session.add(profile)

            if invite:
                invite.used_by_id = user.user_id
                invite.used_at = datetime.utcnow()

            db.session.commit()

            additional_claims = {"role": assigned_role}
            access_token = create_access_token(
                identity=str(user.user_id),
                additional_claims=additional_claims,
            )
            refresh_token = create_refresh_token(
                identity=str(user.user_id),
                additional_claims=additional_claims,
            )

            return make_response(
                {
                    "message": "User registered successfully",
                    "user": user_schema.dump(user),
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                },
                201,
            )

        except ValidationError as err:
            return make_response({"status": 400, "errors": err.messages}, 400)
        except IntegrityError:
            db.session.rollback()
            return make_response({"status": 409, "message": "Database conflict"}, 409)


class LoginResource(Resource):
    def post(self):
        try:
            data = request.get_json() or {}
            validated_data = login_schema.load(data)

            user = db.session.execute(
                db.select(User).filter_by(email=validated_data["email"])
            ).scalar_one_or_none()

            if not user or not user.check_password(validated_data["password"]):
                return make_response(
                    {"status": 401, "message": "Invalid email or password"}, 401
                )

            user_role = (
                user.profile.role
                if (hasattr(user, "profile") and user.profile)
                else "user"
            )
            additional_claims = {"role": user_role}

            access_token = create_access_token(
                identity=str(user.user_id),
                additional_claims=additional_claims,
            )
            refresh_token = create_refresh_token(
                identity=str(user.user_id),
                additional_claims=additional_claims,
            )

            return make_response(
                {
                    "message": "Login successful",
                    "user": user_schema.dump(user),
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                },
                200,
            )

        except ValidationError as err:
            return make_response({"status": 400, "errors": err.messages}, 400)


class LogoutResource(Resource):
    @jwt_required(verify_type=False)
    def post(self):
        """Logs out the user by adding the token JTI to the blocklist."""
        try:
            token = get_jwt()
            jti = token["jti"]
            db.session.add(TokenBlocklist(jti=jti))
            db.session.commit()
            return make_response({"message": "Successfully logged out"}, 200)
        except Exception as e:
            db.session.rollback()
            return make_response({"status": 500, "message": "An error occurred during logout"}, 500)


class RefreshTokenResource(Resource):
    @jwt_required(refresh=True)
    def post(self):
        """Generates a new access token using a valid refresh token."""
        current_user_id = get_jwt_identity()
        claims = get_jwt()

        user_role = claims.get("role", "user")
        new_access_token = create_access_token(
            identity=current_user_id,
            additional_claims={"role": user_role},
        )

        return make_response(
            {
                "message": "Token refreshed successfully",
                "access_token": new_access_token,
            },
            200,
        )


class MeResource(Resource):
    @jwt_required()
    def get(self):
        """Protected route to get current authenticated user's profile."""
        try:
            current_user_id = get_jwt_identity()
            # Ensure it's converted cleanly to an int
            user_id = int(current_user_id)

            user = db.session.get(User, user_id)

            if not user:
                return make_response({"status": 404, "message": "User not found"}, 404)

            return make_response(user_schema.dump(user), 200)

        except Exception as e:
            db.session.rollback()
            return make_response({"status": 500, "message": f"Server error: {str(e)}"}, 500)