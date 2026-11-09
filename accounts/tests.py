import json

from django.test import TestCase
from django.contrib.auth.models import User


class RegistrationTests(TestCase):

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
        self.assertTrue(User.objects.filter(username="testuser").exists())

        user = User.objects.get(username="testuser")
        self.assertTrue(user.check_password("SecurePass123!"))

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
        User.objects.create_user(
            username="testuser",
            email="first@example.com",
            password="SecurePass123!",
        )

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

class AuthenticationTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="philtest",
            email="phil@example.com",
            password="SecurePass123!",
        )

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
        self.assertTrue(response.wsgi_request.user.is_authenticated)

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
        self.client.force_login(self.user)

        response = self.client.post("/api/accounts/logout/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_logout_without_authentication(self):
        response = self.client.post("/api/accounts/logout/")

        self.assertEqual(response.status_code, 401)

    def test_authenticated_profile(self):
        self.client.force_login(self.user)

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

class ProfileUpdateTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="profileuser",
            email="profile@example.com",
            password="SecurePass123!",
        )

        self.client.force_login(self.user)

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

        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "updateduser")
        self.assertEqual(self.user.email, "updated@example.com")

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
        User.objects.create_user(
            username="takenuser",
            email="taken@example.com",
            password="SecurePass123!",
        )

        response = self.client.put(
            "/api/accounts/profile/update/",
            data=json.dumps({
                "username": "takenuser",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)

    def test_unauthenticated_profile_update(self):
        self.client.logout()

        response = self.client.put(
            "/api/accounts/profile/update/",
            data=json.dumps({
                "username": "newusername",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
