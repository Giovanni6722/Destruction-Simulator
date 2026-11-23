from django.test import SimpleTestCase, override_settings


class HealthEndpointTests(SimpleTestCase):
    def test_health_returns_ok(self):
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    @override_settings(GIT_COMMIT="abc123")
    def test_health_reports_deployed_commit(self):
        self.assertEqual(self.client.get("/health/").json()["commit"], "abc123")
