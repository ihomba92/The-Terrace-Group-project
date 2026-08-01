import logging
import os
import time
from datetime import timedelta
from dotenv import load_dotenv
from flask import Flask, jsonify, request, g
from flask_restful import Api
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import structlog
import sys

from extensions import db, bcrypt, jwt, migrate, cors


def configure_logging():
    """Configure structlog and standard library logging integration."""
    logging.basicConfig(
        format="%(message)s",
        stream=logging.sys.stdout,
        level=logging.INFO,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if os.getenv("FLASK_ENV") != "production" else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def create_app():
    app = Flask(__name__)

    basedir = os.path.abspath(os.path.dirname(__file__))
    load_dotenv(os.path.join(basedir, ".env"))

    # APPLICATION CONFIGURATION & STRICT SECURITY KEYS
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise RuntimeError("CRITICAL: 'SECRET_KEY' environment variable is missing!")
    app.config["SECRET_KEY"] = secret_key

    jwt_secret_key = os.getenv("JWT_SECRET_KEY")
    if not jwt_secret_key:
        raise RuntimeError("CRITICAL: 'JWT_SECRET_KEY' environment variable is missing!")
    app.config["JWT_SECRET_KEY"] = jwt_secret_key

    instance_dir = os.path.join(basedir, "instance")

    # Programmatically ensure the instance directory exists to avoid operational errors
    os.makedirs(instance_dir, exist_ok=True)

    # Robust absolute path resolution for SQLite databases specified via env or default
    env_db_url = os.getenv("DATABASE_URL")
    if env_db_url:
        env_db_url = env_db_url.strip('"\' ')
        # If a relative sqlite path is provided (e.g., sqlite:///instance/app.db or sqlite:///app.db),
        # normalize it to absolute paths based on the project layout to prevent path drift bugs.
        if env_db_url.startswith("sqlite:///"):
            db_path_part = env_db_url.replace("sqlite:///", "", 1)
            if not os.path.isabs(db_path_part):
                # If path contains instance folder reference or relative file name
                if db_path_part.startswith("instance/"):
                    db_filename = os.path.basename(db_path_part)
                else:
                    db_filename = db_path_part
                absolute_db_path = os.path.join(instance_dir, db_filename)
                app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{absolute_db_path}"
            else:
                app.config["SQLALCHEMY_DATABASE_URI"] = env_db_url
        else:
            app.config["SQLALCHEMY_DATABASE_URI"] = env_db_url
    else:
        db_default_path = f"sqlite:///{os.path.join(instance_dir, 'app.db')}"
        app.config["SQLALCHEMY_DATABASE_URI"] = db_default_path

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    access_minutes = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", 60))
    refresh_days = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 30))
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=access_minutes)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=refresh_days)

    # JWT Setup - Support both Bearer headers (localStorage) and cookies
    app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
    app.config["JWT_COOKIE_SECURE"] = os.getenv("FLASK_ENV") == "production"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = True
    app.config["JWT_ACCESS_COOKIE_PATH"] = "/"
    app.config["JWT_REFRESH_COOKIE_PATH"] = "/auth/refresh"
    app.config["JWT_COOKIE_SAMESITE"] = "Lax"

    # INITIALIZE RATE LIMITER
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://"
    )

    # INITIALIZE LOGGING & MIDDLEWARE
    configure_logging()
    logger = structlog.get_logger()
    logger.info("Initializing Flask application", env=os.getenv("FLASK_ENV", "development"))

    @app.before_request
    def log_request_start():
        g.start_time = time.time()
        if request.path != "/favicon.ico":
            logger.info(
                "Incoming HTTP Request",
                method=request.method,
                path=request.path,
                remote_addr=request.remote_addr,
            )

    @app.after_request
    def log_request_complete(response):
        if request.path == "/favicon.ico":
            return response

        duration = time.time() - getattr(g, "start_time", time.time())

        log_method = logger.info
        if 400 <= response.status_code < 500:
            log_method = logger.warn
        elif response.status_code >= 500:
            log_method = logger.error

        log_method(
            "HTTP Request Completed",
            method=request.method,
            path=request.path,
            status=response.status_code,
            duration_seconds=round(duration, 4),
        )
        return response

    @app.teardown_request
    def log_request_exception(exception=None):
        if exception:
            logger.error("Unhandled exception during request lifecycle", error=str(exception), exc_info=True)

    # GLOBAL ERROR HANDLERS
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": str(e.description) if hasattr(e, 'description') else "Bad request"}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": str(e.description) if hasattr(e, 'description') else "Unauthorized"}), 401

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": str(e.description) if hasattr(e, 'description') else "Not found"}), 404

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({"error": "ratelimit_exceeded", "message": "Too many requests, please try again later."}), 429

    @app.errorhandler(500)
    def internal_server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    # INITIALIZE CORS GLOBALLY
    cors.init_app(
        app,
        supports_credentials=True,
        origins=["http://localhost:5173", "https://the-terrace-group-project-ruddy.vercel.app", "https://the-terrace-group-project.onrender.com"],
        allow_headers=["Content-Type", "Authorization", "X-CSRF-TOKEN"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # INITIALIZE EXTENSIONS WITH APP
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)

    # TOKEN BLOCKLIST LOADER
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        from models import TokenBlocklist
        jti = jwt_payload.get("jti")
        token = db.session.query(TokenBlocklist.id).filter_by(jti=jti).scalar()
        return token is not None

    # REGISTER CUSTOM JWT ERROR HANDLERS
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            "error": "unauthorized",
            "message": "Request is missing a valid authorization token."
        }), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "error": "token_expired",
            "message": "The token has expired. Please refresh your token."
        }), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            "error": "invalid_token",
            "message": "Signature verification failed or token is malformed."
        }), 422

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "error": "token_revoked",
            "message": "This token has been revoked. Please log in again."
        }), 401

    # REGISTER RESTFUL API RESOURCES
    api = Api(app)
    register_routes(api)

    return app


def register_routes(api):
    from resources.auth import (
        RegisterResource,
        LoginResource,
        LogoutResource,
        MeResource,
        RefreshTokenResource
    )
    from resources.users import (
        UsersResource, UserByIDResource, UserFollowResource,
        UserFollowersResource, UserFollowingResource, UserStatsResource
    )
    from resources.categories import CategoriesResource, CategoryByIDResource, CategoryArticlesResource
    from resources.articles import ArticlesResource, ArticleByIDResource, ArticleUpvoteResource, ArticleCommentsResource, UserArticlesResource, NewsResource
    from resources.reactions import ReactionsResource, ArticleReactionsResource, ReactionByIDResource, ReactionUpvoteResource, UserReactionsResource
    from resources.leagues import LeaguesResource, LeagueByIDResource
    from resources.teams import TeamsResource, TeamByIDResource
    from resources.matches import MatchesResource, MatchByIDResource, MatchLiveResource, MatchEventsResource, MatchPredictionsResource
    from resources.predictions import PredictionsResource, PredictionByIDResource, PredictionResolveResource, UserPredictionsResource
    from resources.admin import AdminReportsResource, AdminArticlePublishResource

    # Auth Routes
    api.add_resource(RegisterResource, "/auth/register")
    api.add_resource(LoginResource, "/auth/login")
    api.add_resource(LogoutResource, "/auth/logout")
    api.add_resource(MeResource, "/auth/me")
    api.add_resource(RefreshTokenResource, "/auth/refresh")

    # Users
    api.add_resource(UsersResource, "/users")
    api.add_resource(UserByIDResource, "/users/<int:user_id>")
    api.add_resource(UserFollowResource, "/users/<int:user_id>/follow")
    api.add_resource(UserFollowersResource, "/users/<int:user_id>/followers")
    api.add_resource(UserFollowingResource, "/users/<int:user_id>/following")
    api.add_resource(UserStatsResource, "/users/<int:user_id>/stats")
    api.add_resource(UserArticlesResource, "/users/<int:user_id>/articles")
    api.add_resource(UserPredictionsResource, "/users/<int:user_id>/predictions")
    api.add_resource(UserReactionsResource, "/users/<int:user_id>/reactions")

    # Categories
    api.add_resource(CategoriesResource, "/categories")
    api.add_resource(CategoryByIDResource, "/categories/<int:category_id>")
    api.add_resource(CategoryArticlesResource, "/categories/<int:category_id>/articles")

    # Articles
    api.add_resource(ArticlesResource, "/articles")
    api.add_resource(NewsResource, "/news")
    api.add_resource(ArticleByIDResource, "/articles/<int:article_id>")
    api.add_resource(ArticleUpvoteResource, "/articles/<int:article_id>/upvote")
    api.add_resource(ArticleCommentsResource, "/articles/<int:article_id>/comments")

    # Reactions
    api.add_resource(ReactionsResource, "/reactions")
    api.add_resource(ArticleReactionsResource, "/articles/<int:article_id>/reactions")
    api.add_resource(ReactionByIDResource, "/reactions/<int:reaction_id>")
    api.add_resource(ReactionUpvoteResource, "/reactions/<int:reaction_id>/upvote")

    # Leagues & Teams
    api.add_resource(LeaguesResource, "/leagues")
    api.add_resource(LeagueByIDResource, "/leagues/<int:league_id>")
    api.add_resource(TeamsResource, "/teams")
    api.add_resource(TeamByIDResource, "/teams/<int:team_id>")

    # Matches
    api.add_resource(MatchesResource, "/matches")
    api.add_resource(MatchByIDResource, "/matches/<int:match_id>")
    api.add_resource(MatchLiveResource, "/matches/<int:match_id>/live")
    api.add_resource(MatchEventsResource, "/matches/<int:match_id>/events")
    api.add_resource(MatchPredictionsResource, "/matches/<int:match_id>/predictions")

    # Predictions
    api.add_resource(PredictionsResource, "/predictions")
    api.add_resource(PredictionByIDResource, "/predictions/<int:prediction_id>")
    api.add_resource(PredictionResolveResource, "/predictions/<int:prediction_id>/resolve")

    # Admin
    api.add_resource(AdminReportsResource, "/admin/reports")
    api.add_resource(AdminArticlePublishResource, "/admin/articles/<int:article_id>/publish")


app = create_app()

if __name__ == "__main__":
    is_dev = os.getenv("FLASK_ENV") == "development"
    app.run(port=5555, debug=is_dev)