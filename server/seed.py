from datetime import datetime, timedelta

from flask_bcrypt import Bcrypt

from app import create_app
from extensions import db
from models import (
    Article,
    Category,
    Comment,
    Follow,
    League,
    Match,
    Prediction,
    Profile,
    Reaction,
    Team,
    User,
)

bcrypt = Bcrypt()
app = create_app()

with app.app_context():
    print("🌱 Clearing existing data...")
    Prediction.query.delete()
    Reaction.query.delete()
    Comment.query.delete()
    Article.query.delete()
    Profile.query.delete()
    Follow.query.delete()
    User.query.delete()
    Match.query.delete()
    Team.query.delete()
    League.query.delete()
    Category.query.delete()
    db.session.commit()

    print("⚽ Seeding Leagues and Teams...")
    epl = League(
        name="English Premier League",
        country="England",
        logo_url="https://placeholder.com/epl.png",
    )
    laliga = League(
        name="La Liga", country="Spain", logo_url="https://placeholder.com/laliga.png"
    )
    db.session.add_all([epl, laliga])
    db.session.commit()

    arsenal = Team(
        name="Arsenal",
        short_code="ARS",
        logo_url="https://placeholder.com/ars.png",
        league_id=epl.id,
    )
    chelsea = Team(
        name="Chelsea",
        short_code="CHE",
        logo_url="https://placeholder.com/che.png",
        league_id=epl.id,
    )
    real_madrid = Team(
        name="Real Madrid",
        short_code="RMA",
        logo_url="https://placeholder.com/rma.png",
        league_id=laliga.id,
    )
    barcelona = Team(
        name="Barcelona",
        short_code="BAR",
        logo_url="https://placeholder.com/bar.png",
        league_id=laliga.id,
    )
    db.session.add_all([arsenal, chelsea, real_madrid, barcelona])
    db.session.commit()

    print("📅 Seeding Matches...")
    match1 = Match(
        league_id=epl.id,
        home_team_id=arsenal.id,
        away_team_id=chelsea.id,
        start_time=datetime.utcnow() - timedelta(days=1),
        status="FINISHED",
        home_score=2,
        away_score=1,
        minute="90'",
    )
    match2 = Match(
        league_id=laliga.id,
        home_team_id=real_madrid.id,
        away_team_id=barcelona.id,
        start_time=datetime.utcnow() + timedelta(days=2),
        status="UPCOMING",
        home_score=None,
        away_score=None,
        minute=None,
    )
    db.session.add_all([match1, match2])
    db.session.commit()

    print("👤 Seeding Users & Profiles...")
    default_password_hash = bcrypt.generate_password_hash("password123").decode("utf-8")

    user1 = User(
        first_name="Jadyn",
        last_name="Wanja",
        username="jadyn_w",
        email="jadyn@theterrace.com",
        password_hash=default_password_hash,
    )
    user2 = User(
        first_name="Frank",
        last_name="Wanyeki",
        username="frank_w",
        email="frank@theterrace.com",
        password_hash=default_password_hash,
    )
    user3 = User(
        first_name="Emmanuel",
        last_name="Pneuma",
        username="emmanuel_p",
        email="emmanuel@theterrace.com",
        password_hash=default_password_hash,
    )
    db.session.add_all([user1, user2, user3])
    db.session.commit()

    profile1 = Profile(
        gender="Female",
        bio="Football analyst and die-hard Arsenal fan.",
        role="admin",
        user_id=user1.user_id,
    )
    profile2 = Profile(
        gender="Male",
        bio="La Liga enthusiast and tactical writer.",
        role="author",
        user_id=user2.user_id,
    )
    profile3 = Profile(
        gender="Male",
        bio="Casual sports fan and match predictor.",
        role="user",
        user_id=user3.user_id,
    )
    db.session.add_all([profile1, profile2, profile3])
    db.session.commit()

    print("🏷️ Seeding Categories...")
    cat_tactics = Category(
        category_name="Tactics & Analysis",
        icon="fa-chart-line",
        description="Deep dive into team structures and game plans.",
    )
    cat_transfers = Category(
        category_name="Transfer News",
        icon="fa-exchange-alt",
        description="Latest updates on player movements.",
    )
    db.session.add_all([cat_tactics, cat_transfers])
    db.session.commit()

    user1.followed_categories.append(cat_tactics)
    user2.followed_categories.append(cat_transfers)
    db.session.commit()

    print("📰 Seeding Articles, Comments & Reactions...")
    article1 = Article(
        title="Title Race Intensifies in the Premier League",
        content="Arsenal displayed remarkable composure in their recent fixture against Chelsea, securing a vital win...",
        view_count=142,
        likes_count=15,
        author_id=user1.user_id,
        category_id=cat_tactics.category_id,
        published_at=datetime.utcnow() - timedelta(hours=12),
    )
    db.session.add(article1)
    db.session.commit()

    comment1 = Comment(
        content="Fantastic analysis! The midfield block made all the difference.",
        user_id=user2.user_id,
        article_id=article1.article_id,
    )
    reaction1 = Reaction(
        body="Spot on!",
        reaction_type="LIKE",
        user_id=user3.user_id,
        article_id=article1.article_id,
    )
    db.session.add_all([comment1, reaction1])
    db.session.commit()

    print("🎯 Seeding Match Predictions...")
    pred1 = Prediction(
        user_id=user1.user_id,
        match_id=match1.id,
        predicted_home_score=2,
        predicted_away_score=1,
        status="CORRECT",
        points_awarded=3,
    )
    pred2 = Prediction(
        user_id=user2.user_id,
        match_id=match2.id,
        predicted_home_score=1,
        predicted_away_score=1,
        status="PENDING",
        points_awarded=0,
    )
    db.session.add_all([pred1, pred2])
    db.session.commit()

    print("✅ Database successfully seeded!")