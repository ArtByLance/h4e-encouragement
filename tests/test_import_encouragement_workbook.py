import importlib.util
import tempfile
import unittest
import warnings
from pathlib import Path

from openpyxl import Workbook

warnings.filterwarnings("ignore", category=DeprecationWarning, append=False)
warnings.filterwarnings("ignore", category=ResourceWarning, append=False)


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "import-encouragement-workbook.py"
)
SPEC = importlib.util.spec_from_file_location("importer", SCRIPT_PATH)
importer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(importer)


HEADERS = [
    "eventKey",
    "label",
    "triggerDescription",
    "active",
    "templateKey",
    "message",
    "status",
    "notes",
]


def make_workbook(path, rows_by_locale=None, omit_locale=None):
    rows_by_locale = rows_by_locale or {}
    workbook = Workbook()
    workbook.remove(workbook.active)

    for locale in importer.REQUIRED_LOCALES:
        if locale == omit_locale:
            continue

        sheet = workbook.create_sheet(locale)
        sheet.append(HEADERS)
        for row in rows_by_locale.get(locale, default_rows(locale)):
            sheet.append(row)

    workbook.save(path)
    workbook.close()


def default_rows(locale):
    messages = {
        "en": "{{recipientName}}, it has been a few days.",
        "es": "{{recipientName}}, han pasado unos dias.",
        "ar": "{{recipientName}}، مرت بضعة ايام.",
    }

    return [
        [
            "inactive_3_days",
            "Inactive 3 Days",
            "Inactive for 3 days",
            True,
            "template1",
            messages[locale],
            "approved",
            "",
        ],
        [
            "inactive_3_days",
            "Inactive 3 Days",
            "Inactive for 3 days",
            True,
            "template2",
            f"Draft {locale}",
            "draft",
            "",
        ],
    ]


class ImportEncouragementWorkbookTest(unittest.TestCase):
    def test_valid_workbook_generates_catalog(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook_path = Path(directory) / "messages.xlsx"
            make_workbook(workbook_path)

            messages = importer.read_workbook(workbook_path, include_unapproved=False)
            catalog = importer.build_catalog(messages)

            self.assertEqual(catalog["schemaVersion"], "2.0.0")
            self.assertEqual(catalog["supportedLocales"], ["en", "es", "ar"])
            self.assertEqual(
                catalog["messages"]["inactive_3_days"]["templates"]["es"]["template1"],
                "{{recipientName}}, han pasado unos dias.",
            )

    def test_missing_locale_tab_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook_path = Path(directory) / "messages.xlsx"
            make_workbook(workbook_path, omit_locale="ar")

            with self.assertRaisesRegex(ValueError, "missing required sheets: ar"):
                importer.read_workbook(workbook_path, include_unapproved=False)

    def test_missing_placeholder_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook_path = Path(directory) / "messages.xlsx"
            rows_by_locale = {
                "es": [
                    [
                        "inactive_3_days",
                        "Inactive 3 Days",
                        "Inactive for 3 days",
                        True,
                        "template1",
                        "Han pasado unos dias.",
                        "approved",
                        "",
                    ]
                ]
            }
            make_workbook(workbook_path, rows_by_locale=rows_by_locale)

            with self.assertRaisesRegex(ValueError, "does not match English placeholder usage"):
                importer.read_workbook(workbook_path, include_unapproved=False)

    def test_duplicate_template_row_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook_path = Path(directory) / "messages.xlsx"
            duplicate = default_rows("en")[:1] + default_rows("en")[:1]
            make_workbook(workbook_path, rows_by_locale={"en": duplicate})

            with self.assertRaisesRegex(ValueError, "duplicates template"):
                importer.read_workbook(workbook_path, include_unapproved=False)

    def test_unapproved_rows_are_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook_path = Path(directory) / "messages.xlsx"
            make_workbook(workbook_path)

            messages = importer.read_workbook(workbook_path, include_unapproved=False)
            templates = messages["inactive_3_days"]["templates"]

            self.assertIn("template1", templates["en"])
            self.assertNotIn("template2", templates["en"])

    def test_include_unapproved_imports_non_empty_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook_path = Path(directory) / "messages.xlsx"
            make_workbook(workbook_path)

            messages = importer.read_workbook(workbook_path, include_unapproved=True)
            templates = messages["inactive_3_days"]["templates"]

            self.assertIn("template2", templates["en"])


if __name__ == "__main__":
    unittest.main()
