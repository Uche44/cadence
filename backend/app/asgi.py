"""Process entry point.

Kept separate from ``app.main`` so that importing the application factory never
instantiates the app. That keeps the test suite free of import-time configuration.
"""

from __future__ import annotations

from app.config import get_settings
from app.main import create_app

app = create_app(get_settings())
