
from scripts.check_no_emoji import main as run_emoji_check


def test_codebase_contains_no_emojis() -> None:
    """Automated test enforcing strict no-emoji policy across codebase."""
    exit_code = run_emoji_check()
    assert exit_code == 0, "Emojis were detected in the codebase. Strict no-emoji policy violated."
