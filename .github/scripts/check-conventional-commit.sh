#!/bin/sh
# Checks that each line on stdin is a Conventional Commits subject line
#. Empty lines are ignored.
#
#   <type>(<scope>)!: <summary>
#
# Exits 1 and lists the lines that don't match, if any.
set -eu

pattern='^(feat|fix|docs|refactor|perf|test|build|ci|chore|revert|style)(\([a-z0-9][a-z0-9-]*\))?!?: [^ ].*$'

status=0
while IFS= read -r line || [ -n "$line" ]; do
    [ -z "$line" ] && continue
    if printf '%s\n' "$line" | grep -Eq "$pattern"; then
        printf 'ok:      %s\n' "$line"
    else
        printf 'invalid: %s\n' "$line"
        status=1
    fi
done

if [ "$status" -ne 0 ]; then
    echo
    echo "Use Conventional Commits: <type>(<scope>)!: <summary>"
    echo "Types: feat fix docs refactor perf test build ci chore revert style"
    echo "Example: feat(verifier): check the token audience"
fi
exit "$status"
