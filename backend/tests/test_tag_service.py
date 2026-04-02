from services.tag_service import normalize_tag


def test_normalize_tag():
    assert normalize_tag("Past Perfect") == "past-perfect"
    assert normalize_tag("past_perfect") == "past-perfect"
    assert normalize_tag("PastPerfect") == "pastperfect"
    assert normalize_tag("  Subjective Mood!  ") == "subjective-mood"
    assert normalize_tag("relative clause") == "relative-clause"
    assert normalize_tag("") == ""