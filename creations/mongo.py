"""MongoDB storage for user creations."""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING

from accounts.mongo import users_collection
from database.creation_schema import (
    DESCRIPTION_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    creation_schema,
)
from .materials import COLORS, GRID_HEIGHT, GRID_WIDTH

SIMULATION_DATA_VERSION = 1


def validate_simulation_data(simulation_data):
    """Check a saved scene matches the format the frontend sends.

    {"version": 1, "width": 120, "height": 90, "cells": [<material or None>, ...]}
    """
    if not isinstance(simulation_data, dict):
        raise ValueError("Simulation data must be an object.")

    if simulation_data.get("version") != SIMULATION_DATA_VERSION:
        raise ValueError(
            f"Simulation data version must be {SIMULATION_DATA_VERSION}."
        )

    if (simulation_data.get("width") != GRID_WIDTH
            or simulation_data.get("height") != GRID_HEIGHT):
        raise ValueError(
            f"Simulation size must be {GRID_WIDTH}x{GRID_HEIGHT}."
        )

    cells = simulation_data.get("cells")
    expected = GRID_WIDTH * GRID_HEIGHT

    if not isinstance(cells, list) or len(cells) != expected:
        raise ValueError(f"Cells must be a list of {expected} entries.")

    for cell in cells:
        if cell is not None and (not isinstance(cell, str) or cell not in COLORS):
            raise ValueError(f"Unknown material: {cell!r}.")


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



    if not isinstance(title, str):
        raise ValueError("Title must be a string.")

    title = title.strip()

    if not 1 <= len(title) <= TITLE_MAX_LENGTH:
        raise ValueError(f"Title must be 1-{TITLE_MAX_LENGTH} characters.")

    if not isinstance(description, str):
        raise ValueError("Description must be a string.")

    if len(description) > DESCRIPTION_MAX_LENGTH:
        raise ValueError(
            f"Description must be at most {DESCRIPTION_MAX_LENGTH} characters."
        )

    validate_simulation_data(simulation_data)

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
