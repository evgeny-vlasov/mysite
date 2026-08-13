#!/usr/bin/env python3
"""Dependency-free structural and link checks for the static upload root."""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
HTML_FILES = sorted(PUBLIC.glob("*.html"))


class PageParser(HTMLParser):
    def __init__(self, path: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids: list[str] = []
        self.refs: list[tuple[str, str]] = []
        self.headings: list[int] = []
        self.images_without_alt: list[int] = []
        self.line = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        self.line = self.getpos()[0]
        if values.get("id"):
            self.ids.append(values["id"] or "")
        if tag in {"a", "link"} and values.get("href"):
            self.refs.append((values["href"] or "", tag))
        if tag in {"script", "img"} and values.get("src"):
            self.refs.append((values["src"] or "", tag))
        if re.fullmatch(r"h[1-6]", tag):
            self.headings.append(int(tag[1]))
        if tag == "img" and "alt" not in values:
            self.images_without_alt.append(self.line)


def local_target(page: Path, reference: str) -> tuple[Path, str] | None:
    split = urlsplit(reference)
    if split.scheme or split.netloc or reference.startswith(("mailto:", "tel:", "data:")):
        return None
    raw_path = unquote(split.path)
    if raw_path in {"", "."}:
        target = page
    elif raw_path == "./":
        target = PUBLIC / "index.html"
    elif raw_path.endswith("/"):
        target = (page.parent / raw_path / "index.html").resolve()
    else:
        target = (page.parent / raw_path).resolve()
    return target, split.fragment


def main() -> int:
    errors: list[str] = []
    parsed: dict[Path, PageParser] = {}

    for page in HTML_FILES:
        parser = PageParser(page)
        try:
            parser.feed(page.read_text(encoding="utf-8"))
            parser.close()
        except Exception as exc:  # HTMLParser errors are uncommon but actionable.
            errors.append(f"{page.relative_to(ROOT)}: parse error: {exc}")
        parsed[page.resolve()] = parser

        duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
        if duplicates:
            errors.append(f"{page.relative_to(ROOT)}: duplicate ids: {', '.join(duplicates)}")
        if parser.images_without_alt:
            errors.append(f"{page.relative_to(ROOT)}: images without alt at lines {parser.images_without_alt}")
        if parser.headings and parser.headings[0] != 1:
            errors.append(f"{page.relative_to(ROOT)}: first heading is h{parser.headings[0]}, expected h1")
        for previous, current in zip(parser.headings, parser.headings[1:]):
            if current > previous + 1:
                errors.append(f"{page.relative_to(ROOT)}: heading jumps h{previous} to h{current}")

    for page, parser in parsed.items():
        for reference, tag in parser.refs:
            result = local_target(page, reference)
            if result is None:
                continue
            target, fragment = result
            if not target.exists():
                errors.append(f"{page.relative_to(ROOT)}: missing {tag} target {reference}")
                continue
            if fragment:
                target_page = target
                if target_page.is_dir():
                    target_page /= "index.html"
                target_parser = parsed.get(target_page.resolve())
                if target_parser is None and target_page.suffix == ".html":
                    target_parser = PageParser(target_page)
                    target_parser.feed(target_page.read_text(encoding="utf-8"))
                if target_parser and fragment not in target_parser.ids:
                    errors.append(f"{page.relative_to(ROOT)}: missing fragment #{fragment} in {target_page.relative_to(ROOT)}")

    required = [
        "index.html", "404.html", "about.html", "contacts.html", "cv.html",
        "robots.txt", "sitemap.xml", "site.webmanifest",
        "assets/css/site.css", "assets/js/site.js", "assets/images/favicon.svg",
    ]
    for relative in required:
        if not (PUBLIC / relative).is_file():
            errors.append(f"missing required file: public/{relative}")

    try:
        json.loads((PUBLIC / "site.webmanifest").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"public/site.webmanifest: invalid JSON: {exc}")

    if errors:
        print("Static validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Static validation passed: {len(HTML_FILES)} HTML pages, all local references resolved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
