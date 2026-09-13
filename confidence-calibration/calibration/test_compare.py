"""Tests for the comparison rules in compare.py.

This module is the entire epistemic foundation of the recipe: every headline number in the
notebook and README is downstream of `values_match` deciding what counts as correct. The
money-parsing case (`_strip_money`) shipped with a real bug — every "." was treated as a
decimal point regardless of locale, so "15.000" (Indonesian thousands) and "15,000" (the same
value, US-style) parsed to 15.0 and 15000.0 and scored as a mismatch. It was found by hand,
cross-referencing a CSV against ground truth. These cases are what should have caught it.

Run: python -m unittest calibration.test_compare -v   (from confidence-calibration/)
"""

import unittest
from datetime import date

from calibration.compare import (
    _fold_id,
    _fold_text,
    _parse_date,
    _strip_money,
    _strip_number,
    flatten_result,
    flatten_truth,
    values_match,
)


class StripMoneyTests(unittest.TestCase):
    def test_us_format_thousands_and_decimal(self):
        self.assertEqual(_strip_money("$1,401.42"), "1401.42")

    def test_eu_id_format_thousands_and_decimal(self):
        # Comma as decimal, dot as thousands grouping.
        self.assertEqual(_strip_money("1.401,42"), "1401.42")

    def test_indonesian_thousands_dot_no_subunit(self):
        # The bug: "." was always treated as decimal, so this parsed to 15.0.
        self.assertEqual(_strip_money("15.000"), "15000.00")

    def test_comma_thousands_no_subunit(self):
        self.assertEqual(_strip_money("15,000"), "15000.00")

    def test_indonesian_and_western_notation_are_equal(self):
        # The specific false negative from receipt_042: same value, two conventions.
        self.assertEqual(_strip_money("15.000"), _strip_money("15,000"))

    def test_currency_abbreviation_dot_is_not_decimal(self):
        # The "." in "Rp." survives the symbol-stripping regex; must not be read as decimal.
        self.assertEqual(_strip_money("Rp. 91,000"), "91000.00")

    def test_multi_group_thousands(self):
        self.assertEqual(_strip_money("1.234.567"), "1234567.00")

    def test_two_digit_decimal_kept(self):
        self.assertEqual(_strip_money("36841.78"), "36841.78")

    def test_one_digit_decimal_kept(self):
        self.assertEqual(_strip_money("$5.5"), "5.50")

    def test_negative_leading_sign(self):
        self.assertEqual(_strip_money("-1815.22"), "-1815.22")

    def test_negative_trailing_sign(self):
        self.assertEqual(_strip_money("1815.22-"), "-1815.22")

    def test_plain_integer(self):
        self.assertEqual(_strip_money("36841"), "36841.00")

    def test_none_input(self):
        self.assertIsNone(_strip_money(None))

    def test_unparseable_input(self):
        self.assertIsNone(_strip_money("n/a"))

    def test_empty_after_stripping_symbols(self):
        self.assertIsNone(_strip_money("USD"))


class StripNumberTests(unittest.TestCase):
    def test_plain_integer(self):
        self.assertEqual(_strip_number("3"), "3")

    def test_decimal(self):
        self.assertEqual(_strip_number("20.5"), "20.5")

    def test_none_input(self):
        self.assertIsNone(_strip_number(None))

    def test_unparseable(self):
        self.assertIsNone(_strip_number("many"))


class ParseDateTests(unittest.TestCase):
    def test_iso_format(self):
        self.assertEqual(_parse_date("2026-07-21"), date(2026, 7, 21))

    def test_slash_dmy_format(self):
        self.assertEqual(_parse_date("21/07/2026"), date(2026, 7, 21))

    def test_none_input(self):
        self.assertIsNone(_parse_date(None))

    def test_unparseable(self):
        self.assertIsNone(_parse_date("sometime in July"))


class FoldTextAndIdTests(unittest.TestCase):
    def test_fold_text_case_and_whitespace(self):
        self.assertEqual(_fold_text("  Brightline   Logistics Ltd "), "brightline logistics ltd")

    def test_fold_id_strips_punctuation(self):
        self.assertEqual(_fold_id("GB 742-118.593"), "GB742118593")


class ValuesMatchTests(unittest.TestCase):
    def test_money_match_across_notations(self):
        self.assertTrue(values_match("money", "15.000", "15,000"))

    def test_money_mismatch(self):
        self.assertFalse(values_match("money", "10.00", "20.00"))

    def test_unparseable_ground_truth_is_none_not_false(self):
        # A truth value the corpus itself can't parse is a corpus defect, not a verdict on the
        # extraction: it must be excluded from scoring (None), not silently counted as wrong.
        self.assertIsNone(values_match("money", "10.00", "not a number"))

    def test_unparseable_prediction_is_false(self):
        # The reverse must NOT be None: an extractor that returns garbage is simply wrong.
        self.assertFalse(values_match("money", "not a number", "10.00"))

    def test_empty_ground_truth_is_none(self):
        self.assertIsNone(values_match("text", "anything", ""))

    def test_date_match_different_formats(self):
        self.assertTrue(values_match("date", "21/07/2026", "2026-07-21"))

    def test_id_match_ignores_punctuation_and_case(self):
        self.assertTrue(values_match("id", "gb742118593", "GB 742-118.593"))

    def test_text_match_ignores_case_and_whitespace(self):
        self.assertTrue(values_match("text", "Acme Corp", "  acme   corp "))

    def test_unknown_field_type_raises(self):
        with self.assertRaises(ValueError):
            values_match("currency_amount_in_lira", "1", "1")


class FlattenTests(unittest.TestCase):
    def test_flatten_result_indexes_array_rows(self):
        result = {
            "line_items": {
                "score": {},
                "value": [
                    {"amount": {"score": {"grounding_score": 0.9, "extraction_score": 0.9}, "value": "10.00"}},
                    {"amount": {"score": {"grounding_score": 0.8, "extraction_score": 0.8}, "value": "20.00"}},
                ],
            }
        }
        leaves = flatten_result(result)
        self.assertEqual(leaves["line_items[0].amount"]["value"], "10.00")
        self.assertEqual(leaves["line_items[1].amount"]["value"], "20.00")

    def test_flatten_truth_matches_indexed_shape(self):
        truth = {"line_items": [{"amount": "10.00"}, {"amount": "20.00"}]}
        leaves = flatten_truth(truth)
        self.assertEqual(leaves["line_items[0].amount"], "10.00")
        self.assertEqual(leaves["line_items[1].amount"], "20.00")


if __name__ == "__main__":
    unittest.main()
