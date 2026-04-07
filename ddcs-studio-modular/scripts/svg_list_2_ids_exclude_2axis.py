"""List all IDs containing `_2` in an SVG but _exclude_ IDs where the *only* `_2` is the semantic `_2axis`.

Rules implemented:
- Include any ID that contains the substring `_2`.
- EXCLUDE an ID only when it contains exactly one `_2` occurrence and that occurrence is part of `_2axis`.

Usage:
    python svg_list_2_ids_exclude_2axis.py <input-svg> <output-md>

Writes a Markdown list to <output-md>.
"""
from lxml import etree
import sys


def should_include(idv: str) -> bool:
    # must contain at least one '_2'
    if '_2' not in idv:
        return False
    count = idv.count('_2')
    # exclude only when the sole occurrence is '_2axis'
    if count == 1 and '_2axis' in idv:
        return False
    return True


def list_2_ids(svg_path):
    tree = etree.parse(svg_path)
    root = tree.getroot()
    ids = set()
    for elem in root.iter():
        idv = elem.get('id')
        if idv and should_include(idv):
            ids.add(idv)
    return sorted(ids)


def write_md(ids, out_path):
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('# All SVG IDs containing _2 (exclude _2axis-only entries)\n\n')
        for i in ids:
            f.write(f'- {i}\n')


def main():
    if len(sys.argv) != 3:
        print('Usage: python svg_list_2_ids_exclude_2axis.py <input-svg> <output-md>')
        sys.exit(1)
    svg_path, out_md = sys.argv[1:3]
    ids = list_2_ids(svg_path)
    write_md(ids, out_md)
    print(f'Found {len(ids)} IDs with _2 (excluding _2axis-only). List written to {out_md}')


if __name__ == '__main__':
    main()
