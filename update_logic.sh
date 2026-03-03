#!/usr/bin/env bash

# Delete getAggregated logic, setViewMode and viewMode passing from page.tsx
sed -i '' '/const \[viewMode/d' src/app/investment/page.tsx
sed -i '' '/const getAggregated/,/};/d' src/app/investment/page.tsx
sed -i '' 's/return viewMode === '"'"'aggregated'"'"' ? getAggregated(list) : list;/return list;/g' src/app/investment/page.tsx
sed -i '' '/<button onClick={() => setViewMode.*<\/button>/d' src/app/investment/page.tsx
sed -i '' '/viewMode={viewMode}/d' src/app/investment/page.tsx
sed -i '' 's/await saveEdit(editingInvestment, editForm, viewMode);/await saveEdit(editingInvestment, editForm, '"'"'aggregated'"'"');/g' src/app/investment/page.tsx

# Update TransactionModal wrapper to var(--background)
sed -i '' 's/background: '"'"'rgba(0,0,0,0.8)'"'"'/background: '"'"'var(--background)'"'"'/g' src/components/investment/TransactionModal.tsx

# Update EditModal wrapper to var(--background), remove viewMode
sed -i '' 's/background: '"'"'rgba(0,0,0,0.8)'"'"'/background: '"'"'var(--background)'"'"'/g' src/components/investment/EditModal.tsx
sed -i '' 's/background: '"'"'rgba(0, 0, 0, 0.4)'"'"'/background: '"'"'var(--background)'"'"'/g' src/components/investment/EditModal.tsx
sed -i '' '/viewMode: '"'"'aggregated'"'"' | '"'"'detailed'"'"';/d' src/components/investment/EditModal.tsx
sed -i '' '/viewMode,/d' src/components/investment/EditModal.tsx
sed -i '' '/{viewMode === '"'"'aggregated'"'"' && (/,/)}/d' src/components/investment/EditModal.tsx

