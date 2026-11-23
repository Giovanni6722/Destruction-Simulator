
"""MongoDB storage for friend requests and friendships."""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument

from accounts.mongo import users_collection
from accounts.users import to_public
from database.friends_schema import friends_schema


def friends_collection():
    """Get the MongoDB collection for friendships."""
    db = users_collection().database

    if "friendships" not in db.list_collection_names():
        if db.client.__class__.__module__.startswith("mongomock"):
            db.create_collection("friendships")
        else:
            db.create_collection(
                "friendships",
                validator=friends_schema
            )

    friends = db["friendships"]
    friends.create_index("pair_key", unique=True)
    friends.create_index("requester_id")
    friends.create_index("recipient_id")
    return friends


def validate_user(user_id):
    """Validate that a user ID belongs to an existing account."""
    try:
        user_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise ValueError("Invalid user ID.")

    if users_collection().find_one({"_id": user_id}) is None:
        raise ValueError("User does not exist.")

    return user_id


def get_pair_key(user_a, user_b):
    """Create the same key regardless of user order."""
    return ":".join(sorted([str(user_a), str(user_b)]))


def send_friend_request(requester_id, recipient_id):
    """Send a friend request to another registered user."""
    requester_id = validate_user(requester_id)
    recipient_id = validate_user(recipient_id)

    if requester_id == recipient_id:
        raise ValueError("You cannot add yourself as a friend.")

    pair_key = get_pair_key(requester_id, recipient_id)

    if friends_collection().find_one({"pair_key": pair_key}):
        raise ValueError("A friendship or request already exists.")

    now = datetime.now(timezone.utc)

    request = {
        "requester_id": requester_id,
        "recipient_id": recipient_id,
        "pair_key": pair_key,
        "status": "pending",
        "created_at": now,
        "updated_at": now
    }

    friends_collection().insert_one(request)
    return request


def accept_friend_request(request_id, recipient_id):
    """Accept an incoming friend request."""
    recipient_id = validate_user(recipient_id)

    try:
        request_id = ObjectId(request_id)
    except (InvalidId, TypeError):
        raise ValueError("Invalid request ID.")

    result = friends_collection().find_one_and_update(
        {
            "_id": request_id,
            "recipient_id": recipient_id,
            "status": "pending"
        },
        {
            "$set": {
                "status": "accepted",
                "updated_at": datetime.now(timezone.utc)
            }
        },
        return_document=ReturnDocument.AFTER
    )

    if result is None:
        raise ValueError("Pending friend request not found.")

    return result


def reject_friend_request(request_id, recipient_id):
    """Reject an incoming friend request."""
    recipient_id = validate_user(recipient_id)

    try:
        request_id = ObjectId(request_id)
    except (InvalidId, TypeError):
        raise ValueError("Invalid request ID.")

    result = friends_collection().find_one_and_update(
        {
            "_id": request_id,
            "recipient_id": recipient_id,
            "status": "pending"
        },
        {
            "$set": {
                "status": "rejected",
                "updated_at": datetime.now(timezone.utc)
            }
        },
        return_document=ReturnDocument.AFTER
    )

    if result is None:
        raise ValueError("Pending friend request not found.")

    return result


def remove_friend(user_id, friend_id):
    """Remove an existing friendship."""
    user_id = validate_user(user_id)
    friend_id = validate_user(friend_id)

    pair_key = get_pair_key(user_id, friend_id)

    result = friends_collection().delete_one({
        "pair_key": pair_key,
        "status": "accepted"
    })

    return result.deleted_count > 0


def get_friends(user_id):
    """Retrieve all accepted friends of a user."""
    user_id = validate_user(user_id)

    friendships = friends_collection().find({
        "status": "accepted",
        "$or": [
            {"requester_id": user_id},
            {"recipient_id": user_id}
        ]
    })

    friend_ids = []

    for friendship in friendships:
        if friendship["requester_id"] == user_id:
            friend_ids.append(friendship["recipient_id"])
        else:
            friend_ids.append(friendship["requester_id"])

    users = users_collection().find({
        "_id": {"$in": friend_ids}
    })

    return [to_public(user) for user in users]


def get_incoming_requests(user_id):
    """Retrieve pending requests received by a user."""
    user_id = validate_user(user_id)

    return list(friends_collection().find({
        "recipient_id": user_id,
        "status": "pending"
    }))


def get_outgoing_requests(user_id):
    """Retrieve pending requests sent by a user."""
    user_id = validate_user(user_id)

    return list(friends_collection().find({
        "requester_id": user_id,
        "status": "pending"
    }))
