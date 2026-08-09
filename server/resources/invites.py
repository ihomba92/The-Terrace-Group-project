from datetime import datetime, timedelta
from flask import request, make_response
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from models import db, Invite
from schemas import invite_schema, invites_schema
from auth_utils import role_required


class AdminInvitesResource(Resource):
    # GET /admin/invites - list all invites (outstanding + used), most recent first
    @role_required(["admin"])
    def get(self):
        invites = Invite.query.order_by(Invite.created_at.desc()).all()
        return make_response(invites_schema.dump(invites), 200)

    # POST /admin/invites - create a new invite. Body: { role, email?, expires_in_days? }
    @role_required(["admin"])
    def post(self):
        try:
            current_user_id = int(get_jwt_identity())
            data = request.get_json() or {}
            validated = invite_schema.load(data, partial=True)

            expires_in_days = data.get("expires_in_days", 7)

            invite = Invite(
                role=validated["role"],
                email=validated.get("email"),
                created_by_id=current_user_id,
                expires_at=datetime.utcnow() + timedelta(days=expires_in_days),
            )
            db.session.add(invite)
            db.session.commit()

            return make_response(invite_schema.dump(invite), 201)

        except ValidationError as err:
            return make_response({"status": 400, "errors": err.messages}, 400)
        except Exception as e:
            db.session.rollback()
            return make_response({"status": 500, "message": "Failed to create invite", "error": str(e)}, 500)


# DELETE /admin/invites/<int:invite_id> - revoke an unused invite
class AdminInviteByIDResource(Resource):
    @role_required(["admin"])
    def delete(self, invite_id):
        invite = db.session.get(Invite, invite_id)
        if not invite:
            return make_response({"status": 404, "message": "Invite not found"}, 404)
        if invite.used_by_id is not None:
            return make_response({"status": 400, "message": "Cannot revoke an already-used invite"}, 400)

        db.session.delete(invite)
        db.session.commit()
        return make_response({"message": "Invite revoked"}, 200)