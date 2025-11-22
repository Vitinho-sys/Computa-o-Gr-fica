# app.py
import os
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, url_for
from werkzeug.utils import secure_filename
from PIL import Image, ImageOps
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# --- Configuration ---
BASE_DIR = Path(__file__).parent.resolve()
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
for d in (UPLOAD_DIR, OUTPUT_DIR):
    d.mkdir(exist_ok=True)

ALLOWED_EXT = {"png", "jpg", "jpeg", "bmp"}

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB


def allowed_filename(filename):
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in ALLOWED_EXT


def human_readable(n):
    for unit in ("B","KB","MB","GB"):
        if n < 1024:
            return f"{n:.2f} {unit}"
        n /= 1024
    return f"{n:.2f} TB"


def analyze_image(pil_img, file_path=None):
    w, h = pil_img.size
    mode = pil_img.mode
    bands = pil_img.getbands()
    channels = len(bands)
    # assume 8 bits per channel for typical modes
    bits_per_channel = 8
    bpp = bits_per_channel * channels
    size_in_memory = int(w * h * channels * (bits_per_channel / 8))
    file_size = None
    if file_path and os.path.exists(file_path):
        file_size = os.path.getsize(file_path)
    return {
        "mode": mode,
        "bands": bands,
        "channels": channels,
        "bits_per_channel": bits_per_channel,
        "bits_per_pixel": bpp,
        "dimensions": (w, h),
        "size_in_memory_bytes": size_in_memory,
        "file_size_bytes": file_size
    }


def compute_histograms_and_stats(pil_img, out_prefix):
    arr = np.array(pil_img.convert("RGB"))
    stats = {}
    hist_paths = {}
    for i, ch in enumerate(["R","G","B"]):
        channel = arr[:, :, i].ravel()
        minv = int(channel.min())
        maxv = int(channel.max())
        meanv = float(channel.mean())
        medianv = float(np.median(channel))
        stdv = float(channel.std())
        stats[ch] = {"min": minv, "max": maxv, "mean": round(meanv, 3),
                     "median": round(medianv, 3), "std": round(stdv, 3)}
        # histogram plot
        fig = plt.figure(figsize=(4, 2.2), dpi=100)
        plt.hist(channel, bins=256, range=(0,255), color=ch.lower())
        plt.title(f"Histograma {ch}")
        plt.xlabel("Valor")
        plt.ylabel("Frequência")
        plt.tight_layout()
        out_path = OUTPUT_DIR / f"{out_prefix}_hist_{ch}.png"
        fig.savefig(out_path)
        plt.close(fig)
        hist_paths[ch] = str(out_path.name)
    return stats, hist_paths


# --- Routes ---

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "Nome de arquivo vazio"}), 400
    if not allowed_filename(f.filename):
        return jsonify({"error": "Formato não permitido"}), 400
    filename = secure_filename(f.filename)
    save_path = UPLOAD_DIR / filename
    f.save(save_path)
    # load image, basic info
    img = Image.open(save_path)
    w, h = img.size
    size = os.path.getsize(save_path)
    info = {
        "filename": filename,
        "width": w,
        "height": h,
        "size_bytes": size,
        "size_human": human_readable(size),
        "url": url_for("uploaded_file", filename=filename)
    }
    return jsonify(info)


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/outputs/<path:filename>")
def output_file(filename):
    return send_from_directory(OUTPUT_DIR, filename)


@app.route("/process", methods=["POST"])
def process():
    """
    Expects JSON or form with:
    - filename: uploaded file name (in uploads/)
    - op: operation — one of: reduce, webp, mirror, gray, analyse
    - params: optional, e.g. scale for reduce
    """
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Sem dados JSON"}), 400
    filename = data.get("filename")
    op = data.get("op")
    params = data.get("params", {})
    if not filename:
        return jsonify({"error": "filename required"}), 400
    src_path = UPLOAD_DIR / filename
    if not src_path.exists():
        return jsonify({"error": "Arquivo não encontrado"}), 404

    img = Image.open(src_path).convert("RGBA")

    result = {"op": op, "outputs": {}}

    if op == "reduce":
        scale = float(params.get("scale", 0.5))
        w, h = img.size
        nw = max(1, int(w * scale))
        nh = max(1, int(h * scale))
        out = img.resize((nw, nh), Image.LANCZOS)
        out_name = f"{Path(filename).stem}_reduced_{int(scale*100)}.png"
        out_path = OUTPUT_DIR / out_name
        out.save(out_path)
        result["outputs"]["image"] = out_name
        result["outputs"]["dimensions"] = (nw, nh)

    elif op == "webp":
        # save webp and report sizes
        out_name = f"{Path(filename).stem}.webp"
        out_path = OUTPUT_DIR / out_name
        rgb = img.convert("RGB")
        rgb.save(out_path, "WEBP", quality=90)
        orig_size = os.path.getsize(src_path)
        new_size = os.path.getsize(out_path)
        result["outputs"]["image"] = out_name
        result["outputs"]["size_before"] = orig_size
        result["outputs"]["size_after"] = new_size
        result["outputs"]["size_before_human"] = human_readable(orig_size)
        result["outputs"]["size_after_human"] = human_readable(new_size)

    elif op == "mirror":
        mirrored = ImageOps.flip(img)  # flip vertically
        out_name = f"{Path(filename).stem}_mirrored.png"
        out_path = OUTPUT_DIR / out_name
        mirrored.save(out_path)
        result["outputs"]["image"] = out_name

    elif op == "gray":
        gray = ImageOps.grayscale(img)
        out_name = f"{Path(filename).stem}_gray.png"
        out_path = OUTPUT_DIR / out_name
        gray.save(out_path)
        result["outputs"]["image"] = out_name

    elif op == "analyse":
        # compute histograms & stats + image structure
        stats, hist_paths = compute_histograms_and_stats(img, Path(filename).stem)
        struct = analyze_image(img, src_path)
        result["outputs"]["hist_stats"] = stats
        result["outputs"]["hist_images"] = hist_paths
        result["outputs"]["structure"] = struct

    else:
        return jsonify({"error": "Operação desconhecida"}), 400

    return jsonify(result)


@app.route("/report/<filename>", methods=["GET"])
def download_report(filename):
    """
    Generates a text report combining analysis for an uploaded image and returns it.
    """
    src = UPLOAD_DIR / filename
    if not src.exists():
        return "Arquivo não encontrado", 404
    img = Image.open(src).convert("RGB")
    stats, hist_paths = compute_histograms_and_stats(img, Path(filename).stem)
    struct = analyze_image(img, src)
    # simple textual report
    report_lines = []
    report_lines.append("RELATÓRIO - COMPUTAÇÃO GRÁFICA\n")
    report_lines.append(f"Arquivo: {filename}\n")
    report_lines.append(f"Dimensões: {struct['dimensions'][0]} x {struct['dimensions'][1]}\n")
    report_lines.append(f"Modo: {struct['mode']} - Canais: {struct['channels']}\n")
    report_lines.append("\n=== Estatísticas por canal ===\n")
    for ch in ("R","G","B"):
        s = stats[ch]
        report_lines.append(f"{ch}: min={s['min']}, max={s['max']}, mean={s['mean']}, median={s['median']}, std={s['std']}\n")
    report_text = "\n".join(report_lines)
    # save to outputs and serve
    rpt_name = f"{Path(filename).stem}_report.txt"
    rpt_path = OUTPUT_DIR / rpt_name
    with open(rpt_path, "w", encoding="utf-8") as fh:
        fh.write(report_text)
    return send_from_directory(OUTPUT_DIR, rpt_name, as_attachment=True)


if __name__ == "__main__":
    app.run(debug=True)
