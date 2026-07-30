#!/usr/bin/env python3
"""Sniff a delimited text file and dump its structure and rows.

Detects the delimiter and whether a header row is present (Python's csv module,
always in the standard library — the sole requirement is python3), then prints:

    DELIM <char>  HEADER <bool>  ROWS <n>

followed by every parsed row as tab-separated fields (quoting and embedded
delimiters handled correctly, UTF-8 BOM stripped).

Usage: python3 scripts/extract.py <file.csv>
"""
import csv
import sys


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: extract.py <file.csv>")
    path = sys.argv[1]
    with open(path, newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = csv.get_dialect("excel")
        try:
            has_header = csv.Sniffer().has_header(sample)
        except csv.Error:
            has_header = False
        rows = list(csv.reader(f, dialect))
    print(f"DELIM\t{dialect.delimiter!r}\tHEADER\t{has_header}\tROWS\t{len(rows)}")
    for row in rows:
        print("\t".join(row))


if __name__ == "__main__":
    main()
