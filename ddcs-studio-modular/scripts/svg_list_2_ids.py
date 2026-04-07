# svg_list_2_ids.py
"""
Usage:
    python svg_list_2_ids.py ../src/assets/middleViz.svg ../docs/middleViz_2_ids.md

This script scans the SVG file and outputs a Markdown list of all group and path IDs containing '_2'.
"""
import sys
import xml.etree.ElementTree as ET

def find_2_ids(elem, results):
    id_attr = elem.attrib.get('id')
    if id_attr and '_2' in id_attr and '_2axis' not in id_attr:
        results.append(id_attr)
    for child in elem:
        find_2_ids(child, results)

def main():
    if len(sys.argv) != 3:
        print('Usage: python svg_list_2_ids.py <input-svg> <output-md>')
        sys.exit(1)
    input_svg, output_md = sys.argv[1:3]
    tree = ET.parse(input_svg)
    root = tree.getroot()
    results = []
    find_2_ids(root, results)
    results.sort()
    with open(output_md, 'w', encoding='utf-8') as f:
        f.write('# All SVG IDs containing _2\n\n')
        for id_val in results:
            f.write(f'- {id_val}\n')
    print(f'Found {len(results)} IDs with _2. List written to {output_md}')

if __name__ == '__main__':
    main()
