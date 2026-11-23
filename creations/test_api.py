import json

import mongomock
from django.test import SimpleTestCase

from accounts import users
from accounts.mongo import use_test_database
from .materials import GRID_HEIGHT, GRID_WIDTH
from .mongo import creations_collection
from . import mongo


class CreationsAPITests(SimpleTestCase):

    def setUp(self):
        use_test_database(mongomock.MongoClient().db)

        self.user = users.create_user(
            "apitestuser",
            "api@example.com",
            "SecurePass123!",
        )

    def scene(self, fill=None):
        return {
            "version": 1,
            "width": GRID_WIDTH,
            "height": GRID_HEIGHT,
            "cells": [fill] * (GRID_WIDTH * GRID_HEIGHT),
        }

    def login(self, username="apitestuser", password="SecurePass123!"):
        response = self.client.post(
            "/api/accounts/login/",
            data=json.dumps({
                "username": username,
                "password": password,
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

    def post_json(self, url, payload):
        return self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
        )

    # -----------------------------------------------
    # Creation API Tests
    # -----------------------------------------------

    def test_create_creation_requires_authentication(self):
        response = self.post_json(
            "/api/creations/create/",
            {
                "title": "Test Creation",
                "simulation_data": self.scene("sand"),
            },
        )

        self.assertEqual(response.status_code, 401)

    def test_create_creation_success(self):
        self.login()

        response = self.post_json(
            "/api/creations/create/",
            {
                "title": "My Test Creation",
                "description": "A test simulation.",
                "simulation_data": self.scene("sand"),
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["title"], "My Test Creation")
        self.assertEqual(response.json()["moderation_status"], "pending")

        saved = creations_collection().find_one(
            {"title": "My Test Creation"}
        )

        self.assertIsNotNone(saved)
        self.assertEqual(saved["moderation_status"], "pending")

    def test_create_creation_missing_fields(self):
        self.login()

        response = self.post_json(
            "/api/creations/create/",
            {
                "title": "Missing Scene",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_create_creation_invalid_scene(self):
        self.login()

        response = self.post_json(
            "/api/creations/create/",
            {
                "title": "Invalid Scene",
                "simulation_data": {"version": 1},
            },
        )

        self.assertEqual(response.status_code, 400)

    # -----------------------------------------------
    # Public Creations Gallery Tests
    # -----------------------------------------------

    def test_public_gallery_only_shows_approved_creations(self):
        approved = mongo.create_creation(
            user_id=str(self.user["_id"]),
            title="Approved Creation",
            simulation_data=self.scene("sand"),
        )

        mongo.create_creation(
            user_id=str(self.user["_id"]),
            title="Pending Creation",
            simulation_data=self.scene("water"),
        )

        creations_collection().update_one(
            {"_id": approved["_id"]},
            {"$set": {"moderation_status": "approved"}},
        )

        response = self.client.get("/api/creations/")

        self.assertEqual(response.status_code, 200)

        creations = response.json()["creations"]
        titles = [creation["title"] for creation in creations]

        self.assertIn("Approved Creation", titles)
        self.assertNotIn("Pending Creation", titles)

    # -----------------------------------------------
    # My Creations API Tests
    # -----------------------------------------------

    def test_my_creations_requires_authentication(self):
        response = self.client.get("/api/creations/mine/")

        self.assertEqual(response.status_code, 401)

    def test_my_creations_returns_users_creations(self):
        mongo.create_creation(
            user_id=str(self.user["_id"]),
            title="My Creation",
            simulation_data=self.scene("sand"),
        )

        self.login()

        response = self.client.get("/api/creations/mine/")

        self.assertEqual(response.status_code, 200)

        creations = response.json()["creations"]

        self.assertEqual(len(creations), 1)
        self.assertEqual(creations[0]["title"], "My Creation")

    # -----------------------------------------------
    # Creation Detail API Tests
    # -----------------------------------------------

    def test_owner_can_view_pending_creation(self):
        creation = mongo.create_creation(
            user_id=str(self.user["_id"]),
            title="My Pending Creation",
            simulation_data=self.scene("water"),
        )

        self.login()

        response = self.client.get(
            f"/api/creations/{creation['_id']}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["title"],
            "My Pending Creation",
        )

    def test_other_user_cannot_view_pending_creation(self):
        creation = mongo.create_creation(
            user_id=str(self.user["_id"]),
            title="Private Pending Creation",
            simulation_data=self.scene("sand"),
        )

        users.create_user(
            "otheruser",
            "other@example.com",
            "SecurePass456!",
        )

        self.login()

        self.client.post("/api/accounts/logout/")

        self.login(
            username="otheruser",
            password="SecurePass456!",
        )

        response = self.client.get(
            f"/api/creations/{creation['_id']}/"
        )

        self.assertEqual(response.status_code, 404)