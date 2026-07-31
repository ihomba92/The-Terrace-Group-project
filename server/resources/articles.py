from flask import make_response, request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
import bleach
import os
import requests

from models import db, Article, User, Category, Comment
from schemas import article_schema, articles_schema, comments_schema, comment_schema
from auth_utils import role_required

# Standard logging fallback
try:
    from extensions import log
except ImportError:
    import logging

    log = logging.getLogger(__name__)


# /articles
class ArticlesResource(Resource):
    # GET /articles - Public: Fetch all articles with pagination and optional category filter
    def get(self):
        category_id = request.args.get("category_id")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)

        query = Article.query

        if category_id:
            query = query.filter_by(category_id=category_id)

        # Utilize Flask-SQLAlchemy built-in pagination
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        articles = pagination.items

        log.info(f"get_all_articles count={len(articles)} page={page} per_page={per_page}")
        
        # Return structured metadata alongside items
        return make_response({
            "articles": articles_schema.dump(articles),
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": per_page,
            "has_next": pagination.has_next,