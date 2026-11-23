user_schema = {
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["username", "email", "password"],
    "properties": {
        "username": {"bsonType": "string", "minLength": 1, "maxLength": 25},
        "email": {"bsonType": "string", "minLength": 1},
        "password": {"bsonType": "string", "minLength": 1}
    }
  }
}
