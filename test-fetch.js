import { fetchQuote } from './src/lib/stock.js';

async function test() {
    const res = await fetchQuote('AAPL.O');
    console.log(JSON.stringify(res, null, 2));
}

test();
