import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import he from 'he';

export const revalidate = 300; // 5 minutes – breaking news needs fresher data

const parser = new Parser({
    customFields: {
        item: [
            ['description', 'description'],
            ['pubDate', 'pubDate'],
            ['author', 'author'],
            ['enclosure', 'content'],
            ['media:thumbnail', 'mediaThumbnail'],
            ['media:group', 'mediaGroup'],
            ['media:content', 'mediaContent', { keepArray: true }]
        ]
    }
});

const RSS_SOURCES: Record<string, { name: string, url: string }[]> = {
    politics: [{ name: 'SBS 뉴스', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER' }],
    economy: [{ name: 'SBS 뉴스', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02&plink=RSSREADER' }],
    society: [{ name: 'SBS 뉴스', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=03&plink=RSSREADER' }],
    world: [
        { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
        { name: 'CNN News', url: 'http://rss.cnn.com/rss/edition_world.rss' }
    ],
    breaking: [
        // 국내
        { name: '연합뉴스', url: 'https://www.yna.co.kr/rss/news.xml' },
        { name: 'SBS 국제', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=07&plink=RSSREADER' },
        // 해외
        { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
        { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
        { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
        { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
        { name: 'Financial Times', url: 'https://www.ft.com/rss/home/uk' },
        { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    ],
    iran: [
        // 이란/중동 전쟁 특집 – 광범위한 소스에서 Iran 관련 기사 수집
        { name: '연합뉴스', url: 'https://www.yna.co.kr/rss/news.xml' },
        { name: 'SBS 국제', url: 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=07&plink=RSSREADER' },
        { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
        { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
        { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
        { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
        { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
    ]
};

// ── Deduplication helpers ───────────────────────────────────────────────────
// Tokenise a title into meaningful words (strip punctuation, lowercase, skip short/stop words)
function tokenize(title: string): Set<string> {
    const stopwords = new Set([
        'the', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 'is', 'are', 'was',
        'were', 'for', 'and', 'or', 'but', 'with', 'by', 'as', 'its', 'has',
        '이', '가', '을', '를', '은', '는', '에', '의', '와', '과', '로', '으로',
        '한', '하다', '에서', '이런', '것', '수', '등', '및',
    ]);
    return new Set(
        title
            .toLowerCase()
            .replace(/[^\w가-힣]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopwords.has(w))
    );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    const intersection = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
}

// Deduplicate articles by title similarity using Jaccard index.
// Articles are already newest-first, so the first occurrence (newest) wins.
function deduplicate(articles: any[], threshold = 0.5): any[] {
    const result: any[] = [];
    const tokenSets: Set<string>[] = [];

    for (const article of articles) {
        const tokens = tokenize(article.title);
        const isDuplicate = tokenSets.some(existing => jaccardSimilarity(tokens, existing) >= threshold);
        if (!isDuplicate) {
            result.push(article);
            tokenSets.push(tokens);
        }
    }
    return result;
}
// ───────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'politics';

    try {
        const sources = RSS_SOURCES[category];
        if (!sources || sources.length === 0) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }

        const allArticles = await Promise.all(sources.map(async (source) => {
            try {
                const feed = await parser.parseURL(source.url);
                return feed.items.map((item: any) => {
                    let imageUrl = null;

                    // CNN
                    if (item.mediaGroup && item.mediaGroup['media:content'] && item.mediaGroup['media:content'].length > 0) {
                        const content = item.mediaGroup['media:content'][0];
                        if (content['$'] && content['$'].url) imageUrl = content['$'].url;
                    }

                    // NYT, Bloomberg, Al Jazeera using direct media:content
                    if (!imageUrl && item.mediaContent && Array.isArray(item.mediaContent) && item.mediaContent.length > 0) {
                        const content = item.mediaContent[0];
                        if (content['$'] && content['$'].url) imageUrl = content['$'].url;
                    } else if (!imageUrl && item.mediaContent && !Array.isArray(item.mediaContent)) {
                        if (item.mediaContent['$'] && item.mediaContent['$'].url) imageUrl = item.mediaContent['$'].url;
                    }

                    // BBC
                    if (!imageUrl && item.mediaThumbnail && item.mediaThumbnail['$'] && item.mediaThumbnail['$'].url) {
                        imageUrl = item.mediaThumbnail['$'].url;
                    }

                    // SBS or general html extraction
                    if (!imageUrl && (item.description || item.content)) {
                        const text = item.description || item.content;
                        const match = text.match(/<img[^>]+src="([^">]+)"/);
                        if (match) imageUrl = match[1];
                    }

                    return {
                        title: item.title ? he.decode(item.title) : '',
                        link: item.link,
                        pubDate: item.pubDate,
                        description: item.description ? he.decode(item.description.replace(/<[^>]*>?/gm, '')) : '',
                        imageUrl,
                        author: item.author || source.name,
                        guid: item.guid || item.link || Math.random().toString()
                    };
                });
            } catch (err) {
                console.error(`Failed to fetch RSS from ${source.name}`, err);
                return [];
            }
        }));

        let articles = allArticles.flat();

        // For breaking news: only keep articles published within the last 30 minutes.
        // If none are found (quiet period), fall back to the latest 10 articles.
        if (category === 'breaking') {
            const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
            const recent = articles.filter(a => {
                const t = new Date(a.pubDate).getTime();
                return !isNaN(t) && t >= thirtyMinutesAgo;
            });
            // Use recent articles if available; otherwise keep the freshest 10
            articles = recent.length > 0 ? recent : articles.slice(0, 10);
        }

        // For Iran war tab: filter to only Iran/Middle East conflict related articles
        if (category === 'iran') {
            const iranKeywordsEn = ['iran', 'iranian', 'tehran', 'israel', 'israeli', 'hezbollah', 'hamas', 'gaza', 'middle east', 'idf', 'netanyahu', 'war', 'missile', 'strike', 'airstrike', 'nuclear', 'irgc'];
            const iranKeywordsKo = ['이란', '테헤란', '이스라엘', '헤즈볼라', '하마스', '가자', '중동', '공습', '핵', '전쟁', '미사일', '네타냐후', '이란핵'];
            articles = articles.filter(a => {
                const text = (a.title + ' ' + (a.description || '')).toLowerCase();
                return iranKeywordsEn.some(k => text.includes(k)) || iranKeywordsKo.some(k => text.includes(k));
            });
        }

        // Sort by pubDate descending (newest first)
        articles.sort((a, b) => {
            const dateA = new Date(a.pubDate).getTime();
            const dateB = new Date(b.pubDate).getTime();
            return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        });

        // Deduplicate similar headlines for breaking/iran news (Jaccard similarity ≥ 0.5)
        if (category === 'breaking' || category === 'iran') {
            articles = deduplicate(articles, 0.5);
        }

        // Limit items
        articles = articles.slice(0, (category === 'breaking' || category === 'iran') ? 30 : 30);

        return NextResponse.json({ articles });
    } catch (error) {
        console.error('News fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
