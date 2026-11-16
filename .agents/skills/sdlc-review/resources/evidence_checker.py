"""Read-only C2 v1 evidence validation. No command execution or approval authority.

Run: python3 evidence_checker.py RECORD.json --root WORKSPACE
Only operator-selected files are inspected; never point manifests at secrets.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re

HASH = re.compile(r'[0-9a-f]{64}')
PRIORITY = ('invalid', 'missing', 'stale')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'duplicate JSON key: {key}')
        result[key] = value
    return result


def workspace_path(root, name):
    if not isinstance(name, str) or not name or '\\' in name:
        raise ValueError('path must be a nonempty POSIX relative path')
    parts = PurePosixPath(name)
    if parts.is_absolute() or '..' in parts.parts or parts.as_posix() != name or name == '.':
        raise ValueError('path must be canonical and relative without traversal')
    resolved = (root / name).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError('path escapes workspace')
    return resolved


def file_identity(path):
    """Existing hard links share device/inode even when resolved names differ."""
    try:
        stat = path.stat()
        return (stat.st_dev, stat.st_ino)
    except FileNotFoundError:
        return path


def validate(record, root, record_path=None):
    """Return technical completeness, not authenticity, semantics or gate approval."""
    issues = []

    def add(status, message):
        issues.append({'status': status, 'reason': message})

    def field(obj, key, kind, label):
        if key not in obj:
            add('missing', f'{label}.{key}: required')
            return None
        value = obj[key]
        if type(value) is not kind:
            add('invalid', f'{label}.{key}: expected {kind.__name__}')
            return None
        return value

    def string(obj, key, label):
        value = field(obj, key, str, label)
        if value is not None and not value.strip():
            add('missing', f'{label}.{key}: empty')
        return value

    def strings(obj, key, label, nonempty=False, unique=False):
        value = field(obj, key, list, label)
        if value is None:
            return []
        if nonempty and not value:
            add('missing', f'{label}.{key}: empty')
        if any(type(item) is not str or not item.strip() for item in value):
            add('invalid', f'{label}.{key}: expected nonempty strings')
            return []
        if unique and len(set(value)) != len(value):
            add('invalid', f'{label}.{key}: duplicate IDs')
        return value

    def manifest(obj, key, label, inspect=True):
        value = field(obj, key, dict, label)
        if value is None:
            return {}
        if not value:
            add('missing', f'{label}.{key}: empty')
        resolved_paths = set()
        for name, digest in value.items():
            location = f'{label}.{key}:{name}'
            try:
                path = workspace_path(root, name)
                if record_path is not None and file_identity(path) == file_identity(record_path):
                    raise ValueError('record cannot be an input or artifact')
                if file_identity(path) in resolved_paths:
                    raise ValueError('duplicate physical file alias')
                resolved_paths.add(file_identity(path))
            except (ValueError, OSError, RuntimeError):
                add('invalid', f'{location}: invalid workspace path')
                continue
            if type(digest) is not str or HASH.fullmatch(digest) is None:
                add('invalid', f'{location}: expected lowercase SHA-256')
                continue
            if inspect:
                try:
                    if not path.exists():
                        add('missing', f'{location}: file absent')
                    elif not path.is_file():
                        add('invalid', f'{location}: not a regular file')
                    elif hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                        add('stale', f'{location}: bytes changed')
                except OSError:
                    add('invalid', f'{location}: file unreadable')
        return value

    if type(record) is not dict:
        return {'status': 'invalid', 'reasons': ['record must be an object']}
    version = field(record, 'schema_version', int, 'record')
    if version is not None and version != 1:
        add('invalid', 'unsupported schema_version')
    for key in ('task_id', 'task_type', 'baseline_ref', 'design_ref', 'approval_ref'):
        string(record, key, 'record')
    requested = string(record, 'requested_status', 'record')
    if requested and requested != 'VERIFIED':
        add('invalid', 'requested_status must be VERIFIED')
    strings(record, 'ac_refs', 'record', nonempty=True)
    required = strings(record, 'required_checks', 'record', nonempty=True, unique=True)
    if strings(record, 'blockers', 'record'):
        add('missing', 'unresolved blockers')
    snapshot = manifest(record, 'snapshot', 'record')
    checks = field(record, 'checks', list, 'record')
    seen = set()
    for index, check in enumerate(checks or []):
        label = f'checks[{index}]'
        if type(check) is not dict:
            add('invalid', f'{label}: expected object')
            continue
        identity = string(check, 'id', label)
        if identity is not None:
            if identity in seen:
                add('invalid', f'{label}: duplicate check ID')
            seen.add(identity)
        string(check, 'command', label)  # Never execute this metadata.
        terminal = field(check, 'terminal', bool, label)
        code = field(check, 'exit_code', int, label)
        if terminal is False or (code is not None and code != 0):
            add('missing', f'{label}: no successful terminal result')
        check_snapshot = manifest(check, 'snapshot', label, inspect=False)
        if check_snapshot and snapshot and check_snapshot != snapshot:
            add('stale', f'{label}: test snapshot differs')
        artifacts = manifest(check, 'artifacts', label)
        # Reject overlap by resolved identity, including symlink aliases.
        try:
            inputs = {file_identity(workspace_path(root, name)) for name in snapshot}
            outputs = {file_identity(workspace_path(root, name)) for name in artifacts}
            if inputs & outputs:
                add('invalid', f'{label}: artifacts overlap snapshot inputs')
        except (ValueError, OSError, RuntimeError):
            pass  # Already reported by manifest validation.
    for identity in required:
        if identity not in seen:
            add('missing', f'required check absent: {identity}')
    status = next((status for status in PRIORITY if any(i['status'] == status for i in issues)), 'satisfied')
    return {'status': status, 'reasons': [f"{i['status']}: {i['reason']}" for i in issues]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('record')
    parser.add_argument('--root', required=True)
    args = parser.parse_args()
    try:
        root = Path(args.root).resolve(strict=True)
        if not root.is_dir():
            raise ValueError('root must be a directory')
        record_path = Path(args.record).resolve(strict=True)
        if not record_path.is_relative_to(root) or not record_path.is_file():
            raise ValueError('record must be a file within root')
        record = json.loads(record_path.read_text(encoding='utf-8'), object_pairs_hook=unique_object,
                            parse_constant=lambda value: (_ for _ in ()).throw(ValueError('nonfinite JSON')))
        result = validate(record, root, record_path)
    except (OSError, ValueError, RuntimeError, RecursionError):
        result = {'status': 'invalid', 'reasons': ['record/root unreadable or invalid JSON/path']}
    print(json.dumps(result, ensure_ascii=True))
    return {'satisfied': 0, 'missing': 1, 'stale': 1, 'invalid': 2}[result['status']]


if __name__ == '__main__':
    raise SystemExit(main())
