#!/usr/bin/env python3
"""Create and merge signed release entries for the static update catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def release_entry(args: argparse.Namespace) -> dict[str, object]:
    artifact = Path(args.artifact)
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    release_path = f"platform/releases/{args.version}" if args.type == "platform" else f"plugins/{args.package}/releases/{args.version}"
    return {
        "schema": 1,
        "package": args.package,
        "type": args.type,
        "version": args.version,
        "channel": args.channel,
        "download_url": f"{args.base_url.rstrip('/')}/{release_path}/{artifact.name}",
        "checksum": digest,
        "size": artifact.stat().st_size,
        "minimum_php": args.minimum_php,
        "compatible_from": args.compatible_from,
        "published_at": args.published_at,
        "release_notes": args.release_notes,
    }


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--type", choices=("platform", "plugin"), required=True)
    create.add_argument("--package", required=True)
    create.add_argument("--version", required=True)
    create.add_argument("--channel", default="stable")
    create.add_argument("--artifact", required=True)
    create.add_argument("--base-url", required=True)
    create.add_argument("--minimum-php", default=">=8.3")
    create.add_argument("--compatible-from", default=">=1.0.0 <2.0.0")
    create.add_argument("--published-at", required=True)
    create.add_argument("--release-notes", default="")
    create.add_argument("--output", required=True)
    merge = sub.add_parser("merge")
    merge.add_argument("--catalog", required=True)
    merge.add_argument("--release", required=True)
    args = parser.parse_args()

    if args.command == "create":
        write_json(Path(args.output), release_entry(args))
        return 0

    catalog_path = Path(args.catalog)
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    release = json.loads(Path(args.release).read_text(encoding="utf-8"))
    releases = [item for item in catalog.get("releases", []) if not (item.get("package") == release["package"] and item.get("version") == release["version"] and item.get("channel") == release["channel"])]
    releases.append(release)
    releases.sort(key=lambda item: (item.get("package", ""), item.get("version", ""), item.get("channel", "")))
    catalog["releases"] = releases
    write_json(catalog_path, catalog)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
