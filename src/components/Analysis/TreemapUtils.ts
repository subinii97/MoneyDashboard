export interface Rect { x: number; y: number; w: number; h: number; }

export function squarifyLayout(
    values: number[],
    x: number, y: number, w: number, h: number
): Rect[] {
    if (!values.length) return [];
    const total = values.reduce((s, v) => s + v, 0);
    const areas = values.map(v => (v / total) * w * h);
    const result: Rect[] = new Array(values.length);

    function worstAspect(row: number[], rowW: number): number {
        const rowSum = row.reduce((s, a) => s + a, 0);
        const rowH = rowSum / rowW;
        let worst = 0;
        for (const a of row) {
            const cellW = rowW > 0 ? a / rowH : 0;
            const ratio = Math.max(rowH / cellW, cellW / rowH);
            if (ratio > worst) worst = ratio;
        }
        return worst;
    }

    function layout(indices: number[], ix: number, iy: number, iw: number, ih: number) {
        if (!indices.length) return;
        if (indices.length === 1) {
            result[indices[0]] = { x: ix, y: iy, w: iw, h: ih };
            return;
        }

        const iAreas = indices.map(i => areas[i]);
        const iTotal = iAreas.reduce((s, a) => s + a, 0);
        const lays: Array<{ split: number; aspect: number }> = [];
        let cumArea = 0;
        for (let k = 0; k < indices.length - 1; k++) {
            cumArea += iAreas[k];
            const rowDir = iw >= ih;
            const bandW = rowDir ? (iTotal > 0 ? (cumArea / iTotal) * iw : 0) : iw;
            const bandH = rowDir ? ih : (iTotal > 0 ? (cumArea / iTotal) * ih : 0);
            const row = iAreas.slice(0, k + 1);
            const aspect = worstAspect(row, rowDir ? bandH : bandW);
            lays.push({ split: k + 1, aspect });
        }

        let bestSplit = 1;
        let bestAspect = Infinity;
        for (const l of lays) {
            if (l.aspect < bestAspect) { bestAspect = l.aspect; bestSplit = l.split; }
        }

        const leftIndices = indices.slice(0, bestSplit);
        const rightIndices = indices.slice(bestSplit);
        const leftArea = leftIndices.reduce((s, i) => s + areas[i], 0);

        if (iw >= ih) {
            const leftW = iTotal > 0 ? (leftArea / iTotal) * iw : 0;
            let cy = iy;
            for (const i of leftIndices) {
                const cellH = leftArea > 0 ? (areas[i] / leftArea) * ih : 0;
                result[i] = { x: ix, y: cy, w: leftW, h: cellH };
                cy += cellH;
            }
            layout(rightIndices, ix + leftW, iy, iw - leftW, ih);
        } else {
            const topH = iTotal > 0 ? (leftArea / iTotal) * ih : 0;
            let cx = ix;
            for (const i of leftIndices) {
                const cellW = leftArea > 0 ? (areas[i] / leftArea) * iw : 0;
                result[i] = { x: cx, y: iy, w: cellW, h: topH };
                cx += cellW;
            }
            layout(rightIndices, ix, iy + topH, iw, ih - topH);
        }
    }

    const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const origAreas = [...areas];
    sorted.forEach((s, k) => { areas[k] = origAreas[s.i]; });
    layout(sorted.map((_, k) => k), x, y, w, h);
    const finalResult: Rect[] = new Array(values.length);
    sorted.forEach((s, k) => { finalResult[s.i] = result[k]; });
    return finalResult;
}

export function getColor(inputPct: number) {
    const pct = Math.round(inputPct * 100) / 100;
    if (pct === 0) return { bg: '#252528', text: '#777', border: '#333' };

    if (pct > 0) {
        if (pct >= 5.0) return { bg: '#ff1a1a', text: '#fff', border: '#ff7875' };
        if (pct >= 3.0) return { bg: '#d91818', text: '#f5f5f5', border: '#ff7875' };
        if (pct >= 2.0) return { bg: '#b31515', text: '#e0e0e0', border: '#ffa39e' };
        if (pct >= 1.0) return { bg: '#8c1212', text: '#bdbdbd', border: '#cf1322' };
        return { bg: '#45121a', text: '#9e9e9e', border: '#a8071a' };
    } else {
        const abs = Math.abs(pct);
        if (abs >= 5.0) return { bg: '#006fff', text: '#fff', border: '#69c0ff' };
        if (abs >= 3.0) return { bg: '#1677ff', text: '#f5f5f5', border: '#40a9ff' };
        if (abs >= 2.0) return { bg: '#0050b3', text: '#e0e0e0', border: '#1890ff' };
        if (abs >= 1.0) return { bg: '#003a8c', text: '#bdbdbd', border: '#096dd9' };
        return { bg: '#101a33', text: '#9e9e9e', border: '#001d66' };
    }
}
