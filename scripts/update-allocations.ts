import { repo } from '../src/lib/db';

async function restoreDB() {
    console.log('Restoring 03-18 and 03-19 to exact user mock state...');
    const h18 = repo.history.getByDate('2026-03-18');
    if (h18) {
        h18.holdings = JSON.parse(`[{"symbol":"ITA","shares":8,"currentPrice":231.42999267578125,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"SOXL","shares":28,"currentPrice":54.02000045776367,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"TSLL","shares":191,"currentPrice":13.859999656677246,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"000660.KS","shares":2,"currentPrice":1056000,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"NVDL","shares":35,"currentPrice":78.55000305175781,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"KORU","shares":3,"currentPrice":375.8699951171875,"currency":"USD","marketType":"Overseas","category":"Overseas Index"},{"symbol":"005930.KS","shares":46,"currentPrice":208500,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"005385.KS","shares":20,"currentPrice":279500,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"006800.KS","shares":23,"currentPrice":69900,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"488080.KS","shares":99,"currentPrice":48235,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"}]`);
        repo.history.upsert(h18);
    }
    
    const h19 = repo.history.getByDate('2026-03-19');
    if (h19) {
        h19.holdings = JSON.parse(`[{"symbol":"ITA","shares":8,"currentPrice":227.32,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"SOXL","shares":28,"currentPrice":54.85,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"TSLL","shares":191,"currentPrice":12.97,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"000660.KS","shares":2,"currentPrice":1013000,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"NVDL","shares":35,"currentPrice":76.94,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"KORU","shares":3,"currentPrice":397.75,"currency":"USD","marketType":"Overseas","category":"Overseas Index"},{"symbol":"005930.KS","shares":46,"currentPrice":200500,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"005385.KS","shares":20,"currentPrice":269000,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"006800.KS","shares":23,"currentPrice":66700,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"488080.KS","shares":99,"currentPrice":46030,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"}]`);
        repo.history.upsert(h19);
    }

    const h20 = repo.history.getByDate('2026-03-20');
    if (h20) {
        h20.holdings = JSON.parse(`[{"symbol":"ITA","shares":8,"currentPrice":222.56,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"SOXL","shares":28,"currentPrice":51.14,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"TSLL","shares":191,"currentPrice":12.12,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"000660.KS","shares":2,"currentPrice":1007000,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"NVDL","shares":35,"currentPrice":72.09,"currency":"USD","marketType":"Overseas","category":"Overseas Stock"},{"symbol":"KORU","shares":3,"currentPrice":320.98,"currency":"USD","marketType":"Overseas","category":"Overseas Index"},{"symbol":"005930.KS","shares":46,"currentPrice":199400,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"005385.KS","shares":20,"currentPrice":265000,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"006800.KS","shares":23,"currentPrice":67700,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"},{"symbol":"488080.KS","shares":99,"currentPrice":46000,"currency":"KRW","marketType":"Domestic","category":"Domestic Stock"}]`);
        repo.history.upsert(h20);
    }
    
    // Re-adjust totalValue and allocations manually!
    const history = repo.history.getAll(true) as any[];
    for (let h of history) {
        if (!h.holdings) continue;
        const rate = h.exchangeRate || 1350;
        
        let invTotal = 0;
        h.allocations = h.allocations.map((alc: any) => {
            if (['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(alc.category)) {
                const catVal = h.holdings
                    .filter((i:any) => i.category === alc.category)
                    .reduce((sum: number, i: any) => {
                        const v = i.currentPrice * i.shares;
                        return sum + (i.currency === 'USD' ? v * rate : v);
                    }, 0);
                return { ...alc, value: alc.currency === 'USD' ? catVal / rate : catVal };
            }
            return alc;
        });

        // Compute total Value
        const aT = h.allocations.reduce((sum: number, a: any) => sum + (a.currency === 'USD' ? a.value * rate : a.value), 0);
        h.totalValue = aT;
        repo.history.upsert(h);
    }
    console.log('Restored');
}

restoreDB();
