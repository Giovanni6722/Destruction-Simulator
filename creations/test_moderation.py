import json
from unittest.mock import patch

import mongomock
from django.test import SimpleTestCase, override_settings

from accounts.mongo import use_test_database
from accounts.users import create_user
from creations.mongo import create_creation, get_creation, get_public_creations
from creations.moderation import moderate_creation
from creations.tests import scene
from database.creation_schema import MODERATION_REASON_MAX_LENGTH

PNG_HEADER = b"\x89PNG\r\n\x1a\n"


def reply(verdict, reason="ok"):
    return json.dumps({"verdict": verdict, "reason": reason})


@override_settings(LLM_API_KEY="test-key")
@patch("creations.moderation._call_llm")
class ModerateCreationTests(SimpleTestCase):
    def setUp(self):
        use_test_database(mongomock.MongoClient().db)
        user = create_user("testuser", "test@example.com", "SecurePass123!")
        self.user_id = user["_id"]

    def make(self, title="Sand castle", fill="sand"):
        return create_creation(self.user_id, title, scene(fill))

    def assert_pending(self, creation, attempts=1):
        saved = get_creation(creation["_id"])
        self.assertEqual(saved["moderation_status"], "pending")
        self.assertEqual(saved["moderation_attempts"], attempts)

    def test_approved_appears_in_gallery(self, llm):
        llm.return_value = reply("approved")
        creation = self.make()

        self.assertEqual(moderate_creation(creation), ("approved", "ok"))
        gallery_ids = [c["_id"] for c in get_public_creations()]
        self.assertIn(creation["_id"], gallery_ids)

    def test_rejected_stores_reason(self, llm):
        llm.return_value = reply("rejected", "Contains a threat.")
        creation = self.make()

        self.assertEqual(moderate_creation(creation),
                         ("rejected", "Contains a threat."))
        saved = get_creation(creation["_id"])
        self.assertEqual(saved["moderation_status"], "rejected")
        self.assertEqual(saved["moderation_reason"], "Contains a threat.")
        self.assertEqual(get_public_creations(), [])

    def test_llm_receives_png(self, llm):
        llm.return_value = reply("approved")
        moderate_creation(self.make())

        _, content, image_png = llm.call_args.args
        self.assertEqual(json.loads(content)["title"], "Sand castle")
        self.assertTrue(image_png.startswith(PNG_HEADER))

    def test_code_fenced_reply_is_accepted(self, llm):
        llm.return_value = "```json\n" + reply("approved") + "\n```"
        self.assertEqual(moderate_creation(self.make()), ("approved", "ok"))

    def test_malformed_json_stays_pending(self, llm):
        llm.return_value = "not json"
        creation = self.make()
        self.assertEqual(moderate_creation(creation), ("pending", ""))
        self.assert_pending(creation)

    def test_unknown_verdict_stays_pending(self, llm):
        llm.return_value = reply("maybe")
        creation = self.make()
        self.assertEqual(moderate_creation(creation), ("pending", ""))
        self.assert_pending(creation)

    def test_json_list_stays_pending(self, llm):
        llm.return_value = json.dumps(["approved"])
        creation = self.make()
        self.assertEqual(moderate_creation(creation), ("pending", ""))
        self.assert_pending(creation)

    def test_timeout_stays_pending(self, llm):
        llm.side_effect = TimeoutError
        creation = self.make()
        self.assertEqual(moderate_creation(creation), ("pending", ""))
        self.assert_pending(creation)

    def test_long_reason_is_truncated(self, llm):
        llm.return_value = reply("rejected", "x" * 2000)
        creation = self.make()
        moderate_creation(creation)

        saved = get_creation(creation["_id"])
        self.assertEqual(len(saved["moderation_reason"]),
                         MODERATION_REASON_MAX_LENGTH)
        self.assertEqual(MODERATION_REASON_MAX_LENGTH, 500)

    @override_settings(LLM_API_KEY="")
    def test_missing_key_never_calls_llm(self, llm):
        creation = self.make()
        self.assertEqual(moderate_creation(creation), ("pending", ""))
        llm.assert_not_called()
        self.assert_pending(creation)

    def test_identical_rejected_scene_skips_llm(self, llm):
        llm.return_value = reply("rejected", "Hateful symbol.")
        moderate_creation(self.make(fill="stone"))
        llm.reset_mock()

        again = self.make(title="Totally new title", fill="stone")
        status, _ = moderate_creation(again)

        self.assertEqual(status, "rejected")
        llm.assert_not_called()
        self.assertEqual(get_creation(again["_id"])["moderation_status"],
                         "rejected")
