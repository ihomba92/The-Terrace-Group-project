from flask import request, make_response
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity

from auth_utils import role_required
from models import db, Match, Prediction
from schemas import prediction_schema, predictions_schema

try:
    from extensions import log
except ImportError:
    import logging

    log = logging.getLogger(__name__)


# /predictions
class PredictionsResource(Resource):
    # GET /predictions - Public: Fetch all predictions
    def get(self):
        predictions = Prediction.query.all()
        return make_response(predictions_schema.dump(predictions), 200)

    # POST /predictions - Protected: Submit a prediction
    @jwt_required()
    def post(self):
        try:
            current_user_id = int(get_jwt_identity())
            data = request.get_json() or {}

            match_id = data.get("match_id")
            if match_id is None:
                return make_response(
                    {"status": 400, "message": "match_id is required"}, 400
                )

            match = db.session.get(Match, int(match_id))
            if not match:
                return make_response({"status": 404, "message": "Match not found"}, 404)

            if match.status != "UPCOMING":
                return make_response(
                    {
                        "status": 400,
                        "message": "Predictions are only accepted for upcoming matches",
                    },
                    400,
                )

            existing_prediction = Prediction.query.filter_by(
                user_id=current_user_id, match_id=match.id
            ).first()
            if existing_prediction:
                return make_response(
                    {
                        "status": 409,
                        "message": "You have already submitted a prediction for this match",
                    },
                    409,
                )

            # Extract scores from flat or nested format
            predicted_home = data.get("predicted_home_score")
            if predicted_home is None:
                predicted_home = data.get("predicted_score", {}).get("home", 0)

            predicted_away = data.get("predicted_away_score")
            if predicted_away is None:
                predicted_away = data.get("predicted_score", {}).get("away", 0)

            # Create prediction automatically bound to current user
            new_pred = Prediction(
                user_id=current_user_id,
                match_id=match.id,
                predicted_home_score=int(predicted_home),
                predicted_away_score=int(predicted_away),
            )

            db.session.add(new_pred)
            db.session.commit()
            return make_response(prediction_schema.dump(new_pred), 201)

        except Exception as e:
            db.session.rollback()
            log.error("create_prediction_error: %s", str(e))
            return make_response({"status": 400, "message": str(e)}, 400)


# /predictions/<int:prediction_id>
class PredictionByIDResource(Resource):
    # GET /predictions/<int:prediction_id> - Public: Fetch prediction details
    def get(self, prediction_id):
        pred = Prediction.query.get_or_404(prediction_id)
        return make_response(prediction_schema.dump(pred), 200)

    # PATCH /predictions/<int:prediction_id> - Protected: Update prediction (Owner only)
    @jwt_required()
    def patch(self, prediction_id):
        current_user_id = int(get_jwt_identity())
        pred = Prediction.query.get_or_404(prediction_id)

        # Enforce ownership
        if pred.user_id != current_user_id:
            return make_response(
                {
                    "status": 403,
                    "message": "Permission denied: You can only edit your own predictions",
                },
                403,
            )

        try:
            data = request.get_json() or {}

            if "predicted_home_score" in data:
                pred.predicted_home_score = data["predicted_home_score"]
            if "predicted_away_score" in data:
                pred.predicted_away_score = data["predicted_away_score"]

            db.session.commit()
            return make_response(prediction_schema.dump(pred), 200)

        except Exception as e:
            db.session.rollback()
            log.error("patch_prediction_error: %s", str(e))
            return make_response({"status": 500, "message": str(e)}, 500)


# /users/<int:user_id>/predictions
class UserPredictionsResource(Resource):
    # GET /users/<int:user_id>/predictions - Public: Fetch predictions made by a specific user
    def get(self, user_id):
        preds = Prediction.query.filter_by(user_id=user_id).all()
        return make_response(predictions_schema.dump(preds), 200)


# /predictions/<int:prediction_id>/resolve
class PredictionResolveResource(Resource):
    # POST /predictions/<int:prediction_id>/resolve - Protected: Resolve prediction outcome (Admin/System action)
    @role_required(["admin"])
    def post(self, prediction_id):
        pred = Prediction.query.get_or_404(prediction_id)
        data = request.get_json() or {}

        try:
            is_correct = data.get("is_correct", False)
            pred.status = "CORRECT" if is_correct else "INCORRECT"
            pred.points_awarded = data.get("points", 10 if is_correct else 0)

            db.session.commit()
            return make_response(prediction_schema.dump(pred), 200)

        except Exception as e:
            db.session.rollback()
            log.error("resolve_prediction_error: %s", str(e))
            return make_response({"status": 500, "message": str(e)}, 500)