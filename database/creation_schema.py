TITLE_MAX_LENGTH = 100
DESCRIPTION_MAX_LENGTH = 1000
MODERATION_REASON_MAX_LENGTH = 500

creation_schema = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": [
            "user_id",
            "title",
            "simulation_data",
            "created_at",
            "moderation_status"
        ],
        "properties": {
            "user_id": {
                "bsonType": "objectId"
            },
            "title": {
                "bsonType": "string",
                "minLength": 1,
                "maxLength": TITLE_MAX_LENGTH
            },
            "description": {
                "bsonType": "string",
                "maxLength": DESCRIPTION_MAX_LENGTH
            },
            "simulation_data": {
                "bsonType": "object"
            },
            "created_at": {
                "bsonType": "date"
            },
            "moderation_status": {
                "enum": [
                    "pending",
                    "approved",
                    "rejected"
                ]
            },
            "moderation_reason": {
                "bsonType": "string",
                "maxLength": MODERATION_REASON_MAX_LENGTH
            },
            "moderated_at": {
                "bsonType": "date"
            },
            "moderation_attempts": {
                "bsonType": "int",
                "minimum": 0
            },
            "cells_hash": {
                "bsonType": "string"
            }
        }
    }
}
