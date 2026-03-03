#!/usr/bin/env bash

# Delete any existing ChartModal import
sed -i '' '/import { ChartModal } from '"'"'@\/components\/investment\/ChartModal'"'"';/d' src/app/investment/page.tsx

# Reinsert it correctly below AddAssetCard
sed -i '' '/import { AddAssetCard }/a\
import { ChartModal } from '"'"'@/components/investment/ChartModal'"'"';\
' src/app/investment/page.tsx

# Ensure showChartModal useState exists natively
sed -i '' '/const \[showChartModal, setShowChartModal\] = useState(false);/d' src/app/investment/page.tsx
sed -i '' 's/const \[showAddModal, setShowAddModal/const \[showChartModal, setShowChartModal\] = useState(false);\n    const \[showAddModal, setShowAddModal/g' src/app/investment/page.tsx

# Insert the button exactly between PlusCircle and Eye
sed -i '' '/<PlusCircle size={18} \/> 종목 추가/!b;n;n;a\
                    <button onClick={() => setShowChartModal(true)} className="glass" style={{ padding: '"'"'0.75rem 1.25rem'"'"', cursor: '"'"'pointer'"'"', display: '"'"'flex'"'"', alignItems: '"'"'center'"'"', gap: '"'"'0.6rem'"'"', color: '"'"'var(--primary)'"'"', fontWeight: '"'"'600'"'"', fontSize: '"'"'0.9rem'"'"' }}>\
                        <PieChart size={18} /> 섹터 차트\
                    </button>
' src/app/investment/page.tsx

# Ensure ChartModal JSX rendering exists
sed -i '' '/<ChartModal/d' src/app/investment/page.tsx
sed -i '' '/investments={assets.investments}/d' src/app/investment/page.tsx
sed -i '' '/onClose={() => setShowChartModal(false)}/d' src/app/investment/page.tsx

sed -i '' '/{showAddModal && (/i\
            {showChartModal && (\
                <ChartModal \
                    investments={assets.investments}\
                    onClose={() => setShowChartModal(false)}\
                />\
            )}\
' src/app/investment/page.tsx

