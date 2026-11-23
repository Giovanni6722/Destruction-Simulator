import json

import mongomock
from django.contrib.auth.hashers import check_password
from django.test import SimpleTestCase

from . import users
from .mongo import use_test_database


class MongoTestCase(SimpleTestCase):
    """Runs each test against a fresh in-memory MongoDB."""

    def setUp(self):
        use_test_database(mongomock.MongoClient().db)

    def create_user(self, username, email, password="SecurePass123!"):
        return users.create_user(username, email, password)

    def log_in(self, username, password="SecurePass123!"):
        response = self.client.post(
            "/api/accounts/login/",
            data=json.dumps({"username": username, "password": password}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

    def find(self, **query):
        return users.users_collection().find_one(query)


class RegistrationTests(MongoTestCase):

    def test_successful_registration(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "testuser",
                "email": "test@example.com",
                "password": "SecurePass123!"
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        user = self.find(username="testuser")
        self.assertIsNotNone(user)
        self.assertTrue(check_password("SecurePass123!", user["password"]))
        self.assertEqual(response.json()["user"]["id"], str(user["_id"]))

    def test_missing_required_fields(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({"username": "testuser"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_invalid_email(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "testuser",
                "email": "not-an-email",
                "password": "SecurePass123!"
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_duplicate_username(self):
        self.create_user("testuser", "first@example.com")

        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "testuser",
                "email": "second@example.com",
                "password": "SecurePass123!"
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)

    def test_weak_password_rejected(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "weakuser",
                "email": "weak@example.com",
                "password": "123",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_json_array_rejected(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps(["not", "an", "object"]),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_invalid_username_rejected(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "bad name <script>",
                "email": "bad@example.com",
                "password": "SecurePass123!",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIsNone(self.find(email="bad@example.com"))

    def test_too_long_username_rejected(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "a" * 26,
                "email": "long@example.com",
                "password": "SecurePass123!",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_max_length_username_accepted(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "a" * 25,
                "email": "maxlen@example.com",
                "password": "SecurePass123!",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)

    def test_email_is_lowercased(self):
        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "mixedemail",
                "email": "Mixed@Example.COM",
                "password": "SecurePass123!",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            self.find(username="mixedemail")["email"],
            "mixed@example.com",
        )

    def test_duplicate_email_different_case_rejected(self):
        self.create_user("firstuser", "Same@x.com")

        response = self.client.post(
            "/api/accounts/register/",
            data=json.dumps({
                "username": "seconduser",
                "email": "same@x.com",
                "password": "SecurePass123!",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)

class AuthenticationTests(MongoTestCase):

    def setUp(self):
        super().setUp()
        self.user = self.create_user("philtest", "phil@example.com")

    def test_successful_login(self):
        response = self.client.post(
            "/api/accounts/login/",
            data=json.dumps({
                "username": "philtest",
                "password": "SecurePass123!",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/accounts/profile/").status_code, 200)

    def test_invalid_password(self):
        response = self.client.post(
            "/api/accounts/login/",
            data=json.dumps({
                "username": "philtest",
                "password": "WrongPassword123!",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)

    def test_missing_login_fields(self):
        response = self.client.post(
            "/api/accounts/login/",
            data=json.dumps({"username": "philtest"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_successful_logout(self):
        self.log_in("philtest")

        response = self.client.post("/api/accounts/logout/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/accounts/profile/").status_code, 401)

    def test_logout_without_authentication(self):
        response = self.client.post("/api/accounts/logout/")

        self.assertEqual(response.status_code, 401)

    def test_authenticated_profile(self):
        self.log_in("philtest")

        response = self.client.get("/api/accounts/profile/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "philtest")

    def test_unauthenticated_profile(self):
        response = self.client.get("/api/accounts/profile/")

        self.assertEqual(response.status_code, 401)

    def test_json_array_rejected_during_login(self):
            response = self.client.post(
                "/api/accounts/login/",
                data=json.dumps(["not", "an", "object"]),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 400)
            self.assertIn("error", response.json())

class ProfileUpdateTests(MongoTestCase):

    def setUp(self):
        super().setUp()
        self.user = self.create_user("profileuser", "profile@example.com")

        self.log_in("profileuser")

    def test_successful_profile_update(self):
        response = self.client.put(
            "/api/accounts/profile/update/",
            data=json.dumps({
                "username": "updateduser",
                "email": "updated@example.com",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)

        user = self.find(_id=self.user["_id"])
        self.assertEqual(user["username"], "updateduser")
        self.assertEqual(user["email"], "updated@example.com")

    def test_invalid_email_update(self):
        response = self.client.put(
            "/api/accounts/profile/update/",
            data=json.dumps({
                "email": "invalid-email",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_duplicate_username_update(self):
        self.create_user("takenuser", "taken@example.com")

        response = self.client.put(
            "/api/accounts/profile/update/",
            data=json.dumps({
                "username": "takenuser",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)

    def test_invalid_username_update(self):
        response = self.client.put(
            "/api/accounts/profile/update/",
            data=json.dumps({"username": "bad name <script>"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.find(_id=self.user["_id"])["username"], "profileuser")

    def test_duplicate_email_different_case_update(self):
        self.create_user("otheruser", "other@example.com")

        response = self.client.put(
            "/api/accounts/profile/update/",
            data=json.dumps({"email": "OTHER@example.com"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)

    def test_unauthenticated_profile_update(self):
        self.client.post("/api/accounts/logout/")

        response = self.client.put(
            "/api/accounts/profile/update/",
            data=json.dumps({
                "username": "newusername",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)



class CsrfTokenTests(MongoTestCase):

    def test_csrf_endpoint_returns_token_and_cookie(self):
        response = self.client.get(
            "/api/accounts/csrf/",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrfToken", response.json())
        self.assertTrue(response.json()["csrfToken"])
        self.assertIn("csrftoken", response.cookies)
