import json

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from accounts import users
from . import mongo


def parse_json(request):
    """Parse JSON request data and ensure it is an object."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return None, JsonResponse({"error": "Invalid JSON."}, status=400)

    if not isinstance(data, dict):
        return None, JsonResponse({"error": "JSON must be an object."}, status=400)

    return data, None


def serialize_creation(creation):
    """Convert a MongoDB creation into a JSON-safe response."""
    return {
        "id": str(creation["_id"]),
        "title": creation["title"],
        "description": creation["description"],
        "simulation_data": creation["simulation_data"],
        "created_at": creation["created_at"].isoformat(),
        "moderation_status": creation["moderation_status"],
    }

@require_POST
def create_creation(request):
    user = users.current_user(request)

    if user is None:
        return JsonResponse({"error": "Authentication required."}, status=401)

    data, error_response = parse_json(request)

    if error_response:
        return error_response

    title = data.get("title")
    description = data.get("description", "")
    simulation_data = data.get("simulation_data")

    if title is None or simulation_data is None:
        return JsonResponse(
            {"error": "Title and simulation_data are required."},
            status=400,
        )

    try:
        creation = mongo.create_creation(
            user_id=str(user["_id"]),
            title=title,
            simulation_data=simulation_data,
            description=description,
        )
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)

    return JsonResponse(serialize_creation(creation), status=201)

@require_GET
def list_creations(request):
    creations = mongo.get_public_creations()

    return JsonResponse(
        {"creations": [serialize_creation(creation) for creation in creations]},
        status=200,
    )

@require_GET
def my_creations(request):
    user = users.current_user(request)

    if user is None:
        return JsonResponse({"error": "Authentication required."}, status=401)

    creations = mongo.get_user_creations(str(user["_id"]))

    return JsonResponse(
        {"creations": [serialize_creation(creation) for creation in creations]},
        status=200,
    )

@require_GET
def creation_detail(request, creation_id):
    creation = mongo.get_creation(creation_id)

    if creation is None:
        return JsonResponse({"error": "Creation not found."}, status=404)

    user = users.current_user(request)

    is_owner = user is not None and str(user["_id"]) == str(creation["user_id"])

    if creation["moderation_status"] != "approved" and not is_owner:
        return JsonResponse({"error": "Creation not found."}, status=404)

    return JsonResponse(serialize_creation(creation), status=200)