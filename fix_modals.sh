#!/usr/bin/env bash

# EditModal: Revert wrapper to transparent dim, change card to opaque `--background`
sed -i '' 's/background: '"'"'var(--background)'"'"'/background: '"'"'rgba(0, 0, 0, 0.4)'"'"'/g' src/components/investment/EditModal.tsx
sed -i '' 's/backgroundColor: '"'"'var(--card)'"'"'/backgroundColor: '"'"'var(--background)'"'"'/g' src/components/investment/EditModal.tsx

# TransactionModal: Revert wrapper to transparent dim, change card to opaque `--background`
sed -i '' 's/background: '"'"'var(--background)'"'"'/background: '"'"'rgba(0, 0, 0, 0.4)'"'"'/g' src/components/investment/TransactionModal.tsx
sed -i '' 's/backgroundColor: '"'"'var(--card)'"'"'/backgroundColor: '"'"'var(--background)'"'"'/g' src/components/investment/TransactionModal.tsx

