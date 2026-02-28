interface PerplexityResponse {
  id: string;
  results: Array<{
    date: string;
    last_updated: string;
    snippet: string;
    title: string;
    url: string;
  }>;

}

export async function callPerplexity(prompt: string): Promise<PerplexityResponse | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    console.warn("PERPLEXITY_API_KEY not configured");
    return null;
  }

  try {
    const res = await fetch(process.env.PERPLEXITY_API_URL || "", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.PERPLEXITY_MODEL || "sonar",
        query: prompt,
        prompt,
        messages: [
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!res.ok) {
      console.error("Perplexity API error", res.status, await res.text());
      return null;
    }

    const data: PerplexityResponse = await res.json();

    if (!data?.results) {
      console.warn("Perplexity API returned no results");
      return null;
    }
    
    return data ?? null;
  } catch (err) {
    console.error("callPerplexity error:", err);
    return null;
  }
}
