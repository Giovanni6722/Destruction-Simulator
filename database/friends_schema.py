
friends_schema = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": [
            "requester_id",
            "recipient_id",
            "pair_key",
            "status",
            "created_at"
        ],
        "properties": {
            "requester_id": {
                "bsonType": "objectId"
            },
            "recipient_id": {
                "bsonType": "objectId"
            },
            "pair_key": {
                "bsonType": "string",
                "minLength": 1
            },
            "status": {
                "enum": [
                    "pending",
                    "accepted",
                    "rejected"
                ]
            },
            "created_at": {
                "bsonType": "date"
            },
            "updated_at": {
                "bsonType": "date"
            }
        }
    }
}
