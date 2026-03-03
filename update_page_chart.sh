#!/usr/bin/env bash

# Insert import
sed -i '' '/import { EditModal }/i\
import { ChartModal } from '"'"'@/components/investment/ChartModal'"'"';\
' src/app/investment/page.tsx

# Insert state
sed -i '' 's/    const \[showAddModal, setShowAddModal/    const \[showChartModal, setShowChartModal\] = useState(false);\n    const \[showAddModal, setShowAddModal/g' src/app/investment/page.tsx

# Insert button next to Eye
sed -i '' '/EyeOff/!b;n;a\
                    <button onClick={() => setShowChartModal(true)} className="glass" style={{ padding: '"'"'0.75rem 1.25rem'"'"', cursor: '"'"'pointer'"'"', display: '"'"'flex'"'"', alignItems: '"'"'center'"'"', gap: '"'"'0.6rem'"'"', color: '"'"'var(--primary)'"'"', fontWeight: '"'"'600'"'"', fontSize: '"'"'0.9rem'"'"' }}>\
                        <PieChart size={18} /> 섹터 차트\
                    </button>
' src/app/investment/page.tsx

# Insert Component rendering near EditModal
sed -i '' '/{showAddModal && (/i\
            {showChartModal && (\
                <ChartModal \
                    investments={assets.investments}\
                    onClose={() => setShowChartModal(false)}\
                />\
            )}\
' src/app/investment/page.tsx

# Insert PieChart to lucide imports
sed -i '' 's/PlusCircle, Tag }/PlusCircle, Tag, PieChart }/g' src/app/investment/page.tsx

