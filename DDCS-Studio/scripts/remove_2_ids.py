import sys
import re

# Usage: python remove_2_ids.py <svg_file> <check_file>
# Only renames _2 IDs listed in the check file (where non-_2 does NOT exist)

def get_ids_to_rename(check_file):
    ids = []
    with open(check_file, encoding='utf-8') as f:
        for line in f:
            if line.startswith('|') and '| ❌ |' in line:
                parts = line.split('|')
                id_2 = parts[1].strip()
                if id_2.endswith('_2'):
                    ids.append(id_2)
    return ids

def rename_ids(svg_file, ids_to_rename):
    with open(svg_file, encoding='utf-8') as f:
        svg = f.read()
    for id_2 in ids_to_rename:
        id_new = id_2[:-2]  # remove _2
        # Replace id="..." and xlink:href="#..." and url(#...)
        svg = re.sub(r'(id|xlink:href|url\(#)'+re.escape(id_2)+r'(\b)',
                     lambda m: m.group(1)+m.group(2 if m.lastindex==2 else 1)+id_new,
                     svg)
        # Replace data-legacy-id, data-*, and other attributes
        svg = re.sub(r'(data-[\w-]+=")'+re.escape(id_2)+r'(\b)',
                     r'\1'+id_new, svg)
    with open(svg_file, 'w', encoding='utf-8') as f:
        f.write(svg)

def main():
    if len(sys.argv) != 3:
        print('Usage: python remove_2_ids.py <svg_file> <check_file>')
        sys.exit(1)
    svg_file = sys.argv[1]
    check_file = sys.argv[2]
    ids_to_rename = get_ids_to_rename(check_file)
    rename_ids(svg_file, ids_to_rename)
    print(f'Renamed {len(ids_to_rename)} _2 IDs to unique IDs.')

if __name__ == '__main__':
    main()
