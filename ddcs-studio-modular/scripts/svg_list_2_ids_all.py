# svg_list_2_ids_all.py
"""
Usage:
    python svg_list_2_ids_all.py <input-svg> <output-md>

List every SVG element id that contains the substring `_2` (includes `_2axis`).
Writes a Markdown list to <output-md>.
"""
import sys
import xml.etree.ElementTree as ET


def find_2_ids(elem, results):
    id_attr = elem.attrib.get('id')
    if id_attr and '_2' in id_attr:
        results.append(id_attr)
    for child in elem:
        find_2_ids(child, results)


def main():
    if len(sys.argv) != 3:
        print('Usage: python svg_list_2_ids_all.py <input-svg> <output-md>')
        sys.exit(1)
    input_svg, output_md = sys.argv[1:3]
    tree = ET.parse(input_svg)
    root = tree.getroot()
    results = []
    find_2_ids(root, results)
    results = sorted(set(results))
    with open(output_md, 'w', encoding='utf-8') as f:
        f.write('# All SVG IDs containing _2 (including _2axis)\n\n')
        for id_val in results:
            f.write(f'- {id_val}\n')
    print(f'Found {len(results)} IDs with _2 (including _2axis). List written to {output_md}')


if __name__ == '__main__':
    main()
