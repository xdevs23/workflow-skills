#!/usr/bin/env python3
"""Print a unified diff of two text files as an HTML table for a draft page.

Run as `diff-table.py <old> <new> [--title <text>]`. Deleted lines are red and added lines green.
A changed line comes right under the line it replaces, with the changed words highlighted darker
inside both lines. The output is one standalone fragment: a <style> element scoped to the class
`diff-table`, then the table.
"""

import argparse
import difflib
import platform
import re
import sys
import xml.etree.ElementTree as ET
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

if sys.version_info < (3, 10):
    sys.exit(f"diff-table: Python {platform.python_version()} is older than 3.10, the first "
             "release with union types written as X | Y; run diff-table with Python 3.10 or later")

# Unchanged lines shown around each change, as many as git and GNU diff show by default.
CONTEXT_LINES = 3

TOKEN = re.compile(r"\s+|\w+|[^\w\s]")


@dataclass(frozen=True)
class Segment:
    """A run of text in a line, and whether the paired line differs there."""
    text: str
    changed: bool


@dataclass(frozen=True)
class ContextRow:
    old_number: int
    new_number: int
    segments: Sequence[Segment]


@dataclass(frozen=True)
class DeletedRow:
    old_number: int
    segments: Sequence[Segment]


@dataclass(frozen=True)
class AddedRow:
    new_number: int
    segments: Sequence[Segment]


Row = ContextRow | DeletedRow | AddedRow


@dataclass(frozen=True)
class Hunk:
    old_start: int
    old_count: int
    new_start: int
    new_count: int
    rows: Sequence[Row]

    @property
    def header(self) -> str:
        old_range = range_text(self.old_start, self.old_count)
        new_range = range_text(self.new_start, self.new_count)
        return f"@@ -{old_range} +{new_range} @@"


def range_text(start: int, count: int) -> str:
    # GNU diff manual, "Detailed Description of Unified Format": an empty range is numbered by
    # the line before it, so a file diffed against an empty one starts at `-0,0`.
    # https://www.gnu.org/software/diffutils/manual/html_node/Detailed-Unified.html
    return f"{start - 1 if count == 0 else start},{count}"


def tokens_of(line: str) -> list[str]:
    return TOKEN.findall(line)


def words_of(tokens: Sequence[str]) -> list[str]:
    return [token for token in tokens if not token.isspace()]


def similarity(old_words: Sequence[str], new_words: Sequence[str]) -> float:
    return difflib.SequenceMatcher(None, old_words, new_words, autojunk=False).ratio()


def unchanged(line: str) -> list[Segment]:
    return [Segment(line, changed=False)]


def segments_of_pair(
    old_tokens: Sequence[str], new_tokens: Sequence[str]
) -> tuple[list[Segment], list[Segment]]:
    """Both lines of a changed pair, split into the runs of tokens that match and that differ."""
    matcher = difflib.SequenceMatcher(None, old_tokens, new_tokens, autojunk=False)
    old_segments, new_segments = [], []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        old_segments.append(Segment("".join(old_tokens[i1:i2]), changed=tag != "equal"))
        new_segments.append(Segment("".join(new_tokens[j1:j2]), changed=tag != "equal"))
    return join_changed_phrases(old_segments), join_changed_phrases(new_segments)


def join_changed_phrases(segments: Sequence[Segment]) -> list[Segment]:
    """Marks white space between two changed runs as changed, then merges neighbouring runs of the
    same kind, so one highlight covers each changed phrase."""
    present = [segment for segment in segments if segment.text]
    marked = [
        Segment(segment.text, changed=True)
        if 0 < index < len(present) - 1
        and segment.text.isspace()
        and present[index - 1].changed
        and present[index + 1].changed
        else segment
        for index, segment in enumerate(present)
    ]
    merged: list[Segment] = []
    for segment in marked:
        if merged and merged[-1].changed == segment.changed:
            merged[-1] = Segment(merged[-1].text + segment.text, segment.changed)
        else:
            merged.append(segment)
    return merged


def pair_lines(
    old_words: Sequence[Sequence[str]], new_words: Sequence[Sequence[str]]
) -> dict[int, int]:
    """Pairs deleted and added lines, most similar pair first, scored over the words of both lines,
    until every line of the shorter side has a pair. Of two equally similar pairs, the one with the
    earlier deleted line wins, then the one with the earlier added line."""
    candidates = sorted(
        (
            (old_index, new_index)
            for old_index in range(len(old_words))
            for new_index in range(len(new_words))
        ),
        key=lambda pair: (-similarity(old_words[pair[0]], new_words[pair[1]]), pair),
    )
    pairs: dict[int, int] = {}
    taken: set[int] = set()
    for old_index, new_index in candidates:
        if old_index not in pairs and new_index not in taken:
            pairs[old_index] = new_index
            taken.add(new_index)
    return pairs


def replaced_rows(
    old_lines: Sequence[str], new_lines: Sequence[str], old_first: int, new_first: int
) -> Iterator[Row]:
    """Rows for deleted lines replaced by added lines. Each added line paired with a deleted line
    comes right under it, followed by the unpaired added lines that come after it. Unpaired added
    lines ahead of every paired one come last."""
    old_tokens = [tokens_of(line) for line in old_lines]
    new_tokens = [tokens_of(line) for line in new_lines]
    pairs = pair_lines([words_of(tokens) for tokens in old_tokens],
                       [words_of(tokens) for tokens in new_tokens])
    anchors = sorted(pairs.values())
    following = {anchor: range(anchor + 1, next_anchor)
                 for anchor, next_anchor in zip(anchors, [*anchors[1:], len(new_lines)])}

    def unpaired_added(indexes: Iterable[int]) -> Iterator[AddedRow]:
        return (AddedRow(new_first + j, unchanged(new_lines[j])) for j in indexes)

    for old_index, old_line in enumerate(old_lines):
        if (new_index := pairs.get(old_index)) is None:
            yield DeletedRow(old_first + old_index, unchanged(old_line))
            continue
        old_segments, new_segments = segments_of_pair(old_tokens[old_index], new_tokens[new_index])
        yield DeletedRow(old_first + old_index, old_segments)
        yield AddedRow(new_first + new_index, new_segments)
        yield from unpaired_added(following[new_index])
    yield from unpaired_added(range(min(anchors, default=len(new_lines))))


def hunks_of(old_lines: Sequence[str], new_lines: Sequence[str]) -> Iterator[Hunk]:
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False)
    for group in matcher.get_grouped_opcodes(CONTEXT_LINES):
        rows: list[Row] = []
        for tag, i1, i2, j1, j2 in group:
            if tag == "equal":
                rows += [
                    ContextRow(i + 1, j + 1, unchanged(old_lines[i]))
                    for i, j in zip(range(i1, i2), range(j1, j2))
                ]
            else:
                rows += replaced_rows(old_lines[i1:i2], new_lines[j1:j2], i1 + 1, j1 + 1)
        (_, old_start, _, new_start, _), (_, _, old_end, _, new_end) = group[0], group[-1]
        yield Hunk(old_start + 1, old_end - old_start, new_start + 1, new_end - new_start, rows)


class CssClass(Enum):
    TABLE = "diff-table"
    TITLE = "title"
    HUNK = "hunk"
    CONTEXT = "context"
    DELETED = "deleted"
    ADDED = "added"
    NUMBER = "number"
    SIGN = "sign"
    CHANGED = "changed"

    def __str__(self) -> str:
        return self.value


STYLE = f"""
.{CssClass.TABLE} {{ background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
  overflow: hidden; font: 13px/1.5 ui-monospace, monospace; color: #c9d1d9; }}
.{CssClass.TABLE} .{CssClass.TITLE} {{ background: #161b22; border-bottom: 1px solid #30363d;
  padding: 8px 12px; }}
.{CssClass.TABLE} table {{ border-collapse: collapse; width: 100%; font: inherit; color: inherit; }}
.{CssClass.TABLE} td {{ padding: 0 8px; white-space: pre-wrap; vertical-align: top; }}
.{CssClass.TABLE} td.{CssClass.NUMBER} {{ width: 1%; text-align: right; color: #6e7681;
  user-select: none; }}
.{CssClass.TABLE} td.{CssClass.SIGN} {{ width: 1%; color: #8b949e; user-select: none; }}
.{CssClass.TABLE} tr.{CssClass.HUNK} td {{ background: rgba(56, 139, 253, 0.10); color: #8b949e; }}
.{CssClass.TABLE} tr.{CssClass.DELETED} td {{ background: rgba(248, 81, 73, 0.15); }}
.{CssClass.TABLE} tr.{CssClass.DELETED} td.{CssClass.NUMBER} {{
  background: rgba(248, 81, 73, 0.25); }}
.{CssClass.TABLE} tr.{CssClass.ADDED} td {{ background: rgba(46, 160, 67, 0.15); }}
.{CssClass.TABLE} tr.{CssClass.ADDED} td.{CssClass.NUMBER} {{
  background: rgba(46, 160, 67, 0.25); }}
.{CssClass.TABLE} tr.{CssClass.DELETED} .{CssClass.CHANGED} {{
  background: rgba(248, 81, 73, 0.45); border-radius: 3px; }}
.{CssClass.TABLE} tr.{CssClass.ADDED} .{CssClass.CHANGED} {{
  background: rgba(46, 160, 67, 0.45); border-radius: 3px; }}
"""


def add_cell(row: ET.Element, css_class: CssClass | None, text: str) -> ET.Element:
    cell = ET.SubElement(row, "td", {} if css_class is None else {"class": css_class.value})
    cell.text = text
    return cell


def add_line_cell(row: ET.Element, segments: Sequence[Segment]) -> None:
    cell = add_cell(row, None, "")
    last: ET.Element | None = None
    for segment in segments:
        if segment.changed:
            last = ET.SubElement(cell, "span", {"class": CssClass.CHANGED.value})
            last.text = segment.text
        elif last is None:
            cell.text = (cell.text or "") + segment.text
        else:
            last.tail = (last.tail or "") + segment.text


def add_table_row(
    table: ET.Element,
    css_class: CssClass,
    old_number: int | None,
    new_number: int | None,
    sign: str,
    segments: Sequence[Segment],
) -> None:
    line = ET.SubElement(table, "tr", {"class": css_class.value})
    add_cell(line, CssClass.NUMBER, "" if old_number is None else str(old_number))
    add_cell(line, CssClass.NUMBER, "" if new_number is None else str(new_number))
    add_cell(line, CssClass.SIGN, sign)
    add_line_cell(line, segments)


def add_diff_row(table: ET.Element, row: Row) -> None:
    # isinstance in place of match, so that Python before 3.10 parses the file and reaches the
    # version check.
    if isinstance(row, ContextRow):
        add_table_row(table, CssClass.CONTEXT, old_number=row.old_number,
                      new_number=row.new_number, sign="", segments=row.segments)
    elif isinstance(row, DeletedRow):
        add_table_row(table, CssClass.DELETED, old_number=row.old_number, new_number=None,
                      sign="-", segments=row.segments)
    else:
        add_table_row(table, CssClass.ADDED, old_number=None, new_number=row.new_number,
                      sign="+", segments=row.segments)


def build_diff_table(hunks: Sequence[Hunk], title: str | None) -> ET.Element:
    root = ET.Element("div", {"class": CssClass.TABLE.value})
    if title is not None:
        ET.SubElement(root, "div", {"class": CssClass.TITLE.value}).text = title
    table = ET.SubElement(root, "table")
    for hunk in hunks:
        header = ET.SubElement(table, "tr", {"class": CssClass.HUNK.value})
        for css_class in (CssClass.NUMBER, CssClass.NUMBER, CssClass.SIGN):
            add_cell(header, css_class, "")
        add_cell(header, None, hunk.header)
        for row in hunk.rows:
            add_diff_row(table, row)
    return root


def render_fragment(table: ET.Element) -> str:
    style = ET.Element("style")
    style.text = STYLE
    return "\n".join(ET.tostring(element, encoding="unicode", method="html")
                     for element in (style, table))


def read_lines(parser: argparse.ArgumentParser, path: Path) -> list[str]:
    try:
        return path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as error:
        parser.error(f"cannot read {path}: {error}; pass two UTF-8 text files")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("old", type=Path, help="text before the change")
    parser.add_argument("new", type=Path, help="text after the change")
    parser.add_argument("--title", help="line above the table, such as the file path")
    arguments = parser.parse_args()
    hunks = list(hunks_of(read_lines(parser, arguments.old), read_lines(parser, arguments.new)))
    if not hunks:
        sys.exit(f"diff-table: {arguments.old} and {arguments.new} have the same lines, "
                 "so there is no diff to show")
    sys.stdout.reconfigure(encoding="utf-8")
    print(render_fragment(build_diff_table(hunks, arguments.title)))


if __name__ == "__main__":
    main()
