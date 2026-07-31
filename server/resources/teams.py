from flask import request, make_response
from flask_restful import Resource

from models import db, Team
from schemas import team_schema, teams_schema
from auth_utils import role_required  # <-- Properly imported decorator

try:
    from extensions import log
except ImportError:
    import logging
    log = logging.getLogger(__name__)


# /teams
class TeamsResource(Resource):
    # GET /teams - Public: Fetch all teams
    def get(self):
        try:
            teams = Team.query.all()
            return make_response(teams_schema.dump(teams), 200)
        except Exception as e:
            log.error("get_teams_error", error=str(e))
            return make_response({"status": 500, "message": "Failed to fetch teams"}, 500)

    # POST /teams - Admin Only: Create a new team
    @role_required(["admin"])
    def post(self):
        try:
            data = request.get_json() or {}
            validated_data = team_schema.load(data)

            new_team = Team(**validated_data)
            db.session.add(new_team)
            db.session.commit()

            return make_response(team_schema.dump(new_team), 201)

        except Exception as e:
            db.session.rollback()
            log.error("create_team_error", error=str(e))
            return make_response({"status": 400, "message": "Failed to create team", "error": str(e)}, 400)


# /teams/<int:team_id>
class TeamByIDResource(Resource):
    # GET /teams/<int:team_id> - Public: Get specific team details
    def get(self, team_id):
        team = Team.query.filter_by(id=team_id).first()
        if not team:
            return make_response({"status": 404, "message": "Team not found"}, 404)

        return make_response(team_schema.dump(team), 200)

    # PATCH /teams/<int:team_id> - Admin Only: Update team info (logo, name, stadium)
    @role_required(["admin"])
    def patch(self, team_id):
        team = Team.query.filter_by(id=team_id).first()
        if not team:
            return make_response({"status": 404, "message": "Team not found"}, 404)

        try:
            data = request.get_json() or {}
            validated_data = team_schema.load(data, partial=True)

            for key, value in validated_data.items():
                if hasattr(team, key):
                    setattr(team, key, value)

            db.session.commit()
            return make_response(team_schema.dump(team), 200)

        except Exception as e:
            db.session.rollback()
            log.error("update_team_error", error=str(e))
            return make_response({"status": 400, "message": "Failed to update team"}, 400)

    # DELETE /teams/<int:team_id> - Admin Only: Remove a team
    @role_required(["admin"])
    def delete(self, team_id):
        team = Team.query.filter_by(id=team_id).first()
        if not team:
            return make_response({"status": 404, "message": "Team not found"}, 404)

        try:
            db.session.delete(team)
            db.session.commit()
            return make_response({"message": "Team deleted successfully"}, 200)
        except Exception as e:
            db.session.rollback()
            log.error("delete_team_error", error=str(e))
            return make_response({"status": 500, "message": "Failed to delete team"}, 500)