#!/usr/bin/env python
"""
Update SVG internal references based on a rename map.

Usage:
    python update_svg_references.py <input_svg> <rename_map_md> <output_svg>

Reads a rename map (markdown table with old_id -> new_id) and updates all
internal SVG references:
  - id="old_id" → id="new_id"
  - url(#old_id) → url(#new_id)
  - clip-path="url(#old_id)" → clip-path="url(#new_id)"
  - xlink:href="#old_id" → xlink:href="#new_id"
  - href="#old_id" → href="#new_id"
"""

import sys
import re


def parse_rename_map(md_path):
    """Parse markdown rename map table and return dict of {old_id: new_id}."""
    rename_map = {}
    with open(md_path, 'r', encoding='utf-8') as f:
        for line in f:
            # Match table rows: | old_id | new_id |
            m = re.match(r'^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|', line)
            if m:
                old_id = m.group(1).strip()
                new_id = m.group(2).strip()
                # Skip header rows
                if old_id not in ('old_id', '--------', ''):
                    rename_map[old_id] = new_id
    return rename_map


def update_references(svg_content, rename_map):
    """Update all SVG references based on the rename map."""
    for old_id, new_id in rename_map.items():
        if old_id == new_id:
            continue  # Skip if no change

        # Escape special regex characters in IDs
        old_escaped = re.escape(old_id)

        # Pattern 1: id="old_id"
        svg_content = re.sub(
            r'\bid="' + old_escaped + r'"',
            f'id="{new_id}"',
            svg_content
        )

        # Pattern 2: url(#old_id)
        svg_content = re.sub(
            r'\burl\(#' + old_escaped + r'\)',
            f'url(#{new_id})',
            svg_content
        )

        # Pattern 3: xlink:href="#old_id"
        svg_content = re.sub(
            r'\bxlink:href="#' + old_escaped + r'"',
            f'xlink:href="#{new_id}"',
            svg_content
        )

        # Pattern 4: href="#old_id"
        svg_content = re.sub(
            r'\bhref="#' + old_escaped + r'"',
            f'href="#{new_id}"',
            svg_content
        )

        # Pattern 5: clip-path="url(#old_id)"
        svg_content = re.sub(
            r'\bclip-path="url\(#' + old_escaped + r'\)"',
            f'clip-path="url(#{new_id})"',
            svg_content
        )

        # Pattern 6: data-* attributes
        svg_content = re.sub(
            r'(data-[\w-]+=")\b' + old_escaped + r'\b(")',
            rf'\1{new_id}\2',
            svg_content
        )

    return svg_content


def main():
    if len(sys.argv) != 4:
        print('Usage: python update_svg_references.py <input_svg> <rename_map_md> <output_svg>')
        sys.exit(1)

    input_svg, rename_map_md, output_svg = sys.argv[1:4]

    # Parse rename map
    rename_map = parse_rename_map(rename_map_md)
    if not rename_map:
        print('Warning: No rename mappings found in', rename_map_md)
        sys.exit(0)

    print(f'Loaded {len(rename_map)} rename mappings from {rename_map_md}')

    # Read SVG
    with open(input_svg, 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # Update references
    updated_svg = update_references(svg_content, rename_map)

    # Write output
    with open(output_svg, 'w', encoding='utf-8') as f:
        f.write(updated_svg)

    print(f'Updated SVG written to {output_svg}')
    print(f'Updated {len(rename_map)} ID references')


if __name__ == '__main__':
    main()
