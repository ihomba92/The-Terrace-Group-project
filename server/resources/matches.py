from datetime import datetime
from flask import request, make_response
from flask_restful import Resource
from marshmallow import ValidationError

from models import db, Match
from schemas import match_schema, matches_schema, predictions_schema
from auth_utils import role_required

try:
    from extensions import log
except ImportError:
    import logging

    log = logging.getLogger(__name__)


# /matches
class MatchesResource(Resource):
    # GET /matches - Public: Fetch matches with optional filtering (status, league, date)
    def get(self):
        try:
            status = request.args.get("status")  # UPCOMING | LIVE | FINISHED
            league_id = request.args.get("league", type=int)
            date_str = request.args.get("date")  # Format: YYYY-MM-DD

            query = Match.query

            if status:
                query = query.filter_by(status=status.upper())
            if league_id:
                query = query.filter_by(league_id=league_id)
            if date_str and hasattr(Match, "start_time"):
                try:
                    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    query = query.filter(db.func.date(Match.start_time) == target_date)
                except ValueError:
                    return make_response(
                        {
                            "status": 400,
                            "message": "Invalid date format. Use YYYY-MM-DD.",
                        },
                        400,
                    )

            matches = query.all()
            return make_response(matches_schema.dump(matches), 200)

        except Exception as e:
            log.error("get_matches_error: %s", str(e))
            return make_response(
                {"status": 500, "message": "An error occurred fetching matches"}, 500
            )

    # POST /matches - Admin Only: Create new match fixture
    @role_required(["admin"])
    def post(self):
        data = request.get_json() or {}
        try:
            validated_data = match_schema.load(data)
            new_match = Match(**validated_data)

            db.session.add(new_match)
            db.session.commit()
            return make_response(match_schema.dump(new_match), 201)

        except ValidationError as err:
            return make_response(
                {"status": 400, "message": "Validation error", "errors": err.messages},
                400,
            )
        except Exception as e:
            db.session.rollback()
            log.error("create_match_error: %s", str(e))
            return make_response(
                {"status": 500, "message": "Failed to create match"}, 500
            )


# /matches/<int:match_id>
class MatchByIDResource(Resource):
    # GET /matches/<int:match_id> - Public: Fetch full match details
    def get(self, match_id):
        match = Match.query.get_or_404(match_id)
        return make_response(match_schema.dump(match), 200)

    # PUT /matches/<int:match_id> - Admin Only: Update match details/status
    @role_required(["admin"])
    def put(self, match_id):
        match = Match.query.get_or_404(match_id)
        data = request.get_json() or {}
        try:
            validated_data = match_schema.load(data, partial=True)
            for key, value in validated_data.items():
                setattr(match, key, value)

            db.session.commit()
            return make_response(match_schema.dump(match), 200)

        except ValidationError as err:
            return make_response(
                {"status": 400, "message": "Validation error", "errors": err.messages},
                400,
            )
        except Exception as e:
            db.session.rollback()
            log.error("update_match_error: %s", str(e))
            return make_response(
                {"status": 500, "message": "Failed to update match"}, 500
            )

    # DELETE /matches/<int:match_id> - Admin Only: Delete a match fixture
    @role_required(["admin"])
    def delete(self, match_id):
        match = Match.query.get_or_404(match_id)
        try:
            db.session.delete(match)
            db.session.commit()
            return make_response({"message": "Match deleted successfully"}, 200)
        except Exception as e:
            db.session.rollback()
            log.error("delete_match_error: %s", str(e))
            return make_response(
                {"status": 500, "message": "Failed to delete match"}, 500
            )


# /matches/<int:match_id>/live
class MatchLiveResource(Resource):
    # GET /matches/<int:match_id>/live - Public: Fetch live match status and score
    def get(self, match_id):
        match = Match.query.get_or_404(match_id)
        return make_response(
            {
                "id": match.id,
                "status": match.status,
                "minute": match.minute or "0'",
                "home_score": match.home_score if match.home_score is not None else 0,
                "away_score": match.away_score if match.away_score is not None else 0,
                "events": [],
            },
            200,
        )


# /matches/<int:match_id>/events
class MatchEventsResource(Resource):
    # POST /matches/<int:match_id>/events - Admin Only: Register live match event
    @role_required(["admin"])
    def post(self, match_id):
        match = Match.query.get_or_404(match_id)
        data = request.get_json() or {}

        if not data:
            return make_response(
                {"status": 400, "message": "No event data provided"}, 400
            )

        try:
            log.info("match_event_added_for_match_%s", match_id)
            return make_response(
                {"message": "Event added successfully", "event": data}, 201
            )

        except Exception as e:
            db.session.rollback()
            log.error("add_match_event_error: %s", str(e))
            return make_response(
                {"status": 500, "message": "Failed to add match event"}, 500
            )


# /matches/<int:match_id>/predictions
class MatchPredictionsResource(Resource):
    # GET /matches/<int:match_id>/predictions - Public: Fetch predictions for a specific match
    def get(self, match_id):
        match = Match.query.get_or_404(match_id)
        predictions = getattr(match, "predictions", [])

        if hasattr(predictions, "__iter__"):
            return make_response(predictions_schema.dump(predictions), 200)

        return make_response([], 200)