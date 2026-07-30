from flask_restful import Resource
from flask import make_response
from datetime import datetime
from auth_utils import role_required
from models import db, Article, User, Comment, Reaction, Prediction, Match, Category
from schemas import article_schema

class AdminReportsResource(Resource):
    @role_required(["admin"])
    def get(self):
        total_users = User.query.count()
        total_articles = Article.query.count()
        published_articles = Article.query.filter(Article.published_at.isnot(None)).count()
        pending_articles = total_articles - published_articles
        total_comments = Comment.query.count()
        total_reactions = Reaction.query.count()
        total_categories = Category.query.count()

        total_predictions = Prediction.query.count()
        correct_predictions = Prediction.query.filter_by(status="CORRECT").count()
        incorrect_predictions = Prediction.query.filter_by(status="INCORRECT").count()
        pending_predictions = Prediction.query.filter_by(status="PENDING").count()
        resolved_predictions = correct_predictions + incorrect_predictions
        accuracy_rate = (correct_predictions / resolved_predictions * 100) if resolved_predictions > 0 else 0.0

        upcoming_matches = Match.query.filter_by(status="UPCOMING").count()
        live_matches = Match.query.filter_by(status="LIVE").count()
        finished_matches = Match.query.filter_by(status="FINISHED").count()

        top_articles = Article.query.filter(Article.published_at.isnot(None)).order_by(Article.view_count.desc()).limit(5).all()
        top_articles_data = [
            {
                "id": a.article_id,
                "title": a.title,
                "views": a.view_count,
                "likes": a.likes_count,
            }
            for a in top_articles
        ]

        return make_response({
            "reports": {
                "users": {
                    "total": total_users,
                },
                "articles": {
                    "total": total_articles,
                    "published": published_articles,
                    "pending": pending_articles,
                    "top_articles": top_articles_data,
                },
                "comments": {
                    "total": total_comments,
                },
                "reactions": {
                    "total": total_reactions,
                },
                "categories": {
                    "total": total_categories,
                },
                "predictions": {
                    "total": total_predictions,
                    "correct": correct_predictions,
                    "incorrect": incorrect_predictions,
                    "pending": pending_predictions,
                    "accuracy_rate": round(accuracy_rate, 2),
                },
                "matches": {
                    "upcoming": upcoming_matches,
                    "live": live_matches,
                    "finished": finished_matches,
                },
            }
        }, 200)

class AdminArticlePublishResource(Resource):
    @role_required(["admin"])
    def patch(self, article_id):
        article = Article.query.get(article_id)
        if not article:
            return make_response({"status": 404, "message": "Article not found"}, 404)

        article.published_at = datetime.utcnow()
        db.session.commit()

        return make_response({
            "message": f"Article {article_id} published successfully",
            "article": article_schema.dump(article),
        }, 200)