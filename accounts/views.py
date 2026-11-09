import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.http import (
    require_GET,
    require_POST,
    require_http_methods,
)


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


@require_POST
def register(request):
    data, error_response = parse_json(request)

    if error_response:
        return error_response

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not username or not email or not password:
        return JsonResponse(
            {"error": "Username, email, and password are required."},
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

    if User.objects.filter(username=username).exists():
        return JsonResponse(
            {"error": "Username already exists."},
            status=409,
        )

    if User.objects.filter(email=email).exists():
        return JsonResponse(
            {"error": "Email already exists."},
            status=409,
        )

    try:
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )
    except IntegrityError:
        return JsonResponse(
            {"error": "Account could not be created."},
            status=400,
        )

    return JsonResponse(
        {
            "message": "Account created successfully.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
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

    user = authenticate(
        request,
        username=username,
        password=password,
    )

    if user is None:
        return JsonResponse(
            {"error": "Invalid username or password."},
            status=401,
        )

    login(request, user)

    return JsonResponse(
        {
            "message": "Login successful.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        },
        status=200,
    )


@require_POST
def user_logout(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "You must be logged in to log out."},
            status=401,
        )

    logout(request)

    return JsonResponse(
        {"message": "Logout successful."},
        status=200,
    )


@require_GET
def user_profile(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Authentication required."},
            status=401,
        )

    return JsonResponse(
        {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
        },
        status=200,
    )


@require_http_methods(["PUT"])
def update_profile(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Authentication required."},
            status=401,
        )

    data, error_response = parse_json(request)

    if error_response:
        return error_response

    username = data.get("username", request.user.username).strip()
    email = data.get("email", request.user.email).strip()

    if not username or not email:
        return JsonResponse(
            {"error": "Username and email cannot be empty."},
            status=400,
        )

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse(
            {"error": "Invalid email address."},
            status=400,
        )

    if User.objects.filter(username=username).exclude(
        id=request.user.id
    ).exists():
        return JsonResponse(
            {"error": "Username already exists."},
            status=409,
        )

    if User.objects.filter(email=email).exclude(
        id=request.user.id
    ).exists():
        return JsonResponse(
            {"error": "Email already exists."},
            status=409,
        )

    request.user.username = username
    request.user.email = email
    request.user.save()

    return JsonResponse(
        {
            "message": "Profile updated successfully.",
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
            },
        },
        status=200,
    )