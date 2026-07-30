import fitz
import sys

def search_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    with open('c:/Users/danse/APPS/ddcs-studio-project/scratch/centroid_vars_full.txt', 'w', encoding='utf-8') as f:
        # 197 is page 198
        for i in range(197, 210):
            if i < len(doc):
                f.write(f"\n--- PAGE {i+1} ---\n")
                f.write(doc[i].get_text())
            
if __name__ == '__main__':
    search_pdf(sys.argv[1])
