"""Tests for project file path normalization."""

import pytest

from services.path_utils import InvalidFilePathError, normalize_project_file_path


def test_normalize_valid_path():
    assert normalize_project_file_path("index.html") == "index.html"
    assert normalize_project_file_path("/styles/app.css") == "styles/app.css"
    assert normalize_project_file_path("src%2Fmain.js") == "src/main.js"


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "/",
        "..",
        "../etc/passwd",
        "src/../../secret.txt",
        "foo/../../../bar",
    ],
)
def test_reject_traversal(raw: str):
    with pytest.raises(InvalidFilePathError):
        normalize_project_file_path(raw)
