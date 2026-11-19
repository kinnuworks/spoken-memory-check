"""Fills the official deck template with docs/DECK_CONTENT.md, slide by slide.

Each "## N. Title" section goes onto template slide N, under the slide's own heading. Team details
({team}, {members}, {capability}, {coi}, {repo}) come from a JSON file kept outside the repo. Slide 1
fills the template's own "Team Name / Team Size / Problem Statement" box, slide 2 its members table,
and slide 4 gets the workflow diagram. A placeholder left unfilled stops the run.

usage: external/tts-venv/bin/python -I scripts/fill_deck.py <template.pptx> <team.json> <out.pptx> [font-pt]
then:  soffice --headless --convert-to pdf --outdir <dir> <out.pptx>
"""
import json
import re
import sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Emu, Inches, Pt

INK = RGBColor(0x2B, 0x27, 0x24)
FONT = "Arial"


def sections(path):
    text = open(path, encoding="utf-8").read()
    return {int(m.group(1)): m.group(2).strip()
            for m in re.finditer(r"^## (\d+)\. [^\n]*\n(.*?)(?=^## \d+\. |\Z)", text, re.S | re.M)}


def style(run, size, bold=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = INK


def write(tf, text, size):
    """Paragraphs from text: blank lines separate blocks, "- " lines become bullets, **x** is bold."""
    tf.word_wrap = True
    first = not any(p.text for p in tf.paragraphs)
    for block in [b for b in re.split(r"\n\s*\n", text) if b.strip()]:
        for line in block.split("\n"):
            line = line.rstrip()
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            bullet = line.startswith("- ")
            body = ("•  " + line[2:]) if bullet else line
            for k, part in enumerate(re.split(r"\*\*(.+?)\*\*", body)):
                if part:
                    style(p.add_run() if k or p.runs else p.add_run(), size, bold=bool(k % 2))
                    p.runs[-1].text = part
            p.space_after = Pt(3 if bullet else 5)
        # a little air between blocks
        tf.paragraphs[-1].space_after = Pt(9)


def body_box(slide, prs, top_in=1.62, bottom_in=5.45):
    return slide.shapes.add_textbox(Inches(0.33), Inches(top_in), prs.slide_width - Inches(0.66), Inches(bottom_in - top_in))


def main():
    tpl, team_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
    size = float(sys.argv[4]) if len(sys.argv) > 4 else 10.5
    team = json.load(open(team_path, encoding="utf-8"))
    body = sections("docs/DECK_CONTENT.md")
    for n, t in list(body.items()):
        for k in ("team", "capability", "coi", "repo"):
            t = t.replace("{%s}" % k, team[k])
        body[n] = t
    prs = Presentation(tpl)
    for n, text in sorted(body.items()):
        slide = prs.slides[n - 1]
        if n == 1:
            box = next(s for s in slide.shapes if s.has_text_frame and "Team Name" in s.text_frame.text)
            tf = box.text_frame
            tf.clear()
            team_text, _, rest = text.partition("\n\n")
            write(tf, team_text, 15)
            write(tf, rest, 12)
            continue
        if n == 2:
            table = next(s for s in slide.shapes if s.has_table).table
            for r, row in enumerate(team["members"], start=1):
                for c, val in enumerate(row):
                    cell = table.cell(r, c)
                    cell.text = val
                    for p in cell.text_frame.paragraphs:
                        for run in p.runs:
                            style(run, 10)
            continue
        if n == 4:
            pic_w = prs.slide_width - Inches(0.5)
            pic = slide.shapes.add_picture("docs/images/workflow.png", Inches(0.25), Inches(1.5), width=pic_w)
            top = (pic.top + pic.height) / 914400 + 0.06
            write(body_box(slide, prs, top_in=top).text_frame, text, size)
            continue
        if n == 15:
            write(body_box(slide, prs, top_in=0.95, bottom_in=4.1).text_frame, text, size)
            continue
        write(body_box(slide, prs).text_frame, text, size)
    left = [n for n, t in body.items() if re.search(r"\{(team|members|capability|coi|repo)\}", t) and n != 2]
    if left:
        sys.exit("unfilled placeholders on slides %s" % left)
    prs.save(out)
    print("filled %d slides into %s" % (len(body), out))


if __name__ == "__main__":
    main()
