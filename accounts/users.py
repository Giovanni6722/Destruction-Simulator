"""User storage in MongoDB, with session helpers.

Passwords are hashed with Django's configured hashers, same as before.
"""

from bson import ObjectId
from bson.errors import InvalidId
from django.contrib.auth.hashers import check_password, make_password
from django.middleware.csrf import rotate_token

from .mongo import users_collection

SESSION_USER_KEY = "user_id"


def to_public(user):
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
    }


def create_user(username, email, password):
    """Insert a user. Raises pymongo DuplicateKeyError if username/email is taken."""
    user = {
        "username": username,
        "email": email.lower(),
        "password": make_password(password),
    }
    result = users_collection().insert_one(user)
    user["_id"] = result.inserted_id
    return user


def get_by_id(user_id):
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return None
    return users_collection().find_one({"_id": oid})


def authenticate(username, password):
    user = users_collection().find_one({"username": username})
    if user is None:
        # Hash anyway so response time doesn't reveal which usernames exist.
        make_password(password)
        return None
    if not check_password(password, user["password"]):
        return None
    return user


def email_taken(email, exclude_id=None):
    query = {"email": email.lower(), "_id": {"$ne": exclude_id}}
    return users_collection().count_documents(query, limit=1) > 0


def update_user(user, username, email):
    """Update a user's username/email. Raises DuplicateKeyError on a conflict."""
    email = email.lower()
    users_collection().update_one(
        {"_id": user["_id"]},
        {"$set": {"username": username, "email": email}},
    )
    return {**user, "username": username, "email": email}


def login(request, user):
    request.session.cycle_key()
    request.session[SESSION_USER_KEY] = str(user["_id"])
    rotate_token(request)


def logout(request):
    request.session.flush()


def current_user(request):
    user_id = request.session.get(SESSION_USER_KEY)
    if user_id is None:
        return None
    user = get_by_id(user_id)
    if user is None:
        request.session.flush()
    return user
