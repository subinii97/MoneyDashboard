import { repo } from '../src/lib/db';
const h = repo.history.getByDate('2026-03-19');
const rate = h.exchangeRate || 1350;
const allocations = (h.allocations || []).map((alc: any) => {
    const isInvCat = [
        'Domestic Stock', 'Overseas Stock',
        'Domestic Index', 'Overseas Index',
        'Domestic Bond', 'Overseas Bond'
    ].includes(alc.category);

    if (isInvCat) {
        const categoryValue = h.holdings
            .filter((inv: any) => inv.category === alc.category || (alc.category === 'Domestic Stock' && inv.marketType === 'Domestic') || (alc.category === 'Overseas Stock' && inv.marketType === 'Overseas'))
            .reduce((sum: number, inv: any) => {
                const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
                return sum + (inv.currency === 'USD' ? val * rate : val);
            }, 0);
        return { ...alc, value: categoryValue / (alc.currency === 'USD' ? rate : 1) };
    }
    return alc;
});
console.log(JSON.stringify(allocations, null, 2));
