user_schema = { 
  "$jsonSchema": {
    "bsonType": "object", 
    "required": ["username", "email"],
    "properties": { 
        "username": {"bsonType": "string"},
        "email": {"bsonType": "string"}
    }
  }
}
