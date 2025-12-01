import os

# CONFIGURATION
EXTENSIONS = {".png", ".jpg", ".jpeg", ".mp4", ".webm", ".gif"}
OUTPUT_FILE = "lot.csv"

def generate_csv():
    # Get all files in current directory
    files = [f for f in os.listdir('.') if os.path.isfile(f)]
    
    # Filter for valid extensions and exclude the script/html itself
    valid_files = [f for f in files if os.path.splitext(f)[1].lower() in EXTENSIONS]

    # Sort files (assuming format Q000001, Q000002...)
    # We sort strictly by the number in the filename for accuracy
    try:
        valid_files.sort(key=lambda x: int(''.join(filter(str.isdigit, x))), reverse=True)
    except:
        # Fallback to standard alphabetical sort if numbering isn't consistent
        valid_files.sort(reverse=True)

    # Write to CSV
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("Filename\n")
        for filename in valid_files:
            f.write(f"{filename}\n")

    print(f"Success! {len(valid_files)} files written to {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_csv()