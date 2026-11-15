"""MongoDB storage for user creations."""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING

from accounts.mongo import users_collection
from database.creation_schema import creation_schema



def creations_collection():
    """Get the MongoDB collection for creations."""
    db = users_collection().database

    if "creations" not in db.list_collection_names():
        if db.client.__class__.__module__.startswith("mongomock"):
            db.create_collection("creations")
        else:
            db.create_collection(
                "creations",
                validator=creation_schema
            )

    creations = db["creations"]

    creations.create_index("user_id")
    creations.create_index("moderation_status")
    creations.create_index("created_at")

    return creations


def create_creation(user_id, title, simulation_data,
                    description=""):
    """Save a new creation to MongoDB."""
   
    try:
        user_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise ValueError("Invalid user ID.")


    if users_collection().find_one({"_id": user_id}) is None:
        raise ValueError("User does not exist.")



    title = title.strip()

    if not 1 <= len(title) <= 100:
        raise ValueError("Title must be 1-100 characters.")

    if not isinstance(simulation_data, dict):
        raise ValueError("Simulation data must be an object.")

    creation = {
        "user_id": user_id,
        "title": title,
        "description": description,
        "simulation_data": simulation_data,
        "created_at": datetime.now(timezone.utc),
        "moderation_status": "pending"
    }

    result = creations_collection().insert_one(creation)
    creation["_id"] = result.inserted_id

    return creation


def get_creation(creation_id):
    """Retrieve a creation by its ID."""

    try:
        creation_id = ObjectId(creation_id)
    except (InvalidId, TypeError):
        return None

    return creations_collection().find_one(
        {"_id": creation_id}
    )


def get_public_creations(limit=50):
    """Retrieve approved creations for the gallery."""

    return list(
        creations_collection()
        .find({"moderation_status": "approved"})
        .sort("created_at", DESCENDING)
        .limit(limit)
    )


def get_user_creations(user_id):
    """Retrieve all creations belonging to a user."""

    try:
        user_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        return []

    return list(
        creations_collection()
        .find({"user_id": user_id})
        .sort("created_at", DESCENDING)
    )
