#!/usr/bin/env bash

# remove all isPrivate lines
sed -i '' '/const \[isPrivate, setIsPrivate\] = useState(false);/d' src/app/investment/page.tsx

# insert exactly one back before showAddModal
sed -i '' 's/    const \[showAddModal, setShowAddModal/    const \[isPrivate, setIsPrivate\] = useState(false);\n    const \[showAddModal, setShowAddModal/g' src/app/investment/page.tsx

