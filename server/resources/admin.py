from flask_restful import Resource
from auth_utils import role_required

class AdminReportsResource(Resource):
    @role_required(["admin"])
    def get(self):
        # Only users with role='admin' can reach this
        return {"reports": []}, 200

class AdminArticlePublishResource(Resource):
    @role_required(["admin"])
    def patch(self, article_id):
        # Admins can publish articles
        return {"message": f"Article {article_id} published successfully"}, 200