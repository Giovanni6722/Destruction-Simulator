import json

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, validate_email
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import (
    require_GET,
    require_POST,
    require_http_methods,
)
from pymongo.errors import DuplicateKeyError

from . import users


def parse_json(request):
    """Parse JSON request data and ensure it is an object."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return None, JsonResponse(
            {"error": "Invalid JSON."},
            status=400,
        )

    if not isinstance(data, dict):
        return None, JsonResponse(
            {"error": "JSON must be an object."},
            status=400,
        )

    return data, None


USERNAME_MAX_LENGTH = 25


def validate_username(username):
    """Check the app's username length limit and Django's username character rules."""
    MaxLengthValidator(USERNAME_MAX_LENGTH)(username)
    UnicodeUsernameValidator()(username)


def duplicate_response(email, exclude_id=None):
    """Build the 409 for a unique-index violation on username or email."""
    field = "Email" if users.email_taken(email, exclude_id) else "Username"
    return JsonResponse({"error": f"{field} already exists."}, status=409)


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    """Return a CSRF token for frontend requests."""
    return JsonResponse({"csrfToken": get_token(request)})


@require_POST
def register(request):
    data, error_response = parse_json(request)
    if error_response:
        return error_response

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return JsonResponse(
            {"error": "Username, email, and password are required."},
            status=400,
        )

    try:
        validate_username(username)
    except ValidationError as error:
        return JsonResponse(
            {"error": error.messages},
            status=400,
        )

    try:
        candidate_user = User(username=username, email=email)
        validate_password(password, user=candidate_user)
    except ValidationError as error:
        return JsonResponse(
            {"error": error.messages},
            status=400,
        )

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse(
            {"error": "Invalid email address."},
            status=400,
        )

    try:
        user = users.create_user(username, email, password)
    except DuplicateKeyError:
        return duplicate_response(email)

    return JsonResponse(
        {
            "message": "Account created successfully.",
            "user": users.to_public(user),
        },
        status=201,
    )


@require_POST
def user_login(request):
    data, error_response = parse_json(request)
    if error_response:
        return error_response

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return JsonResponse(
            {"error": "Username and password are required."},
            status=400,
        )

    user = users.authenticate(username, password)

    if user is None:
        return JsonResponse(
            {"error": "Invalid username or password."},
            status=401,
        )

    users.login(request, user)

    return JsonResponse(
        {
            "message": "Login successful.",
            "user": users.to_public(user),
        },
        status=200,
    )


@require_POST
def user_logout(request):
    if users.current_user(request) is None:
        return JsonResponse(
            {"error": "You must be logged in to log out."},
            status=401,
        )

    users.logout(request)
    return JsonResponse({"message": "Logout successful."}, status=200)


@require_GET
def user_profile(request):
    user = users.current_user(request)
    if user is None:
        return JsonResponse(
            {"error": "Authentication required."},
            status=401,
        )

    return JsonResponse(users.to_public(user), status=200)


@require_http_methods(["PUT"])
def update_profile(request):
    user = users.current_user(request)
    if user is None:
        return JsonResponse(
            {"error": "Authentication required."},
            status=401,
        )

    data, error_response = parse_json(request)
    if error_response:
        return error_response

    username = data.get("username", user["username"]).strip()
    email = data.get("email", user["email"]).strip().lower()

    if not username or not email:
        return JsonResponse(
            {"error": "Username and email cannot be empty."},
            status=400,
        )

    try:
        validate_username(username)
    except ValidationError as error:
        return JsonResponse(
            {"error": error.messages},
            status=400,
        )

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse(
            {"error": "Invalid email address."},
            status=400,
        )

    try:
        user = users.update_user(user, username, email)
    except DuplicateKeyError:
        return duplicate_response(email, exclude_id=user["_id"])

    return JsonResponse(
        {
            "message": "Profile updated successfully.",
            "user": users.to_public(user),
        },
        status=200,
    )