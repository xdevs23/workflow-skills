#!/usr/bin/env python3
"""Draw how many diff lines between two commits went into which kind of file.

Run as `pr-lines.py <base> <head> --out <png> --fonts <directory> [--repo <directory>]
[--resvg <executable>]`, and see --help for the font files. The tool counts the diff lines with
git, gives each changed path one of six kinds through the `pr-lines` git attribute, writes the
picture to --out and prints the section "Diff lines by kind" of a pull request description.

The shared rules in pr-lines.attributes set the kind by file type and folder name. The
.gitattributes committed at <head> overrides them, and the .git/info/attributes of the clone
overrides both as a local override. The system attributes file, the attributes file named in the
configuration and the diff settings of the configuration leave the counts unchanged. resvg draws
with only the Mona Sans files of --fonts, so the picture looks the same on every machine.
"""

import argparse
import csv
import math
import os
import platform
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import deque
from collections.abc import Callable, Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from enum import Enum
from functools import cached_property
from pathlib import Path
from typing import TypeVar

if sys.version_info < (3, 10):
    sys.exit(f"pr-lines: Python {platform.python_version()} is older than 3.10, the first release "
             "with zip(strict=True); run pr-lines with Python 3.10 or later")

RULES = Path(__file__).resolve().parent / "pr-lines.attributes"
ATTRIBUTE = "pr-lines"
UNSPECIFIED = "unspecified"  # what git check-attr reports for a path without the attribute
SECTION_TITLE = "Diff lines by kind"
SHORT_ID = 7  # the length of a short commit id on GitHub
MINIMUM_GIT = (2, 40)  # the first release with --attr-source and check-attr --source
GIT_VERSION = re.compile(r"git version (\d+)\.(\d+)")
# git finds the repository from --repo alone. The configuration of the person still applies, so
# safe.directory does too, and every call replaces the attributes file named there.
REPOSITORY_VARIABLES = ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_ATTR_SOURCE")
GIT_ENVIRONMENT = {name: value for name, value in os.environ.items()
                   if name not in REPOSITORY_VARIABLES} | {"GIT_ATTR_NOSYSTEM": "1"}

FONT = "Mona Sans"
REGULAR, SEMIBOLD = 400, 600  # CSS font weights
FONT_STEMS = {REGULAR: "MonaSans-Regular", SEMIBOLD: "MonaSans-SemiBold"}
FONT_SUFFIXES = (".ttf", ".otf")
FONT_FILES = f"{' and '.join(FONT_STEMS.values())} of {FONT} as {' or '.join(FONT_SUFFIXES)} files"

UPGRADE_GIT = f"install git {'.'.join(map(str, MINIMUM_GIT))} or later"
FETCH_COMMITS = "fetch the commits into the repository, or correct the commit names"
PASS_RESVG = "install resvg, or pass its executable with --resvg"
PASS_FONTS = f"pass the directory with {FONT_FILES} with --fonts"

Record = TypeVar("Record")


class LinesError(Exception):
    """A refusal or failure, written as the problem, a semicolon and what to do about it."""


class Kind(Enum):
    """The kind of file a diff line counts as, by the value of the pr-lines attribute. The order
    of the members is the order of the kinds in the picture and in the text line."""
    CODE = "code"
    TESTS = "tests"
    ASSETS = "assets"
    TOOLING = "tooling"
    DOCS = "docs"
    OTHER = "other"


KINDS = tuple(Kind)
PERCENT = 100


@dataclass(frozen=True)
class Change:
    """A changed file. A file that git shows as binary counts as one binary file without lines."""
    path: str
    added: int
    removed: int
    binary: bool


@dataclass(frozen=True)
class Tally:
    added: int = 0
    removed: int = 0
    files: int = 0
    binary_files: int = 0

    @classmethod
    def of(cls, changes: Sequence[Change]) -> "Tally":
        return cls(added=sum(change.added for change in changes),
                   removed=sum(change.removed for change in changes),
                   files=len(changes), binary_files=sum(change.binary for change in changes))

    @property
    def lines(self) -> int:
        return self.added + self.removed


@dataclass(frozen=True)
class DiffTotals:
    """The tally of every kind in the diff from ``base`` to ``head``."""
    base: str
    head: str
    tallies: dict[Kind, Tally]

    @property
    def lines(self) -> int:
        return sum(tally.lines for tally in self.tallies.values())

    @property
    def files(self) -> int:
        return sum(tally.files for tally in self.tallies.values())

    @cached_property
    def shares(self) -> dict[Kind, int]:
        """Whole percents of the diff lines that add up to 100. Each kind gets the percent of the
        lines in it, rounded down. The percents left over go to the largest remainders, and on a
        tie to the kind that comes first."""
        total = self.lines
        if total == 0:
            return {kind: 0 for kind in KINDS}
        floors = {kind: tally.lines * PERCENT // total for kind, tally in self.tallies.items()}
        by_remainder = sorted(KINDS, key=lambda kind: -(self.tallies[kind].lines * PERCENT % total))
        rounded_up = set(by_remainder[:PERCENT - sum(floors.values())])
        return {kind: floors[kind] + (kind in rounded_up) for kind in KINDS}


def git(directory: Path | str, *args: str, problem: str, next_step: str,
        stdin: bytes | None = None) -> bytes:
    """The output of git run in ``directory``, with the shared rules as the attributes file."""
    command = ["git", "-C", str(directory), "-c", f"core.attributesFile={RULES}", *args]
    try:
        result = subprocess.run(command, input=stdin, capture_output=True, env=GIT_ENVIRONMENT,
                                check=False)
    except OSError as error:
        raise LinesError(f"git cannot run ({error.strerror}); {UPGRADE_GIT}") from error
    if result.returncode != 0:
        raise LinesError(f"{problem} ({os.fsdecode(result.stderr).strip()}); {next_step}")
    return result.stdout


def git_records(output: bytes, read: Callable[[deque[bytes]], Iterator[Record]]) -> list[Record]:
    """The records that ``read`` takes from git output written with -z, where every field ends
    with a NUL byte. Output that does not fit the records is refused."""
    *fields, rest = output.split(b"\0")
    try:
        if rest:
            raise ValueError(f"the field {rest!r} does not end")
        return list(read(deque(fields)))
    except (ValueError, IndexError) as error:
        raise LinesError(f"git printed output that pr-lines cannot read ({error}); "
                         "file an issue on the workflow-skills repository with it") from error


def numstat_changes(fields: deque[bytes]) -> Iterator[Change]:
    """The changes in git diff --numstat -z. A record holds the added count, the removed count
    and the path, separated by tabs, with - for both counts of a binary file. A rename has an
    empty path there, and the path before and the path after follow as fields of their own."""
    while fields:
        added, removed, path = fields.popleft().split(b"\t", 2)
        if not path:
            fields.popleft()  # the path before the rename
            path = fields.popleft()
        binary = (added, removed) == (b"-", b"-")
        yield Change(path=os.fsdecode(path), added=0 if binary else int(added),
                     removed=0 if binary else int(removed), binary=binary)


def attribute_kinds(fields: deque[bytes]) -> Iterator[tuple[str, Kind]]:
    """The kind of each path in git check-attr -z, where a record is the path, the attribute and
    its value."""
    values = iter(fields)
    for path, _attribute, value in zip(values, values, values, strict=True):
        name, text = os.fsdecode(path), value.decode()
        try:
            kind = Kind.OTHER if text == UNSPECIFIED else Kind(text)
        except ValueError:
            raise LinesError(f"{name}: {ATTRIBUTE} is {text!r}, expected one of "
                             + ", ".join(kind.value for kind in KINDS)
                             + f"; correct the rule in .gitattributes or {RULES.name}") from None
        yield name, kind


def commit_id(top: str, name: str) -> str:
    commit = git(top, "rev-parse", "--verify", "--end-of-options", f"{name}^{{commit}}",
                 problem=f"{name} is not a commit in {top}", next_step=FETCH_COMMITS)
    return commit.decode().strip()


def kinds_at(top: str, head: str, paths: Sequence[str]) -> dict[str, Kind]:
    """The kind of each path by the attributes at ``head`` and the shared rules."""
    output = git(top, "check-attr", f"--source={head}", "--stdin", "-z", ATTRIBUTE,
                 stdin=b"".join(os.fsencode(path) + b"\0" for path in paths),
                 problem=f"git cannot read the {ATTRIBUTE} attribute at {head}",
                 next_step=FETCH_COMMITS)
    return dict(git_records(output, attribute_kinds))


def count_lines(repository: Path, *, base: str, head: str) -> DiffTotals:
    """The diff lines from ``base`` to ``head`` by kind. The diff pairs renames at git's default
    similarity of 50% and uses the Myers algorithm, so the sums equal git diff --shortstat."""
    if not RULES.is_file():
        raise LinesError(f"the shared rules {RULES} are missing; "
                         f"restore {RULES.name} next to pr-lines.py")
    # check-attr reads the paths relative to the directory it runs in, and git diff names them
    # relative to the top of the work tree.
    toplevel = git(repository, "rev-parse", "--show-toplevel",
                   problem=f"{repository} is not a git work tree",
                   next_step="pass the repository with --repo, or run pr-lines inside it")
    top = os.fsdecode(toplevel).rstrip("\n")
    printed = git(top, "--version", problem="git --version failed", next_step=UPGRADE_GIT).decode()
    version = GIT_VERSION.match(printed)
    if version is None or tuple(map(int, version.groups())) < MINIMUM_GIT:
        raise LinesError(f"git --version printed {printed.strip()!r}, and pr-lines needs "
                         f"--attr-source; {UPGRADE_GIT}")
    base, head = commit_id(top, base), commit_id(top, head)
    numstat = git(top, f"--attr-source={head}", "diff", "--numstat", "-z", "-M",
                  "--diff-algorithm=myers", "--no-ext-diff", "--no-textconv",
                  "--ignore-submodules=none", base, head,
                  problem=f"git cannot read the diff from {base} to {head}",
                  next_step=FETCH_COMMITS)
    changed_files = git_records(numstat, numstat_changes)
    kinds = kinds_at(top, head, [change.path for change in changed_files])
    return DiffTotals(base=base, head=head, tallies={
        kind: Tally.of([change for change in changed_files if kinds[change.path] is kind])
        for kind in KINDS})


@dataclass(frozen=True)
class Label:
    text: str
    weight: int


@dataclass(frozen=True)
class PictureTexts:
    header: tuple[Label, ...]
    names: dict[Kind, Label]
    values: dict[Kind, Label]


def plural(count: int, noun: str) -> str:
    return f"{count:,} {noun}" + ("" if count == 1 else "s")


def percent(tally: Tally, share: int) -> str:
    return "<1%" if tally.lines and not share else f"{share}%"


def text_line(diff: DiffTotals) -> str:
    parts = []
    for kind in KINDS:
        tally = diff.tallies[kind]
        part = f"{kind.value} {tally.lines:,}"
        if tally.lines:
            part += f" ({percent(tally, diff.shares[kind])})"
        if tally.binary_files:
            part += f" and {plural(tally.binary_files, 'binary file')}"
        parts.append(part)
    return (f"{plural(diff.lines, 'diff line')} in {plural(diff.files, 'file')}: "
            + ", ".join(parts) + ".")


def row_value(tally: Tally, share: int) -> str:
    parts = [f"{tally.lines:,}"]
    if tally.lines:
        parts += [percent(tally, share), f"+{tally.added:,} −{tally.removed:,}"]
    if tally.binary_files:
        parts.append(plural(tally.binary_files, "binary file"))
    return " · ".join(parts)


def picture_texts(diff: DiffTotals) -> PictureTexts:
    return PictureTexts(
        header=(Label(plural(diff.lines, "diff line"), SEMIBOLD),
                Label(plural(diff.files, "file"), REGULAR),
                Label(f"{diff.base[:SHORT_ID]} → {diff.head[:SHORT_ID]}", REGULAR)),
        names={kind: Label(kind.value, SEMIBOLD) for kind in KINDS},
        values={kind: Label(row_value(diff.tallies[kind], diff.shares[kind]), REGULAR)
                for kind in KINDS})


def section(reference: str, diff: DiffTotals) -> str:
    # Markdown reads a picture address with a space or a parenthesis only in angle brackets.
    destination = f"<{reference}>" if any(sign in reference for sign in " ()") else reference
    return f"## {SECTION_TITLE}\n\n![{SECTION_TITLE}]({destination})\n\n{text_line(diff)}"


SVG_NAMESPACE = "http://www.w3.org/2000/svg"
FONT_SIZE = 13
INK = "#1f2328"
WHITE = "#ffffff"
# The fill and the text color of each kind. Every fill has at least 3:1 contrast against both
# GitHub page colors, so one transparent picture works on the light and the dark theme.
KIND_COLORS = {
    Kind.CODE: ("#0096de", INK),
    Kind.TESTS: ("#7f58b9", WHITE),
    Kind.ASSETS: ("#b64a20", WHITE),
    Kind.TOOLING: ("#819809", INK),
    Kind.DOCS: ("#cf6cb1", INK),
    Kind.OTHER: ("#686868", WHITE),
}
NEUTRAL = ("#24292f", WHITE)

# The room the bars are scaled into and the narrowest picture. It fits the description column of
# a pull request on GitHub on a desktop screen, so the picture shows at its own size there.
PICTURE_WIDTH = 720
GRID_COLUMNS = math.isqrt(PERCENT)  # a square grid with one cell per percent
CELL, CELL_GAP, CELL_RADIUS = 18, 3, 3  # the side, the gap and the corner radius of a cell
CELL_PITCH = CELL + CELL_GAP
GRID_SIDE = GRID_COLUMNS * CELL_PITCH - CELL_GAP
ROWS_LEFT = GRID_SIDE + 24  # the rows start 24 px right of the grid
PILL_HEIGHT, PILL_PADDING = 24, 10  # the height of a pill and the room on each side of its text
BASELINE = 16.5  # the text baseline, measured from the top of a pill
HEADER_GAP = 6  # between two pills of the header
ROWS_TOP = PILL_HEIGHT + 14  # the rows start 14 px below the header
ROW_PITCH = PILL_HEIGHT + 5
NAME_GAP, BAR_GAP = 8, 6  # the gaps before and after a bar
BAR_INSET = 4  # between the top of a row and the top of its bar
BAR_HEIGHT = PILL_HEIGHT - 2 * BAR_INSET
BAR_RADIUS = 4  # the radius of the rounded end, and the shortest bar


def bar_lengths(diff: DiffTotals, value_widths: Mapping[Kind, float],
                room: float) -> dict[Kind, float]:
    """The bar of each kind with lines, at the longest scale at which every bar and the value
    pill after it fit into ``room``."""
    fractions = {kind: tally.lines / diff.lines for kind, tally in diff.tallies.items()
                 if tally.lines}
    scale = min(((room - BAR_GAP - value_widths[kind]) / fraction
                 for kind, fraction in fractions.items()), default=0)
    return {kind: max(BAR_RADIUS, scale * fraction) for kind, fraction in fractions.items()}


def svg_number(value: float) -> str:
    """A length in the SVG, to a hundredth of a pixel."""
    return format(round(value, 2), "g")


def add_svg_element(parent: ET.Element, tag: str, **attributes: str | float) -> ET.Element:
    return ET.SubElement(parent, tag, {name.replace("_", "-"): svg_number(value)
                                       if isinstance(value, int | float) else value
                                       for name, value in attributes.items()})


def add_text(parent: ET.Element, label: Label, *, x: float, y: float, ink: str,
             **attributes: str) -> None:
    """The text of ``label``, centered on ``x``, in a line that starts at ``y``."""
    node = add_svg_element(parent, "text", x=x, y=y + BASELINE, fill=ink, font_family=FONT,
                           font_size=FONT_SIZE, font_weight=label.weight,
                           text_anchor="middle", **attributes)
    node.text = label.text


def add_pill(parent: ET.Element, label: Label, *, x: float, y: float, width: float,
             colors: tuple[str, str]) -> None:
    fill, ink = colors
    add_svg_element(parent, "rect", x=x, y=y, width=width, height=PILL_HEIGHT,
                    rx=PILL_HEIGHT / 2, fill=fill)
    add_text(parent, label, x=x + width / 2, y=y, ink=ink)


def add_bar(parent: ET.Element, *, x: float, y: float, width: float, fill: str) -> None:
    """A bar with a square start and a rounded end."""
    straight, radius = svg_number(width - BAR_RADIUS), svg_number(BAR_RADIUS)
    corner = f"a{radius} {radius} 0 0 1"
    add_svg_element(parent, "path", fill=fill,
                    d=f"M{svg_number(x)} {svg_number(y)}h{straight}{corner} {radius} {radius}"
                      f"v{svg_number(BAR_HEIGHT - 2 * BAR_RADIUS)}{corner} -{radius} {radius}"
                      f"h-{straight}z")


def picture_svg(diff: DiffTotals, texts: PictureTexts,
                text_widths: Mapping[Label, float]) -> ET.Element:
    """A 10 by 10 grid with one cell per percent of the diff lines, filled column by column in
    the order of the kinds, and beside it the header and a row per kind with a bar at one scale."""
    pill_widths = {label: width + 2 * PILL_PADDING for label, width in text_widths.items()}
    root = ET.Element("svg", xmlns=SVG_NAMESPACE)
    cell_kinds = [kind for kind in KINDS for _ in range(diff.shares[kind])]
    for index in range(PERCENT):
        column, line = divmod(index, GRID_COLUMNS)
        fill, _ink = KIND_COLORS[cell_kinds[index]] if index < len(cell_kinds) else NEUTRAL
        add_svg_element(root, "rect", x=column * CELL_PITCH, y=line * CELL_PITCH, width=CELL,
                        height=CELL, rx=CELL_RADIUS, fill=fill)
    x = right = float(ROWS_LEFT)
    for label in texts.header:
        add_pill(root, label, x=x, y=0, width=pill_widths[label], colors=NEUTRAL)
        right = x + pill_widths[label]
        x = right + HEADER_GAP
    name_width = max(pill_widths[label] for label in texts.names.values())
    bar_left = ROWS_LEFT + name_width + NAME_GAP
    bars = bar_lengths(diff, {kind: pill_widths[label] for kind, label in texts.values.items()},
                       PICTURE_WIDTH - bar_left)
    bottom = 0
    for index, kind in enumerate(KINDS):
        y = ROWS_TOP + index * ROW_PITCH
        add_pill(root, texts.names[kind], x=ROWS_LEFT, y=y, width=name_width,
                 colors=KIND_COLORS[kind])
        x = bar_left
        if kind in bars:
            add_bar(root, x=x, y=y + BAR_INSET, width=bars[kind], fill=KIND_COLORS[kind][0])
            x += bars[kind] + BAR_GAP
        value = texts.values[kind]
        add_pill(root, value, x=x, y=y, width=pill_widths[value], colors=KIND_COLORS[kind])
        right = max(right, x + pill_widths[value])
        bottom = y + PILL_HEIGHT
    width, height = max(PICTURE_WIDTH, math.ceil(right)), max(GRID_SIDE, bottom)
    root.attrib.update(width=str(width), height=str(height), viewBox=f"0 0 {width} {height}")
    return root


class Renderer:
    """resvg run with only the Mona Sans files of one directory and none of the system fonts."""

    def __init__(self, executable: str, font_directory: Path) -> None:
        fonts = {stem: next((path for suffix in FONT_SUFFIXES
                             if (path := font_directory / f"{stem}{suffix}").is_file()), None)
                 for stem in FONT_STEMS.values()}
        if missing := [stem for stem, font in fonts.items() if font is None]:
            raise LinesError(f"{font_directory} does not contain {', '.join(missing)}; "
                             f"{PASS_FONTS}")
        self.command = [executable, "--skip-system-fonts",
                        *(argument for font in fonts.values()
                          for argument in ("--use-font-file", str(font)))]

    def run(self, arguments: Sequence[str], root: ET.Element) -> bytes:
        argv = [*self.command, *arguments]
        try:
            result = subprocess.run(argv, input=ET.tostring(root), capture_output=True,
                                    check=False)
        except OSError as error:
            raise LinesError(f"resvg at {argv[0]} cannot run ({error.strerror}); "
                             f"{PASS_RESVG}") from error
        if result.returncode != 0:
            raise LinesError(f"resvg failed ({result.returncode}): "
                             f"{os.fsdecode(result.stdout + result.stderr).strip()}; {PASS_RESVG}")
        return result.stdout

    def measure(self, labels: Iterable[Label]) -> dict[Label, float]:
        """The text width of each label, by the id and the width in a row of resvg --query-all."""
        ids = {label: f"label-{index}" for index, label in enumerate(dict.fromkeys(labels))}
        root = ET.Element("svg", xmlns=SVG_NAMESPACE, width=str(PICTURE_WIDTH),
                          height=str(PILL_HEIGHT))
        for label, label_id in ids.items():
            add_text(root, label, x=PICTURE_WIDTH / 2, y=0, ink=INK, id=label_id)
        query = self.run(["--query-all", "-"], root).decode().splitlines()
        widths = {element_id: float(width)
                  for element_id, _x, _y, width, _height in csv.reader(query)}
        if missing := [label.text for label, label_id in ids.items() if label_id not in widths]:
            raise LinesError(f"resvg did not measure a width for {missing}; {PASS_FONTS}")
        return {label: widths[label_id] for label, label_id in ids.items()}

    def png(self, root: ET.Element) -> bytes:
        return self.run(["-", "-c"], root)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pr-lines", description=__doc__.split("\n\n")[0])
    parser.add_argument("base", help="the commit the pull request starts from")
    parser.add_argument("head", help="the last commit in the pull request")
    parser.add_argument("--out", required=True,
                        help="the PNG file to write; the printed section names it as given")
    parser.add_argument("--repo", type=Path, default=Path("."), help="the git repository")
    parser.add_argument("--resvg", default="resvg", help="the resvg executable, by name or path")
    parser.add_argument("--fonts", type=Path, required=True,
                        help=f"the directory with {FONT_FILES}")
    args = parser.parse_args(argv)
    try:
        renderer = Renderer(args.resvg, args.fonts)
        diff = count_lines(args.repo, base=args.base, head=args.head)
        texts = picture_texts(diff)
        widths = renderer.measure([*texts.header, *texts.names.values(), *texts.values.values()])
        png = renderer.png(picture_svg(diff, texts, widths))
        try:
            Path(args.out).write_bytes(png)
        except OSError as error:
            raise LinesError(f"cannot write {args.out} ({error.strerror}); make the directory "
                             "of --out writable, or pass another --out") from error
    except LinesError as error:
        print(f"pr-lines: {error}", file=sys.stderr)
        return 1
    print(section(args.out, diff))
    return 0


if __name__ == "__main__":
    sys.exit(main())
