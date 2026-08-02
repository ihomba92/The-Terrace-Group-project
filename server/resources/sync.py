import os
import requests
from datetime import datetime
from flask import request, make_response
from flask_restful import Resource

from models import db, League, Team, Match
from auth_utils import role_required

try:
    from extensions import log
except ImportError:
    import logging
    log = logging.getLogger(__name__)


FOOTBALL_DATA_BASE_URL = "https://api.football-data.org/v4"

# Maps football-data.org competition codes to your existing League names
COMPETITION_MAP = {
    "PL": "English Premier League",
    "PD": "La Liga",
    "SA": "Serie A",
    "BL1": "Bundesliga",
    "FL1": "Ligue 1",
    "CL": "Champions League",
}

STATUS_MAP = {
    "SCHEDULED": "UPCOMING",
    "TIMED": "UPCOMING",
    "IN_PLAY": "LIVE",
    "PAUSED": "LIVE",
    "FINISHED": "FINISHED",
    "POSTPONED": "UPCOMING",
    "SUSPENDED": "LIVE",
    "CANCELLED": "UPCOMING",
}


def map_status(external_status):
    return STATUS_MAP.get(external_status, "UPCOMING")


def get_or_create_league(competition_data, league_name):
    """Find a League by external_id, falling back to name match, or create it."""
    external_id = competition_data.get("id")

    league = League.query.filter_by(external_id=external_id).first()
    if league:
        return league

    league = League.query.filter_by(name=league_name).first()
    if league:
        league.external_id = external_id
        return league

    area = competition_data.get("area", {})
    league = League(
        name=league_name,
        country=area.get("name", "Unknown"),
        logo_url=competition_data.get("emblem"),
        external_id=external_id,
    )
    db.session.add(league)
    db.session.flush()  # get league.id before teams reference it
    return league


def get_or_create_team(team_data, league_id):
    """Find a Team by external_id, falling back to name match, or create it."""
    external_id = team_data.get("id")

    team = Team.query.filter_by(external_id=external_id).first()
    if team:
        return team

    name = team_data.get("name", "Unknown")
    team = Team.query.filter_by(name=name, league_id=league_id).first()
    if team:
        team.external_id = external_id
        return team

    team = Team(
        name=name,
        short_code=(team_data.get("tla") or name[:3]).upper(),
        logo_url=team_data.get("crest"),
        league_id=league_id,
        external_id=external_id,
    )
    db.session.add(team)
    db.session.flush()
    return team


def upsert_match(match_data, league_id, home_team_id, away_team_id):
    """Create or update a Match record from football-data.org match data."""
    external_id = match_data.get("id")
    score = match_data.get("score", {}).get("fullTime", {})

    match = Match.query.filter_by(external_id=external_id).first()

    start_time = datetime.fromisoformat(
        match_data["utcDate"].replace("Z", "+00:00")
    ).replace(tzinfo=None)

    if match:
        match.status = map_status(match_data.get("status"))
        match.home_score = score.get("home")
        match.away_score = score.get("away")
        match.start_time = start_time
        return match, False  # updated, not created

    match = Match(
        league_id=league_id,
        home_team_id=home_team_id,
        away_team_id=away_team_id,
        start_time=start_time,
        status=map_status(match_data.get("status")),
        home_score=score.get("home"),
        away_score=score.get("away"),
        external_id=external_id,
    )
    db.session.add(match)
    return match, True  # created


# /admin/sync-matches
class AdminSyncMatchesResource(Resource):
    # POST /admin/sync-matches - Admin Only: Pull latest matches from football-data.org
    @role_required(["admin"])
    def post(self):
        api_key = os.getenv("FOOTBALL_DATA_API_KEY")
        if not api_key:
            return make_response(
                {"status": 500, "message": "FOOTBALL_DATA_API_KEY is not configured"},
                500,
            )

        data = request.get_json() or {}
        # Optional: sync only specific competitions, default to all mapped ones
        competition_codes = data.get("competitions", list(COMPETITION_MAP.keys()))
        date_from = data.get("date_from")  # e.g. "2026-08-01"
        date_to = data.get("date_to")      # e.g. "2026-08-31"

        headers = {"X-Auth-Token": api_key}
        summary = {"created": 0, "updated": 0, "errors": []}

        for code in competition_codes:
            league_name = COMPETITION_MAP.get(code)
            if not league_name:
                summary["errors"].append(f"Unknown competition code: {code}")
                continue

            try:
                params = {}
                if date_from:
                    params["dateFrom"] = date_from
                if date_to:
                    params["dateTo"] = date_to

                response = requests.get(
                    f"{FOOTBALL_DATA_BASE_URL}/competitions/{code}/matches",
                    headers=headers,
                    params=params,
                    timeout=15,
                )

                if response.status_code != 200:
                    summary["errors"].append(
                        f"{code}: API returned {response.status_code}"
                    )
                    continue

                payload = response.json()
                competition_data = payload.get("competition", {})
                league = get_or_create_league(competition_data, league_name)

                for match_data in payload.get("matches", []):
                    home_team = get_or_create_team(match_data["homeTeam"], league.id)
                    away_team = get_or_create_team(match_data["awayTeam"], league.id)

                    match, created = upsert_match(
                        match_data, league.id, home_team.id, away_team.id
                    )
                    if created:
                        summary["created"] += 1
                    else:
                        summary["updated"] += 1

                db.session.commit()

            except Exception as e:
                db.session.rollback()
                log.error("sync_error for %s: %s", code, str(e))
                summary["errors"].append(f"{code}: {str(e)}")

        return make_response(
            {
                "message": "Sync completed",
                "created": summary["created"],
                "updated": summary["updated"],
                "errors": summary["errors"],
            },
            200,
        )