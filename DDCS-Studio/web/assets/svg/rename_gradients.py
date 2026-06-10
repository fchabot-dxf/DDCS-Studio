#!/usr/bin/env python3
"""
Rename SVG gradient IDs (linearGradient/radialGradient) using filename prefixes.

Why:
- Prevent cross-file ID collisions when multiple SVGs are injected into one DOM.
- Keep in-file sharing intact (multiple elements can still reference one gradient).

Behavior:
- Renames only gradient definition IDs.
- Updates references: url(#id), href="#id", xlink:href="#id".
- Uses deterministic naming: <file_stem>__<old_id>.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


GRADIENT_TAG_RE = re.compile(
    r"<(?P<tag>(?:\w+:)?(?:linearGradient|radialGradient))\b(?P<attrs>[^>]*)>",
    flags=re.IGNORECASE,
)
ID_ATTR_RE = re.compile(r"\bid\s*=\s*(['\"])(?P<id>.*?)\1", flags=re.IGNORECASE)


def sanitize_prefix(name: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9_-]", "_", name)
    return sanitized or "svg"


def collect_existing_ids(content: str) -> set[str]:
    ids = set()
    for match in re.finditer(r"\bid\s*=\s*(['\"])(.*?)\1", content, flags=re.IGNORECASE):
        ids.add(match.group(2))
    return ids


def build_gradient_map(content: str, prefix: str) -> dict[str, str]:
    existing_ids = collect_existing_ids(content)
    mapping: dict[str, str] = {}
    used_targets = set()

    for tag_match in GRADIENT_TAG_RE.finditer(content):
        attrs = tag_match.group("attrs")
        id_match = ID_ATTR_RE.search(attrs)
        if not id_match:
            continue

        old_id = id_match.group("id")
        if old_id in mapping:
            continue

        base_target = old_id
        expected_prefix = f"{prefix}__"
        if not old_id.startswith(expected_prefix):
            base_target = f"{prefix}__{old_id}"

        target = base_target
        suffix = 2
        while target in existing_ids and target != old_id:
            target = f"{base_target}__{suffix}"
            suffix += 1

        while target in used_targets and target != old_id:
            target = f"{base_target}__{suffix}"
            suffix += 1

        mapping[old_id] = target
        used_targets.add(target)

    return mapping


def rewrite_gradient_ids(content: str, mapping: dict[str, str]) -> str:
    def replace_tag(tag_match: re.Match) -> str:
        tag = tag_match.group(0)
        attrs = tag_match.group("attrs")
        id_match = ID_ATTR_RE.search(attrs)
        if not id_match:
            return tag

        old_id = id_match.group("id")
        new_id = mapping.get(old_id, old_id)
        if new_id == old_id:
            return tag

        quote = id_match.group(1)
        start, end = id_match.span()
        replacement = f"id={quote}{new_id}{quote}"
        new_attrs = attrs[:start] + replacement + attrs[end:]
        return f"<{tag_match.group('tag')}{new_attrs}>"

    return GRADIENT_TAG_RE.sub(replace_tag, content)


def rewrite_references(content: str, mapping: dict[str, str]) -> str:
    for old_id, new_id in mapping.items():
        if old_id == new_id:
            continue

        old_esc = re.escape(old_id)

        content = re.sub(rf"url\(#{old_esc}\)", f"url(#{new_id})", content)
        content = re.sub(
            rf"\b((?:xlink:)?href\s*=\s*['\"])#{old_esc}(['\"])",
            rf"\1#{new_id}\2",
            content,
            flags=re.IGNORECASE,
        )

    return content


def process_file(svg_path: Path, dry_run: bool, backup: bool) -> tuple[bool, int]:
    content = svg_path.read_text(encoding="utf-8")
    prefix = sanitize_prefix(svg_path.stem)
    mapping = build_gradient_map(content, prefix)

    if not mapping:
        return False, 0

    updated = rewrite_gradient_ids(content, mapping)
    updated = rewrite_references(updated, mapping)

    changed_count = sum(1 for old, new in mapping.items() if old != new)
    if updated == content or changed_count == 0:
        return False, 0

    if dry_run:
        return True, changed_count

    if backup:
        backup_path = svg_path.with_suffix(svg_path.suffix + ".bak")
        backup_path.write_text(content, encoding="utf-8")

    svg_path.write_text(updated, encoding="utf-8")
    return True, changed_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Rename SVG gradient IDs using filename prefixes.")
    parser.add_argument(
        "--dir",
        dest="directory",
        default=str(Path(__file__).resolve().parent),
        help="Directory containing SVG files (default: script directory).",
    )
    parser.add_argument(
        "--pattern",
        default="*.svg",
        help="Glob pattern for target files (default: *.svg).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing files.")
    parser.add_argument("--backup", action="store_true", help="Write <file>.svg.bak before modifying.")
    args = parser.parse_args()

    target_dir = Path(args.directory).resolve()
    if not target_dir.exists() or not target_dir.is_dir():
        print(f"Directory not found: {target_dir}")
        return 1

    files = sorted(target_dir.glob(args.pattern))
    if not files:
        print(f"No files matched pattern '{args.pattern}' in {target_dir}")
        return 0

    changed_files = 0
    total_renames = 0

    for svg_path in files:
        if not svg_path.is_file():
            continue

        changed, count = process_file(svg_path, dry_run=args.dry_run, backup=args.backup)
        if changed:
            changed_files += 1
            total_renames += count
            mode = "DRY-RUN" if args.dry_run else "UPDATED"
            print(f"[{mode}] {svg_path.name}: {count} gradient id(s) renamed")
        else:
            print(f"[SKIP] {svg_path.name}: no gradient rename needed")

    print(f"\nDone. Files changed: {changed_files}, gradient IDs renamed: {total_renames}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
