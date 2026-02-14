
import sys
import os

print(f"CWD: {os.getcwd()}")
print(f"sys.path: {sys.path}")

try:
    print("Importing main...")
    import main
    print(f"main imported from: {main.__file__}")
    if hasattr(main, 'app'):
        print("SUCCESS: 'app' found in main.")
        print(f"App type: {type(main.app)}")
    else:
        print("ERROR: 'app' NOT found in main.")
        print(f"Dir(main): {dir(main)}")
except Exception as e:
    print(f"Failed to import main: {e}")
    import traceback
    traceback.print_exc()
