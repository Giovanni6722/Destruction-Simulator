
"""Tests for friend requests and friendships."""

import unittest
import mongomock

from accounts.mongo import use_test_database
from accounts.users import create_user
from friends.mongo import (
    friends_collection,
    get_pair_key,
    send_friend_request,
    accept_friend_request,
    reject_friend_request,
    remove_friend,
    get_friends,
    get_incoming_requests,
    get_outgoing_requests,
)


class FriendsTests(unittest.TestCase):

    def setUp(self):
        """Create a test database and three users."""
        self.db = mongomock.MongoClient().db
        use_test_database(self.db)

        self.user1 = create_user(
            "user1", "user1@example.com", "Password123!"
        )
        self.user2 = create_user(
            "user2", "user2@example.com", "Password123!"
        )
        self.user3 = create_user(
            "user3", "user3@example.com", "Password123!"
        )

        self.id1 = self.user1["_id"]
        self.id2 = self.user2["_id"]
        self.id3 = self.user3["_id"]

    def test_send_friend_request(self):
        request = send_friend_request(self.id1, self.id2)

        self.assertEqual(request["status"], "pending")
        self.assertEqual(request["requester_id"], self.id1)
        self.assertEqual(request["recipient_id"], self.id2)

    def test_cannot_add_yourself(self):
        with self.assertRaises(ValueError):
            send_friend_request(self.id1, self.id1)

    def test_duplicate_request(self):
        send_friend_request(self.id1, self.id2)

        with self.assertRaises(ValueError):
            send_friend_request(self.id1, self.id2)

    def test_reverse_duplicate_request(self):
        send_friend_request(self.id1, self.id2)

        with self.assertRaises(ValueError):
            send_friend_request(self.id2, self.id1)

    def test_accept_friend_request(self):
        request = send_friend_request(self.id1, self.id2)

        accepted = accept_friend_request(
            request["_id"], self.id2
        )

        self.assertEqual(accepted["status"], "accepted")

    def test_reject_friend_request(self):
        request = send_friend_request(self.id1, self.id2)

        rejected = reject_friend_request(
            request["_id"], self.id2
        )

        self.assertEqual(rejected["status"], "rejected")

    def test_wrong_user_cannot_accept(self):
        request = send_friend_request(self.id1, self.id2)

        with self.assertRaises(ValueError):
            accept_friend_request(request["_id"], self.id3)

    def test_wrong_user_cannot_reject(self):
        request = send_friend_request(self.id1, self.id2)

        with self.assertRaises(ValueError):
            reject_friend_request(request["_id"], self.id3)

    def test_get_friends(self):
        request = send_friend_request(self.id1, self.id2)
        accept_friend_request(request["_id"], self.id2)

        friends = get_friends(self.id1)

        self.assertEqual(len(friends), 1)
        self.assertEqual(friends[0]["username"], "user2")

    def test_friendship_works_both_directions(self):
        request = send_friend_request(self.id1, self.id2)
        accept_friend_request(request["_id"], self.id2)

        friends1 = get_friends(self.id1)
        friends2 = get_friends(self.id2)

        self.assertEqual(friends1[0]["username"], "user2")
        self.assertEqual(friends2[0]["username"], "user1")

    def test_remove_friend(self):
        request = send_friend_request(self.id1, self.id2)
        accept_friend_request(request["_id"], self.id2)

        removed = remove_friend(self.id1, self.id2)

        self.assertTrue(removed)
        self.assertEqual(get_friends(self.id1), [])
        self.assertEqual(get_friends(self.id2), [])

    def test_get_incoming_requests(self):
        send_friend_request(self.id1, self.id2)

        requests = get_incoming_requests(self.id2)

        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0]["requester_id"], self.id1)

    def test_get_outgoing_requests(self):
        send_friend_request(self.id1, self.id2)

        requests = get_outgoing_requests(self.id1)

        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0]["recipient_id"], self.id2)

    def test_pending_request_not_in_friends(self):
        send_friend_request(self.id1, self.id2)

        self.assertEqual(get_friends(self.id1), [])
        self.assertEqual(get_friends(self.id2), [])

    def test_nonexistent_user(self):
        from bson import ObjectId

        with self.assertRaises(ValueError):
            send_friend_request(self.id1, ObjectId())

    def test_cannot_accept_twice(self):
        request = send_friend_request(self.id1, self.id2)
        accept_friend_request(request["_id"], self.id2)

        with self.assertRaises(ValueError):
            accept_friend_request(request["_id"], self.id2)


    def test_unique_friendship_index(self):
        from pymongo.errors import DuplicateKeyError
        from friends.mongo import friends_collection, get_pair_key

        pair_key = get_pair_key(self.id1, self.id2)
        collection = friends_collection()

        collection.insert_one({
            "requester_id": self.id1,
            "recipient_id": self.id2,
            "pair_key": pair_key,
            "status": "pending"
    })

        with self.assertRaises(mongomock.DuplicateKeyError):
            collection.insert_one({
                "requester_id": self.id2,
                "recipient_id": self.id1,
                "pair_key": pair_key,
                "status": "pending"
        })
