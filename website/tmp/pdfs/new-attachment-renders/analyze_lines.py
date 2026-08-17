from PIL import Image
import sys

image = Image.open(sys.argv[1]).convert("L")
width, height = image.size
pixels = image.load()

def dark_runs_y(y, threshold=80, minimum=250):
    runs = []
    start = None
    for x in range(width):
        if pixels[x, y] < threshold:
            if start is None:
                start = x
        elif start is not None:
            if x - start >= minimum:
                runs.append((start, x - 1))
            start = None
    if start is not None and width - start >= minimum:
        runs.append((start, width - 1))
    return runs

for y in range(height):
    runs = dark_runs_y(y)
    if runs:
        print(y, runs)

print("VERTICAL")
for x in range(width):
    runs = []
    start = None
    for y in range(height):
        if pixels[x, y] < 80:
            if start is None:
                start = y
        elif start is not None:
            if y - start >= 300:
                runs.append((start, y - 1))
            start = None
    if start is not None and height - start >= 300:
        runs.append((start, height - 1))
    if runs:
        print(x, runs)
