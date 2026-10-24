set positional-arguments

default:
    @just --list

i:
    bun install

i-l:
    bun install --frozen-lockfile

ck:
    bun run typecheck

b:
    bun run build

t *args:
    bun test "$@"

check:
    bun run check

validate:
    claude plugin validate .claude-plugin/plugin.json
    claude plugin validate .claude-plugin/marketplace.json
    claude plugin validate skills

install *agents:
    node skills/learnt/scripts/learnt.mjs install "$@"

install-dry *agents:
    node skills/learnt/scripts/learnt.mjs install --dry-run "$@"

uninstall *agents:
    node skills/learnt/scripts/learnt.mjs uninstall "$@"
