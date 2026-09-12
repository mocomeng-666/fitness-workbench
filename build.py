#!/usr/bin/env python3
# build.py — 单文件构建：styles.css 与 data/db/engine/app.js 按序内联进 dist/index.html
# sw.js 与 manifest.webmanifest 保持独立文件；每次构建重新生成 dist。
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
JS_ORDER = ["data.js", "db.js", "engine.js", "app.js"]  # 依赖顺序固定


def main() -> int:
    html_path = SRC / "index.html"
    if not html_path.exists():
        print("ERROR: src/index.html 不存在", file=sys.stderr)
        return 1
    html = html_path.read_text(encoding="utf-8")

    # 1) 内联样式
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    html, n = re.subn(
        r'<link rel="stylesheet" href="styles\.css">',
        lambda m: "<style>\n" + css + "\n</style>",
        html,
    )
    if n != 1:
        print("ERROR: 未找到 styles.css 的 link 标签", file=sys.stderr)
        return 1

    # 2) 按依赖顺序内联脚本
    for name in JS_ORDER:
        js = (SRC / name).read_text(encoding="utf-8")
        html, n = re.subn(
            r'<script src="' + re.escape(name) + r'"></script>',
            lambda m, body=js: "<script>\n" + body + "\n</script>",
            html,
        )
        if n != 1:
            print(f"ERROR: 未找到 {name} 的 script 标签", file=sys.stderr)
            return 1

    # 3) 输出 dist
    if DIST.is_dir():
        shutil.rmtree(DIST)
    DIST.mkdir()
    (DIST / "index.html").write_text(html, encoding="utf-8")
    shutil.copy2(SRC / "sw.js", DIST / "sw.js")
    shutil.copy2(SRC / "manifest.webmanifest", DIST / "manifest.webmanifest")

    print(f"OK: dist/index.html 生成（{len(html)} 字符）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
