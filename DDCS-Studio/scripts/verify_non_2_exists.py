# verify_non_2_exists.py
"""
For each ID in the provided Markdown list (excluding _2axis), check if the same ID without the _2 exists in the SVG file.
Outputs a Markdown report with the result for each ID.
Usage:
    python verify_non_2_exists.py <svg_file> <id_list_md> <output_md>
"""
import sys
import xml.etree.ElementTree as ET
import re

def extract_ids(svg_file):
    tree = ET.parse(svg_file)
    root = tree.getroot()
    ids = set()
    for elem in root.iter():
        id_attr = elem.attrib.get('id')
        if id_attr:
            ids.add(id_attr)
    return ids

def extract_2_ids(md_file):
    ids = []
    with open(md_file, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'- (\S+)', line)
            if m:
                ids.append(m.group(1))
    return ids

def main():
    if len(sys.argv) != 4:
        print('Usage: python verify_non_2_exists.py <svg_file> <id_list_md> <output_md>')
        sys.exit(1)
    svg_file, id_list_md, output_md = sys.argv[1:4]
    svg_ids = extract_ids(svg_file)
    ids_2 = extract_2_ids(id_list_md)
    with open(output_md, 'w', encoding='utf-8') as f:
        f.write('# _2 IDs and non-_2 existence check\n\n')
        f.write('| _2 ID | non-_2 exists? |\n')
        f.write('|-------|:--------------:|\n')
        for id2 in ids_2:
            id_base = id2.replace('_2', '', 1)
            exists = id_base in svg_ids
            f.write(f'| {id2} | {"✅" if exists else "❌"} |\n')
    print(f'Checked {len(ids_2)} IDs. Report written to {output_md}')

if __name__ == '__main__':
    main()
