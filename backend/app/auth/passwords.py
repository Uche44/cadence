"""Password hashing.

Argon2id with the library defaults. Nothing clever: the only two rules are that
plaintext is never stored and that a wrong answer takes the same time as a right
one.

The dummy hash exists for that second rule. Without it, "no account with that
email" returns noticeably faster than "wrong password", which tells an attacker
which emails have accounts.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

#: Verified against when there is no account, so the failure path costs the same.
DUMMY_HASH = _hasher.hash("timing-equaliser-not-a-real-password")

MINIMUM_PASSWORD_LENGTH = 8
MAXIMUM_PASSWORD_LENGTH = 128


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return _hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return True
