"""Tests for production configuration guards."""

import pytest
from pydantic import ValidationError

from config import Settings


def test_production_rejects_default_jwt():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(env="production", jwt_secret="atoms-demo-dev-secret")


def test_production_accepts_custom_jwt():
    settings = Settings(env="production", jwt_secret="custom-production-secret")
    assert settings.jwt_secret == "custom-production-secret"
