#!/bin/sh
# SPDX-License-Identifier: MIT
# Composite generated app screens onto the committed, reduced case renders.
# Needs ffmpeg and cwebp. Run screens.mjs first; output is public/renders.
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
SOURCE="$HERE/assets/renders"
OUT="$HERE/public/renders"
SCREENS="$HERE/public/screens"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT"

screen_on() {
    render=$1
    screen=$2
    corners=$3
    output=$4
    set -- $(echo "$corners" | tr ':' ' ')
    warp="perspective=x0=$1:y0=$2:x1=$3:y1=$4:x2=$5:y2=$6:x3=$7:y3=$8:sense=destination"
    ffmpeg -loglevel error -y \
        -i "$SOURCE/$render.webp" -i "$SCREENS/$screen.png" \
        -filter_complex "
            [1:v]scale=1600:1067:flags=neighbor,format=gbrp,$warp[screen];
            color=white:s=1596x1063,pad=1600:1067:2:2:black,format=gbrp,$warp[mask];
            [0:v]format=gbrp,split[render][base];
            [render][screen]blend=all_mode=multiply[lit];
            [base][lit][mask]maskedmerge,format=rgb24" -frames:v 1 -update 1 \
        "$WORK/$output.png"
    for width in 800 1600; do
        cwebp -quiet -q 80 -resize "$width" 0 "$WORK/$output.png" -o "$OUT/$output-$width.webp"
    done
}

# Panel corners remeasured on the 1600 x 1067 production case renders.
# Expanded by the mask's two source pixels so its inset meets the panel edges.
FRONT="422.0:242.6:1177.0:242.6:417.7:808.4:1181.3:808.4"
FRONT_LEFT="652.9:352.3:1201.8:250.6:733.0:874.4:1269.6:732.1"
FRONT_RIGHT="397.2:250.6:946.5:352.4:329.4:732.2:866.1:874.5"
screen_on front weather "$FRONT" front
screen_on front34l iss "$FRONT_LEFT" front34l
screen_on front34r stocks "$FRONT_RIGHT" front34r
for app in weather iss stocks air; do
    screen_on front "$app" "$FRONT" "hero-$app"
done
