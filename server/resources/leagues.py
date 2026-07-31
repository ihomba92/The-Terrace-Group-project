from flask import make_response, request
from flask_restful import Resource
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from models import db, League
from schemas import league_schema, leagues_schema
from auth_utils import role_required

try:
    from extensions import log
except ImportError:
    import logging
    log = logging.getLogger(__name__)


# GET /api/leagues & POST /api/leagues
class LeaguesResource(Resource):
    # GET /api/leagues - Public: Fetch all leagues (supports optional country filter)
    def get(self):
        try:
            country = request.args.get('country', type=str)
            query = League.query

            if country:
                query = query.filter(League.country.ilike(f"%{country}%"))

            leagues = query.all()
            return make_response({"leagues": leagues_schema.dump(leagues)}, 200)
        except Exception as e:
            log.error("get_leagues_error", error=str(e))
            return make_response({"status": 500, "message": "Failed to fetch leagues"}, 500)

    # POST /api/leagues - Admin Only: Create a new league
    @role_required(["admin"])
    def post(self):
        try:
            data = request.get_json() or {}
            validated_data = league_schema.load(data)

            new_league = League(
                name=validated_data["name"],
                country=validated_data["country"],
                logo_url=validated_data.get("logo_url")
            )

            db.session.add(new_league)
            db.session.commit()
            return make_response(league_schema.dump(new_league), 201)

        except ValidationError as err:
            return make_response({"status": 400, "errors": err.messages}, 400)
        except IntegrityError:
            db.session.rollback()
            return make_response({"status": 409, "message": "League already exists"}, 409)
        except Exception as e:
            db.session.rollback()
            return make_response({"status": 500, "message": str(e)}, 500)


# GET, PATCH, DELETE /api/leagues/<int:league_id>
class LeagueByIDResource(Resource):
    # GET /api/leagues/<int:league_id> - Public: Fetch league by ID
    def get(self, league_id):
        league = League.query.filter_by(id=league_id).first()
        if not league:
            return make_response({"status": 404, "message": "League not found"}, 404)

        payload = league_schema.dump(league)
        # Include nested teams & upcoming matches summary safely
        payload["teams_count"] = len(getattr(league, 'teams', []))
        payload["matches_count"] = len(getattr(league, 'matches', []))
        return make_response(payload, 200)

    # PATCH /api/leagues/<int:league_id> - Admin Only: Update a league
    @role_required(["admin"])
    def patch(self, league_id):
        league = League.query.filter_by(id=league_id).first()
        if not league:
            return make_response({"status": 404, "message": "League not found"}, 404)

        try:
            data = request.get_json() or {}
            validated_data = league_schema.load(data, partial=True)

            for key, value in validated_data.items():
                if hasattr(league, key):
                    setattr(league, key, value)

            db.session.commit()
            return make_response(league_schema.dump(league), 200)
        except ValidationError as err:
            return make_response({"status": 400, "errors": err.messages}, 400)
        except Exception as e:
            db.session.rollback()
            return make_response({"status": 500, "message": str(e)}, 500)

    # DELETE /api/leagues/<int:league_id> - Admin Only: Delete a league
    @role_required(["admin"])
    def delete(self, league_id):
        league = League.query.filter_by(id=league_id).first()
        if not league:
            return make_response({"status": 404, "message": "League not found"}, 404)

        try:
            db.session.delete(league)
            db.session.commit()
            return make_response({"message": "League deleted successfully"}, 200)
        except Exception as e:
            db.session.rollback()
            return make_response({"status": 500, "message": str(e)}, 500)