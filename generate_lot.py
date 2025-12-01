import os

# CONFIGURATION
EXTENSIONS = {".png", ".jpg", ".jpeg", ".mp4", ".webm", ".gif"}
EXCLUDED_FILES = {"icon.png", "icon_512.png"}  # Files to explicitly ignore
OUTPUT_FILE = "lot.csv"

def generate_csv():
    # Get all files in current directory
    files = [f for f in os.listdir('.') if os.path.isfile(f)]
    
    # Filter for valid extensions AND ensure it's not in the excluded list
    valid_files = [
        f for f in files 
        if os.path.splitext(f)[1].lower() in EXTENSIONS 
        and f.lower() not in EXCLUDED_FILES
    ]

    # Sort files (Newest first)
    try:
        valid_files.sort(key=lambda x: int(''.join(filter(str.isdigit, x))), reverse=True)
    except:
        valid_files.sort(reverse=True)

    # Write to CSV
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("Filename\n")
        for filename in valid_files:
            f.write(f"{filename}\n")

    print(f"Success! {len(valid_files)} files indexed in {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_csv()