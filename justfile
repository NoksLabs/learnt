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
    bun src/install.ts "$@"

install-dry *agents:
    bun src/install.ts --dry-run "$@"

uninstall *agents:
    bun src/install.ts --uninstall "$@"
