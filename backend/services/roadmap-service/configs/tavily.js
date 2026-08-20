import dotenv from "dotenv";
dotenv.config();

// Real search results instead of URLs recalled from training data. The LLM
// used to invent plausible-looking documentation links — a measured 1 in 5
// returned 404 — because it was asked to remember a URL rather than find one.
//
// Optional by design: with no key configured this returns null and the caller
// falls back to the previous LLM-suggested link, so the roadmap still works.

const ENDPOINT = "https://api.tavily.com/search";

export const hasTavily = () => Boolean(process.env.TAVILY_API_KEY);

// Prefer canonical documentation over blogspam when both come back.
const DOC_HINTS = /docs?\.|developer\.|\.dev\/|readthedocs|\/documentation|\/guide|\/tutorial|\/learn/i;
const LOW_VALUE = /pinterest|quora|reddit|facebook|linkedin\.com\/posts|slideshare/i;

const scoreResult = (r) => {
  const url = r?.url || "";
  if (!url || LOW_VALUE.test(url)) return -1;
  let s = Number(r.score) || 0;
  if (DOC_HINTS.test(url)) s += 0.5;
  return s;
};

/**
 * Find one documentation/tutorial link for a roadmap module.
 * Returns a URL string, or null if Tavily is unconfigured or finds nothing.
 */
export const searchDoc = async (topic) => {
  if (!hasTavily() || !topic) return null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${topic} official documentation or in-depth tutorial`,
        max_results: 5,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.log(`Tavily search failed for "${topic}": HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const ranked = (data.results || [])
      .map((r) => ({ r, s: scoreResult(r) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

    return ranked[0]?.r?.url || null;

  } catch (error) {
    console.log(`Tavily search error for "${topic}": ${error.message}`);
    return null;
  }
};

export default searchDoc;
