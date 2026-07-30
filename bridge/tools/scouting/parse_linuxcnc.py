import re
import sys

def parse_header(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    out = []
    current_comment = ""
    current_val = None
    
    for line in lines:
        line = line.strip()
        if line.startswith('//'):
            current_comment = line[2:].strip()
        elif '=' in line and ',' in line:
            # e.g. G38_X=5061,
            parts = line.split('=')
            name = parts[0].strip()
            val_str = parts[1].split(',')[0].strip()
            current_val = int(val_str)
            out.append((current_val, "S", name.replace('_', ' '), current_comment))
        elif line.endswith(',') and not '=' in line and current_val is not None:
            # e.g. G38_Y,
            current_val += 1
            name = line.strip(',').strip()
            out.append((current_val, "S", name.replace('_', ' '), current_comment))
        elif '=' in line and not ',' in line and not line.endswith(';'):
             # e.g. RS274NGC_MAX_PARAMETERS=5602
            parts = line.split('=')
            name = parts[0].strip()
            val_str = parts[1].split(';')[0].strip()
            current_val = int(val_str)
            out.append((current_val, "S", name.replace('_', ' '), current_comment))
            
    return out

if __name__ == '__main__':
    res = parse_header(sys.argv[1])
    print("export const DEFAULT_VAR_CSV_RS274NGC = `")
    for r in res:
        print(f"{r[0]},{r[1]},{r[2]},{r[3]}")
    print("`;")
