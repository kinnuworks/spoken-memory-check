"""Fills the official 15-slide deck template with docs/DECK_CONTENT.md, slide by slide.

Each "## N. Title" section of DECK_CONTENT.md goes onto slide N of the template, below what the
template already shows there. Bracketed notes such as [Team to confirm ...] stop the run, so a
placeholder can't reach the submitted PDF. LibreOffice then exports the PDF (the form takes up
to 5 MB).

usage: external/tts-venv/bin/python -I scripts/fill_deck.py <template.pptx> <out.pptx>
then:  soffice --headless --convert-to pdf --outdir <dir> <out.pptx>
"""
import re
import sys

from pptx import Presentation
from pptx.util import Emu, Pt


def sections(path):
    text = open(path, encoding="utf-8").read()
    out = {}
    for m in re.finditer(r"^## (\d+)\. [^\n]*\n(.*?)(?=^## \d+\. |\Z)", text, re.S | re.M):
        out[int(m.group(1))] = m.group(2).strip()
    return out


def free_top(slide, height):
    """The lowest bottom edge of any shape on the slide, so new text goes underneath it."""
    bottoms = [s.top + s.height for s in slide.shapes if s.top is not None and s.height is not None]
    return max(bottoms) if bottoms else Emu(int(height * 0.2))


def main():
    prs = Presentation(sys.argv[1])
    body = sections("docs/DECK_CONTENT.md")
    left = [n for n, t in body.items() if re.search(r"\[[^\]]*\]", t)]
    if left:
        sys.exit("placeholders still in DECK_CONTENT.md, sections %s" % left)
    W, H = prs.slide_width, prs.slide_height
    for n, text in sorted(body.items()):
        if n > len(prs.slides) or not text:
            continue
        slide = prs.slides[n - 1]
        top = min(free_top(slide, H) + Emu(int(H * 0.02)), Emu(int(H * 0.6)))
        box = slide.shapes.add_textbox(Emu(int(W * 0.05)), top, Emu(int(W * 0.9)), Emu(int(H * 0.95)) - top)
        tf = box.text_frame
        tf.word_wrap = True
        for i, para in enumerate(p for p in text.split("\n") if p.strip()):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = para.strip()
            for r in p.runs:
                r.font.size = Pt(12)
    prs.save(sys.argv[2])
    print("filled %d slides into %s" % (len(body), sys.argv[2]))


if __name__ == "__main__":
    main()
