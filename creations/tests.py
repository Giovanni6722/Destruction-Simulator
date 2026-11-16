
import unittest

import mongomock
from bson import ObjectId

from accounts.mongo import use_test_database
from accounts.users import create_user
from .mongo import (
    create_creation,
    creations_collection,
    get_creation,
    get_public_creations,
    get_user_creations,
)


class CreationDatabaseTests(unittest.TestCase):

    
    def setUp(self):
        self.db = mongomock.MongoClient().db
        use_test_database(self.db)

        self.user = create_user(
            "testuser",
            "test@example.com",
            "SecurePass123!"
        )
        self.user_id = self.user["_id"]


    def test_create_creation(self):
        creation = create_creation(
            self.user_id,
            "My Sand Castle",
            {
                "width": 120,
                "height": 90,
                "cells": []
            }
        )

        saved = creations_collection().find_one({
            "_id": creation["_id"]
        })

        self.assertIsNotNone(saved)
        self.assertEqual(saved["title"], "My Sand Castle")
        self.assertEqual(saved["user_id"], self.user_id)
        self.assertEqual(saved["moderation_status"], "pending")

    def test_get_creation(self):
        creation = create_creation(
            self.user_id,
            "Water Simulation",
            {"cells": []}
        )

        saved = get_creation(str(creation["_id"]))

        self.assertEqual(saved["title"], "Water Simulation")

    def test_invalid_creation_id(self):
        self.assertIsNone(get_creation("invalid-id"))

    def test_approved_creations_appear_in_gallery(self):
        creation = create_creation(
            self.user_id,
            "Approved Creation",
            {"cells": []}
        )

        creations_collection().update_one(
            {"_id": creation["_id"]},
            {"$set": {"moderation_status": "approved"}}
        )

        gallery = get_public_creations()

        self.assertEqual(len(gallery), 1)
        self.assertEqual(gallery[0]["title"], "Approved Creation")

    def test_pending_creations_hidden_from_gallery(self):
        create_creation(
            self.user_id,
            "Pending Creation",
            {"cells": []}
        )

        self.assertEqual(get_public_creations(), [])

    def test_rejected_creations_hidden_from_gallery(self):
        creation = create_creation(
            self.user_id,
            "Rejected Creation",
            {"cells": []}
        )

        creations_collection().update_one(
            {"_id": creation["_id"]},
            {"$set": {"moderation_status": "rejected"}}
        )

        self.assertEqual(get_public_creations(), [])

    def test_get_user_creations(self):     
        other_user = create_user(
            "otheruser",
            "other@example.com",
            "SecurePass123!"
        )["_id"]


        create_creation(
            self.user_id,
            "My Creation",
            {"cells": []}
        )

        create_creation(
            other_user,
            "Someone Else's Creation",
            {"cells": []}
        )

        results = get_user_creations(str(self.user_id))

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "My Creation")

    def test_empty_title_rejected(self):
        with self.assertRaises(ValueError):
            create_creation(
                self.user_id,
                "",
                {"cells": []}
            )

    def test_invalid_simulation_data_rejected(self):
        with self.assertRaises(ValueError):
            create_creation(
                self.user_id,
                "Invalid Creation",
                "not an object"
            )


    def test_nonexistent_user_rejected(self):
        with self.assertRaises(ValueError):
            create_creation(
                ObjectId(),
                "Creation by Nonexistent User",
                {"cells": []}
            )

    def test_invalid_user_id_rejected(self):
        with self.assertRaises(ValueError):
            create_creation(
                "invalid-id",
                "Creation by Invalid User",
                {"cells": []}
            )

    def test_title_length_validation(self):
        with self.assertRaises(ValueError):
            create_creation(
                self.user_id,
                "A" * 101,  # Title too long
                {"cells": []}
            )

    def test_non_string_title_rejected(self):
        with self.assertRaises(ValueError):
            create_creation(
                self.user_id,
                123,
                {"cells": []}
            )

    def test_non_string_description_rejected(self):
        with self.assertRaises(ValueError):
            create_creation(
                self.user_id,
                "Creation",
                {"cells": []},
                description=["not", "a", "string"]
            )

    def test_description_length_validation(self):
        with self.assertRaises(ValueError):
            create_creation(
                self.user_id,
                "Creation",
                {"cells": []},
                description="A" * 1001  # Description too long
            )

    def test_description_at_max_length_accepted(self):
        creation = create_creation(
            self.user_id,
            "Creation",
            {"cells": []},
            description="A" * 1000
        )

        self.assertEqual(len(creation["description"]), 1000)

    def test_title_whitespace_trimmed(self):
        creation = create_creation(
            self.user_id,
            "   Trimmed Title   ",
            {"cells": []}
        )

        self.assertEqual(creation["title"], "Trimmed Title")