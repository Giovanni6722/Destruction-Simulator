"""MongoDB connection for user accounts.

Accounts live in MongoDB (not Django's SQLite file) because Render's free
instance wipes its local disk on every deploy and restart.
"""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from pymongo import ASCENDING, MongoClient

from database.user_schema import user_schema

_client = None
_users = None


def _prepare_users(db, apply_schema=True):
    """Create the users collection (with schema validation) and its unique indexes."""
    if apply_schema and "users" not in db.list_collection_names():
        db.create_collection("users", validator=user_schema)
    users = db["users"]
    users.create_index([("username", ASCENDING)], unique=True)
    users.create_index([("email", ASCENDING)], unique=True)
    return users


def users_collection():
    """Return the users collection, connecting on first use."""
    global _client, _users
    if _users is None:
        if not settings.MONGODB_URI:
            raise ImproperlyConfigured("MONGODB_URI is not set.")
        _client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
        _users = _prepare_users(_client[settings.MONGODB_DB_NAME])
    return _users


def use_test_database(db):
    """Point the accounts app at an in-memory database (mongomock) for tests."""
    global _client, _users
    _client = None
    _users = _prepare_users(db, apply_schema=False)
