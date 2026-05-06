#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera metadatos operativos para el snapshot BMR Web.

No accede a MariaDB. Solo inspecciona web/data y escribe JSON públicos:
- status/file_index.json
- status/automation.json
- status/publish.json

Uso:
  python automation/make_snapshot_status.py --data-dir web/data --stage exported --validation-status ok
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import platform
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def run_git(args: List[str], cwd: Path) -> Optional[str]:
    try:
        out = subprocess.check_output(["git", *args], cwd=str(cwd), stderr=subprocess.DEVNULL, text=True)
        return out.strip()
    except Exception:
        return None


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def build_file_index(data_dir: Path, max_entries: int) -> Dict[str, Any]:
    files: List[Dict[str, Any]] = []
    total_bytes = 0
    for p in sorted(data_dir.rglob("*.json")):
        if p.name.endswith(".tmp"):
            continue
        rel = p.relative_to(data_dir).as_posix()
        size = p.stat().st_size
        total_bytes += size
        files.append({
            "path": rel,
            "bytes": size,
            "sha256": sha256_file(p),
        })
    truncated = False
    if max_entries and len(files) > max_entries:
        files = files[:max_entries]
        truncated = True
    return {
        "generated_at": now_utc(),
        "file_count": len(list(data_dir.rglob("*.json"))),
        "indexed_count": len(files),
        "truncated": truncated,
        "total_bytes": total_bytes,
        "files": files,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Genera status operativo para BMR Web.")
    ap.add_argument("--data-dir", default="web/data")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--stage", default="exported", choices=["exported", "validated", "committed", "pushed", "dry-run", "failed"])
    ap.add_argument("--validation-status", default="unknown", choices=["unknown", "ok", "warning", "error"])
    ap.add_argument("--message", default="")
    ap.add_argument("--log-file", default="")
    ap.add_argument("--branch", default="")
    ap.add_argument("--max-index-entries", type=int, default=5000)
    ap.add_argument("--no-file-index", action="store_true")
    args = ap.parse_args()

    data_dir = Path(args.data_dir).resolve()
    repo_root = Path(args.repo_root).resolve()
    status_dir = data_dir / "status"
    manifest = load_json(data_dir / "manifest.json")

    git_commit = run_git(["rev-parse", "HEAD"], repo_root)
    git_branch = args.branch or run_git(["rev-parse", "--abbrev-ref", "HEAD"], repo_root)
    git_status = run_git(["status", "--porcelain"], repo_root)

    automation = {
        "stage": args.stage,
        "status": "ok" if args.validation_status in {"ok", "warning"} and args.stage != "failed" else "error" if args.stage == "failed" else "unknown",
        "validation_status": args.validation_status,
        "message": args.message,
        "generated_at": now_utc(),
        "snapshot_date": manifest.get("snapshot_date"),
        "manifest_version": manifest.get("version"),
        "mode": manifest.get("mode"),
        "host": platform.node(),
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "log_file": args.log_file,
    }
    publish = {
        "generated_at": now_utc(),
        "stage": args.stage,
        "branch": git_branch,
        "commit": git_commit,
        "dirty_worktree": bool(git_status),
        "changed_files_count": len(git_status.splitlines()) if git_status else 0,
        "snapshot_date": manifest.get("snapshot_date"),
        "manifest_version": manifest.get("version"),
        "pages_source": "GitHub Actions artifact from ./web",
    }

    atomic_write_json(status_dir / "automation.json", automation)
    atomic_write_json(status_dir / "publish.json", publish)
    if not args.no_file_index:
        atomic_write_json(status_dir / "file_index.json", build_file_index(data_dir, args.max_index_entries))
    print(json.dumps({"status": automation["status"], "stage": args.stage, "validation_status": args.validation_status}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
