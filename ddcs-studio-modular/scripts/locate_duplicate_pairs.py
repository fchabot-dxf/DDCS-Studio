#!/usr/bin/env python
"""
Locate and compare _2 duplicate pairs in SVG.

For each ID marked ✅ (duplicate exists), show the exact location of both:
- The _2 version
- The non-_2 version

Output includes element type, line number, and parent hierarchy.

Usage:
    python locate_duplicate_pairs.py <svg_file> <check_md> <output_md>
"""

import sys
import re
from lxml import etree


def parse_duplicates(check_md):
    """Parse check file and return list of _2 IDs marked ✅ (duplicates)."""
    duplicates = []
    with open(check_md, 'r', encoding='utf-8') as f:
        for line in f:
            # Match table rows: | id | ✅ |
            m = re.match(r'^\|\s*([^|]+?)\s*\|\s*✅\s*\|', line)
            if m:
                id_2 = m.group(1).strip()
                duplicates.append(id_2)
    return duplicates


def get_non_2_version(id_2):
    """Convert _2 ID to its non-_2 version."""
    if id_2.endswith('_2'):
        return id_2[:-2]
    # Replace first occurrence of _2_
    return id_2.replace('_2_', '_', 1)


def get_parent_path(elem, root):
    """Get the parent hierarchy path for an element."""
    path = []
    current = elem.getparent()
    while current is not None and current != root:
        elem_id = current.get('id')
        tag = etree.QName(current).localname
        if elem_id:
            path.append(f"{tag}#{elem_id}")
        else:
            path.append(tag)
        current = current.getparent()
    return ' > '.join(reversed(path))


def find_element_info(svg_path, element_id):
    """Find element and return its info: (tag, line, parent_path)."""
    tree = etree.parse(svg_path)
    root = tree.getroot()

    for elem in root.iter():
        if elem.get('id') == element_id:
            tag = etree.QName(elem).localname
            line = elem.sourceline if hasattr(elem, 'sourceline') else '?'
            parent_path = get_parent_path(elem, root)
            return {
                'tag': tag,
                'line': line,
                'parent': parent_path,
                'exists': True
            }

    return {'exists': False}


def main():
    if len(sys.argv) != 4:
        print('Usage: python locate_duplicate_pairs.py <svg_file> <check_md> <output_md>')
        sys.exit(1)

    svg_file, check_md, output_md = sys.argv[1:4]

    # Parse duplicates from check file
    duplicates = parse_duplicates(check_md)
    if not duplicates:
        print('No duplicate pairs found (no ✅ entries)')
        sys.exit(0)

    print(f'Found {len(duplicates)} duplicate pairs to locate')

    # Locate both versions of each duplicate
    results = []
    for id_2 in duplicates:
        id_base = get_non_2_version(id_2)

        info_2 = find_element_info(svg_file, id_2)
        info_base = find_element_info(svg_file, id_base)

        results.append({
            'id_2': id_2,
            'id_base': id_base,
            'info_2': info_2,
            'info_base': info_base
        })

    # Write output
    with open(output_md, 'w', encoding='utf-8') as f:
        f.write('# Duplicate _2 ID Pairs - Location Comparison\n\n')
        f.write('Shows the exact location of both the `_2` and non-`_2` versions.\n\n')

        for i, result in enumerate(results, 1):
            f.write(f'## {i}. Duplicate Pair\n\n')

            # _2 version
            f.write(f'### `{result["id_2"]}` (with _2)\n\n')
            if result['info_2']['exists']:
                f.write(f'- **Element:** `<{result["info_2"]["tag"]}>`\n')
                f.write(f'- **Line:** {result["info_2"]["line"]}\n')
                f.write(f'- **Parent path:** {result["info_2"]["parent"] or "(root)"}\n')
            else:
                f.write('- **NOT FOUND** (error: should exist)\n')

            f.write('\n')

            # non-_2 version
            f.write(f'### `{result["id_base"]}` (without _2)\n\n')
            if result['info_base']['exists']:
                f.write(f'- **Element:** `<{result["info_base"]["tag"]}>`\n')
                f.write(f'- **Line:** {result["info_base"]["line"]}\n')
                f.write(f'- **Parent path:** {result["info_base"]["parent"] or "(root)"}\n')
            else:
                f.write('- **NOT FOUND** (error: should exist)\n')

            f.write('\n---\n\n')

    print(f'Location comparison written to {output_md}')
    print(f'Analyzed {len(results)} duplicate pairs')


if __name__ == '__main__':
    main()
