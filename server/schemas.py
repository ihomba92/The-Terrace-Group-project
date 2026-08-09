from marshmallow import Schema, fields, ValidationError, validates_schema

# 0. AUTHENTICATION SCHEMAS


class LoginSchema(Schema):
    """Payload schema for POST /auth/login"""

    email = fields.Email(required=True)
    password = fields.Str(required=True)


class RegisterSchema(Schema):
    """Payload schema for POST /auth/register"""

    first_name = fields.Str(required=True)
    last_name = fields.Str(required=True)
    username = fields.Str(required=True)
    email = fields.Email(required=True)
    password = fields.Str(required=True)
    role = fields.Str(dump_default="user")
    # Optional — if a valid invite code is supplied, RegisterResource assigns
    # the role from the invite instead of defaulting to "user". This field
    # itself carries no elevated trust; the schema just accepts the string.
    invite_code = fields.Str(required=False, allow_none=True)

    @validates_schema
    def validate_register(self, data, **kwargs):
        errors = {}
        if "first_name" in data and len(data["first_name"]) > 20:
            errors["first_name"] = ["First name cannot exceed 20 characters"]
        if "last_name" in data and len(data["last_name"]) > 20:
            errors["last_name"] = ["Last name cannot exceed 20 characters"]
        if "username" in data and len(data["username"]) > 50:
            errors["username"] = ["Username cannot exceed 50 characters"]
        if "password" in data and not (6 <= len(data["password"]) <= 255):
            errors["password"] = [
                "Password length must be between 6 and 255 characters"
            ]
        if "role" in data and data["role"] not in ["admin", "author", "user"]:
            errors["role"] = ["Role must be one of: admin, author, user"]
        if errors:
            raise ValidationError(errors)


login_schema = LoginSchema()
register_schema = RegisterSchema()


# 1. PROFILE SCHEMAS


class ProfileSchema(Schema):
    id = fields.Int(dump_only=True)
    gender = fields.Str(required=True)
    bio = fields.Str(required=True)
    profile_pic = fields.Str(dump_default="https://placeholder.com")
    role = fields.Str(dump_default="user")

    # Relationship
    user = fields.Nested("UserSchema", exclude=("profile",))

    @validates_schema
    def validate_schema(self, data, **kwargs):
        errors = {}
        if "bio" in data and len(data["bio"]) > 400:
            errors["bio"] = ["Bio cannot exceed 400 characters"]
        if "role" in data and data["role"] not in ["admin", "author", "user"]:
            errors["role"] = ["Role must be one of: admin, author, user"]
        if errors:
            raise ValidationError(errors)


profile_schema = ProfileSchema()
profiles_schema = ProfileSchema(many=True)


# 2. USER SCHEMAS


class UserSchema(Schema):
    # Maps user_id primary key from model while serializing as 'id'
    id = fields.Int(attribute="user_id", dump_only=True)
    first_name = fields.Str(required=True)
    last_name = fields.Str(required=True)
    username = fields.Str(required=True)
    email = fields.Email(required=True)
    password = fields.Str(load_only=True, required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    # Relationships
    profile = fields.Nested(ProfileSchema, exclude=("user",))
    articles = fields.List(fields.Nested("ArticleSchema", exclude=("author",)))
    comments = fields.List(fields.Nested("CommentSchema", exclude=("user", "article")))
    predictions = fields.List(fields.Nested("PredictionSchema", exclude=("user",)))

    @validates_schema
    def validate_schema(self, data, **kwargs):
        errors = {}
        if "first_name" in data and len(data["first_name"]) > 20:
            errors["first_name"] = ["First name cannot exceed 20 characters"]
        if "last_name" in data and len(data["last_name"]) > 20:
            errors["last_name"] = ["Last name cannot exceed 20 characters"]
        if "username" in data and len(data["username"]) > 50:
            errors["username"] = ["Username cannot exceed 50 characters"]
        if "password" in data and not (6 <= len(data["password"]) <= 255):
            errors["password"] = [
                "Password length must be between 6 and 255 characters"
            ]
        if errors:
            raise ValidationError(errors)


user_schema = UserSchema()
users_schema = UserSchema(many=True)


# 3. CATEGORY SCHEMAS


class CategorySchema(Schema):
    id = fields.Int(attribute="category_id", dump_only=True)
    category_name = fields.Str(required=True)
    icon = fields.Str()
    description = fields.Str()

    # Relationships
    articles = fields.List(fields.Nested("ArticleSchema", exclude=("category",)))

    @validates_schema
    def validate_schema(self, data, **kwargs):
        errors = {}
        if "category_name" in data and len(data["category_name"]) > 100:
            errors["category_name"] = ["Category name cannot exceed 100 characters"]
        if "icon" in data and len(data["icon"]) > 50:
            errors["icon"] = ["Icon path/name cannot exceed 50 characters"]
        if "description" in data and len(data["description"]) > 500:
            errors["description"] = ["Description cannot exceed 500 characters"]
        if errors:
            raise ValidationError(errors)


category_schema = CategorySchema()
categories_schema = CategorySchema(many=True)


# 4. ARTICLE SCHEMAS


class ArticleSchema(Schema):
    id = fields.Int(attribute="article_id", dump_only=True)
    title = fields.Str(required=True)
    content = fields.Str(required=True)
    cover_image = fields.Str(dump_default="https://placeholder.com")
    view_count = fields.Int(dump_only=True)
    likes_count = fields.Int(dump_only=True)
    status = fields.Str(dump_default="PENDING")  # writable — PostArticle needs to set this on resubmit
    rejection_reason = fields.Str(allow_none=True, dump_only=True)  # admin sets this via its own endpoint, not through this schema
    published_at = fields.DateTime(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    # Relationships & Foreign Keys
    author_id = fields.Int(dump_only=True)
    category_id = fields.Int(required=True)
    author = fields.Nested(
        UserSchema, only=("id", "username", "first_name", "last_name"), dump_only=True
    )
    category = fields.Nested(
        CategorySchema, only=("id", "category_name"), dump_only=True
    )
    comments = fields.List(fields.Nested("CommentSchema", exclude=("article",)), dump_only=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        errors = {}
        if "title" in data and len(data["title"]) > 100:
            errors["title"] = ["Title cannot exceed 100 characters"]
        if "content" in data and len(data["content"]) > 2000:
            errors["content"] = ["Content cannot exceed 2000 characters"]
        if "status" in data and data["status"] not in ["PENDING", "PUBLISHED", "REJECTED"]:
            errors["status"] = ["Status must be one of: PENDING, PUBLISHED, REJECTED"]
        if errors:
            raise ValidationError(errors)


article_schema = ArticleSchema()
articles_schema = ArticleSchema(many=True)


# 5. REACTION SCHEMAS


class ReactionSchema(Schema):
    id = fields.Int(attribute="reaction_id", dump_only=True)
    body = fields.Str(required=True)
    reaction_type = fields.Str(required=True)

    # Foreign Keys & Relationships
    # user_id is dump_only because user identity is extracted from JWT in Resource methods
    user_id = fields.Int(dump_only=True)
    article_id = fields.Int(required=True)
    article = fields.Nested("ArticleSchema", exclude=("comments",), dump_only=True)
    user = fields.Nested(UserSchema, only=("id", "username"), dump_only=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        errors = {}
        if "body" in data and len(data["body"]) > 1000:
            errors["body"] = ["Reaction text cannot exceed 1000 characters"]
        if "reaction_type" in data and len(data["reaction_type"]) > 30:
            errors["reaction_type"] = ["Reaction type cannot exceed 30 characters"]
        if errors:
            raise ValidationError(errors)


reaction_schema = ReactionSchema()
reactions_schema = ReactionSchema(many=True)


# 6. COMMENT SCHEMAS


class CommentSchema(Schema):
    id = fields.Int(attribute="comment_id", dump_only=True)
    content = fields.Str(required=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    # Foreign Keys & Relationships
    # user_id is dump_only because user identity is extracted from JWT in Resource methods
    user_id = fields.Int(dump_only=True)
    article_id = fields.Int(required=True)
    article = fields.Nested("ArticleSchema", exclude=("comments",), dump_only=True)
    user = fields.Nested(UserSchema, only=("id", "username"), dump_only=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        errors = {}
        if "content" in data and len(data["content"]) > 1000:
            errors["content"] = ["Comment content cannot exceed 1000 characters"]
        if errors:
            raise ValidationError(errors)


comment_schema = CommentSchema()
comments_schema = CommentSchema(many=True)


# 7. FOLLOW SCHEMAS


class FollowSchema(Schema):
    user_id = fields.Int(dump_only=True)
    category_id = fields.Int(required=True)

    user = fields.Nested(UserSchema, only=("id", "username"), dump_only=True)
    category = fields.Nested(
        CategorySchema, only=("id", "category_name"), dump_only=True
    )


follow_schema = FollowSchema()
follows_schema = FollowSchema(many=True)


# 8. SPORTS DOMAIN SCHEMAS


class LeagueSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    country = fields.Str(required=True)
    logo_url = fields.Str(allow_none=True)

    teams = fields.List(fields.Nested("TeamSchema", exclude=("league",)))
    matches = fields.List(fields.Nested("MatchSchema", exclude=("league",)))


league_schema = LeagueSchema()
leagues_schema = LeagueSchema(many=True)


class TeamSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    short_code = fields.Str(required=True)
    logo_url = fields.Str(allow_none=True)
    league_id = fields.Int(required=True)

    league = fields.Nested(LeagueSchema, only=("id", "name", "country"), dump_only=True)


team_schema = TeamSchema()
teams_schema = TeamSchema(many=True)


class MatchSchema(Schema):
    id = fields.Int(dump_only=True)
    league_id = fields.Int(required=True)
    home_team_id = fields.Int(required=True)
    away_team_id = fields.Int(required=True)
    start_time = fields.DateTime(required=True)
    status = fields.Str(dump_default="UPCOMING")
    home_score = fields.Int(allow_none=True)
    away_score = fields.Int(allow_none=True)
    minute = fields.Str(allow_none=True)

    league = fields.Nested(LeagueSchema, only=("id", "name"), dump_only=True)
    home_team = fields.Nested(
        TeamSchema, only=("id", "name", "short_code"), dump_only=True
    )
    away_team = fields.Nested(
        TeamSchema, only=("id", "name", "short_code"), dump_only=True
    )


match_schema = MatchSchema()
matches_schema = MatchSchema(many=True)


class PredictionSchema(Schema):
    id = fields.Int(dump_only=True)
    # user_id is dump_only because user identity is extracted from JWT in Resource methods
    user_id = fields.Int(dump_only=True)
    match_id = fields.Int(required=True)
    predicted_home_score = fields.Int(required=True)
    predicted_away_score = fields.Int(required=True)
    status = fields.Str(dump_default="PENDING")
    points_awarded = fields.Int(dump_default=0)

    user = fields.Nested(UserSchema, only=("id", "username"), dump_only=True)
    match = fields.Nested(
        MatchSchema, only=("id", "start_time", "status"), dump_only=True
    )


prediction_schema = PredictionSchema()
predictions_schema = PredictionSchema(many=True)


# 9. INVITE SCHEMAS


class InviteSchema(Schema):
      id = fields.Int(dump_only=True)
      code = fields.Str(dump_only=True)
      role = fields.Str(required=True)
      email = fields.Email(allow_none=True)
      expires_in_days = fields.Int(load_only=True, required=False)
      created_by_id = fields.Int(dump_only=True)
      used_by_id = fields.Int(dump_only=True, allow_none=True)
      used_at = fields.DateTime(dump_only=True, allow_none=True)
      expires_at = fields.DateTime(dump_only=True)
      created_at = fields.DateTime(dump_only=True)

      created_by = fields.Nested(UserSchema, only=("id", "username"), dump_only=True)
      used_by = fields.Nested(UserSchema, only=("id", "username"), dump_only=True)

      @validates_schema
      def validate_role(self, data, **kwargs):
          if "role" in data and data["role"] not in ["admin", "author"]:
              raise ValidationError({"role": ["Role must be admin or author"]})

invite_schema = InviteSchema()
invites_schema = InviteSchema(many=True)