from datetime import datetime
from flask_bcrypt import Bcrypt

try:
    from server.extensions import db
except ImportError:
    from extensions import db

bcrypt = Bcrypt()


class TokenBlocklist(db.Model):
    __tablename__ = "token_blocklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(20), nullable=False)
    last_name = db.Column(db.String(20), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(
        db.String(128), nullable=False
    )  # Stores the hashed password
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    profile = db.relationship(
        "Profile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    articles = db.relationship(
        "Article", back_populates="author", cascade="all, delete-orphan"
    )
    reactions = db.relationship(
        "Reaction", back_populates="user", cascade="all, delete-orphan"
    )
    followed_categories = db.relationship(
        "Category", secondary="follows", back_populates="followers"
    )
    comments = db.relationship(
        "Comment", back_populates="user", cascade="all, delete-orphan"
    )
    predictions = db.relationship(
        "Prediction", back_populates="user", cascade="all, delete-orphan"
    )

    # PASSWORD HASHING METHODS
    def set_password(self, password):
        """Hashes the plain text password before saving."""
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        """Verifies plain text password against stored hash."""
        return bcrypt.check_password_hash(self.password_hash, password)


class Profile(db.Model):
    __tablename__ = "profile"

    id = db.Column(db.Integer, primary_key=True)
    gender = db.Column(db.String(50), nullable=False)
    profile_pic = db.Column(db.String(200), default="https://placeholder.com")
    bio = db.Column(db.String(400), nullable=False)
    role = db.Column(db.String(10), nullable=False, default="user")
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.user_id"), unique=True, nullable=False
    )

    user = db.relationship("User", back_populates="profile")

    __table_args__ = (
        db.Index("idx_profile_user_id", "user_id"),
    )


class Article(db.Model):
    __tablename__ = "articles"

    article_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False, unique=True)
    content = db.Column(db.String(2000), nullable=False)
    cover_image = db.Column(db.String(500), default="https://placeholder.com")
    view_count = db.Column(db.Integer, default=0, nullable=False)
    likes_count = db.Column(db.Integer, default=0, nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.category_id"), nullable=False
    )
    status = db.Column(
        db.Enum("PENDING", "PUBLISHED", "REJECTED", name="article_status"),
        nullable=False,
        default="PENDING",
    )
    rejection_reason = db.Column(db.String(500), nullable=True)
    published_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    external_url = db.Column(db.String(500), unique=True, nullable=True)
    source_name = db.Column(db.String(100), nullable=True)

    author = db.relationship("User", back_populates="articles")
    category = db.relationship("Category", back_populates="articles")
    reactions = db.relationship(
        "Reaction", back_populates="article", cascade="all, delete-orphan"
    )
    comments = db.relationship(
        "Comment", back_populates="article", cascade="all, delete-orphan"
    )

    __table_args__ = (
        db.Index("idx_articles_author_id", "author_id"),
        db.Index("idx_articles_category_id", "category_id"),
    )


class Comment(db.Model):
    __tablename__ = "comments"

    comment_id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(1000), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    article_id = db.Column(
        db.Integer, db.ForeignKey("articles.article_id"), nullable=False
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = db.relationship("User", back_populates="comments")
    article = db.relationship("Article", back_populates="comments")

    __table_args__ = (
        db.Index("idx_comments_user_id", "user_id"),
        db.Index("idx_comments_article_id", "article_id"),
    )


class Category(db.Model):
    __tablename__ = "categories"

    category_id = db.Column(db.Integer, primary_key=True)
    category_name = db.Column(db.String(100), nullable=False, unique=True)
    icon = db.Column(db.String(50), nullable=True)
    description = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    articles = db.relationship(
        "Article", back_populates="category", cascade="all, delete-orphan"
    )
    followers = db.relationship(
        "User", secondary="follows", back_populates="followed_categories"
    )


class Reaction(db.Model):
    __tablename__ = "reactions"

    reaction_id = db.Column(db.Integer, primary_key=True)
    body = db.Column(db.String(1000), nullable=False)
    reaction_type = db.Column(db.String(30), nullable=False)
    upvotes = db.Column(db.Integer, default=0, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    article_id = db.Column(
        db.Integer, db.ForeignKey("articles.article_id"), nullable=False
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="reactions")
    article = db.relationship("Article", back_populates="reactions")

    __table_args__ = (
        db.Index("idx_reactions_user_id", "user_id"),
        db.Index("idx_reactions_article_id", "article_id"),
    )


class Follow(db.Model):
    __tablename__ = "follows"

    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), primary_key=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.category_id"), primary_key=True
    )

    __table_args__ = (
        db.Index("idx_follows_user_id", "user_id"),
        db.Index("idx_follows_category_id", "category_id"),
    )


class Bookmark(db.Model):
    __tablename__ = "bookmarks"

    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), primary_key=True)
    article_id = db.Column(
        db.Integer, db.ForeignKey("articles.article_id"), primary_key=True
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="bookmarks")
    article = db.relationship("Article", backref="bookmarked_by")

    __table_args__ = (
        db.Index("idx_bookmarks_user_id", "user_id"),
        db.Index("idx_bookmarks_article_id", "article_id"),
    )


class League(db.Model):
    __tablename__ = "leagues"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    country = db.Column(db.String(100), nullable=False)
    logo_url = db.Column(db.String(255), nullable=True)
    external_id = db.Column(db.Integer, unique=True, nullable=True)  # football-data.org competition ID

    teams = db.relationship(
        "Team", back_populates="league", cascade="all, delete-orphan"
    )
    matches = db.relationship(
        "Match", back_populates="league", cascade="all, delete-orphan"
    )


class Team(db.Model):
    __tablename__ = "teams"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    short_code = db.Column(db.String(10), nullable=False)
    logo_url = db.Column(db.String(255), nullable=True)
    league_id = db.Column(db.Integer, db.ForeignKey("leagues.id"), nullable=False)
    external_id = db.Column(db.Integer, unique=True, nullable=True)  # football-data.org team ID

    league = db.relationship("League", back_populates="teams")
    home_matches = db.relationship(
        "Match", foreign_keys="Match.home_team_id", back_populates="home_team"
    )
    away_matches = db.relationship(
        "Match", foreign_keys="Match.away_team_id", back_populates="away_team"
    )

    __table_args__ = (
        db.Index("idx_teams_league_id", "league_id"),
    )


class Match(db.Model):
    __tablename__ = "matches"

    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey("leagues.id"), nullable=False)
    home_team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=False)
    away_team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    status = db.Column(
        db.Enum("UPCOMING", "LIVE", "FINISHED", name="match_status"),
        nullable=False,
        default="UPCOMING",
    )
    home_score = db.Column(db.Integer, nullable=True)
    away_score = db.Column(db.Integer, nullable=True)
    minute = db.Column(db.String(10), nullable=True)
    external_id = db.Column(db.Integer, unique=True, nullable=True)  # football-data.org match ID

    league = db.relationship("League", back_populates="matches")
    home_team = db.relationship(
        "Team", foreign_keys=[home_team_id], back_populates="home_matches"
    )
    away_team = db.relationship(
        "Team", foreign_keys=[away_team_id], back_populates="away_matches"
    )
    predictions = db.relationship(
        "Prediction", back_populates="match", cascade="all, delete-orphan"
    )

    __table_args__ = (
        db.Index("idx_matches_league_id", "league_id"),
        db.Index("idx_matches_home_team_id", "home_team_id"),
        db.Index("idx_matches_away_team_id", "away_team_id"),
    )


class Prediction(db.Model):
    __tablename__ = "predictions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    match_id = db.Column(db.Integer, db.ForeignKey("matches.id"), nullable=False)
    predicted_home_score = db.Column(db.Integer, nullable=False)
    predicted_away_score = db.Column(db.Integer, nullable=False)
    status = db.Column(
        db.Enum("PENDING", "CORRECT", "INCORRECT", name="prediction_status"),
        nullable=False,
        default="PENDING",
    )
    points_awarded = db.Column(db.Integer, default=0, nullable=False)

    user = db.relationship("User", back_populates="predictions")
    match = db.relationship("Match", back_populates="predictions")

    __table_args__ = (
        db.Index("idx_predictions_user_id", "user_id"),
        db.Index("idx_predictions_match_id", "match_id"),
    )