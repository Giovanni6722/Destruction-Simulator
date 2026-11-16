
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
                "maxLength": 100
            },
            "description": {
                "bsonType": "string"
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
            }
        }
    }
}
