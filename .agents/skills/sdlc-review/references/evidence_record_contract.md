# Evidence Record Contract — C2 v1

Optional read-only Python 3.9+ CLI, shipped with this skill; no installer or network dependency. Run `python3 evidence_checker.py RECORD.json --root WORKSPACE` using the packaged resource path. Record must be within root. Select only authorized non-secret source/config/test/log files. The checker cannot identify secret contents automatically. It does not execute `command` metadata or inspect transcripts.

## Record

Top-level JSON object, duplicate keys forbidden:

- `schema_version`: integer 1 (not boolean).
- `task_id`, `task_type`: nonempty strings; `requested_status`: `VERIFIED`.
- `ac_refs`: nonempty array of nonempty strings.
- `baseline_ref`, `design_ref`, `approval_ref`: nonempty source/version/scope decision references. The checker tests presence, not authenticity.
- `snapshot`: nonempty object mapping canonical relative POSIX paths to lowercase SHA-256 of bytes. Include relevant dirty sources/config/tests; exclude generated evidence/output and the record itself.
- `required_checks`: nonempty array of unique string IDs selected against approved AC by executor/reviewer.
- `checks`: array of objects with `id`, `command` (description only), `terminal` boolean, `exit_code` integer, `snapshot` equal to the declared input manifest, and nonempty `artifacts` path/hash object containing terminal logs.
- `blockers`: array of nonempty strings; empty when none.

Paths cannot be absolute, contain traversal, escape root through symlinks, alias another manifest entry, refer to record itself or overlap snapshot/artifact files. Inspect only stable regular files in a controlled workspace; hashes are not protection against concurrent hostile filesystem mutation. Check output is not evidence of approval identity or test semantics.

## Result

JSON `status` and `reasons` array. Precedence: invalid → missing → stale → satisfied. Keep all detected reasons.

| Status | Meaning | Exit |
| --- | --- | --- |
| satisfied | Declared fields, successful terminal results and file identities agree | 0 |
| missing | Required field/file/check/log absent, blocker present, pending/failed result | 1 |
| stale | Current source/artifact bytes or check snapshot differ | 1 |
| invalid | Schema/type/hash/path/duplicate error, unreadable record/root/files | 2 |

Artifact format does not prove assertions actually exercised the SUT; the reviewer must audit logs, boundaries, required check selection and manifest completeness. Additional metadata is allowed but has no authority. A satisfied record never grants G1/G3, merge or production permission. This checker is independent of native hooks; adapters belong to a separate scope.
