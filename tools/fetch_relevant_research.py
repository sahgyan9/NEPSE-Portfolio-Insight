import urllib.request
import urllib.parse
import json
import argparse
import time

def fetch_openalex_research(query, limit=5):
    """Fetch research papers from OpenAlex based on a query."""
    print(f"Fetching macro-economic research for: '{query}'...")
    
    # OpenAlex API URL
    encoded_query = urllib.parse.quote(query)
    url = f"https://api.openalex.org/works?search={encoded_query}&per-page={limit}"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'PortfolioInsightAgent'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
            results = data.get('results', [])
            
            if not results:
                print("No papers found for this query.")
                return []
                
            papers = []
            for work in results:
                paper = {
                    "title": work.get("title", "Unknown Title"),
                    "publication_year": work.get("publication_year"),
                    "cited_by_count": work.get("cited_by_count", 0),
                    "url": work.get("id"),
                    "open_access_pdf": None
                }
                
                # Check for open access URL
                oa = work.get("open_access", {})
                if oa and oa.get("is_oa"):
                    paper["open_access_pdf"] = oa.get("oa_url")
                
                papers.append(paper)
                
            return papers
            
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("Rate limit exceeded. OpenAlex anonymous pool is busy. Try again later.")
        else:
            print(f"HTTP Error {e.code}: {e.reason}")
        return []
    except Exception as e:
        print(f"Error fetching from OpenAlex: {e}")
        return []

def main():
    parser = argparse.ArgumentParser(description="Fetch macro-economic research papers.")
    parser.add_argument("--query", type=str, default="Nepal monetary policy OR NRB", help="Search query")
    parser.add_argument("--limit", type=int, default=5, help="Number of papers to fetch")
    args = parser.parse_args()
    
    # Pre-defined queries for Nepal market context
    queries = [
        "Nepal monetary policy impact",
        "Nepal Rastra Bank liquidity",
        "NEPSE stock market efficiency",
        "Frontier market portfolio optimization"
    ]
    
    if args.query != "Nepal monetary policy OR NRB":
        queries = [args.query]
        
    all_papers = []
    
    for q in queries:
        papers = fetch_openalex_research(q, limit=args.limit)
        all_papers.extend(papers)
        # Polite delay
        time.sleep(1)
        
    # Deduplicate by URL
    seen = set()
    unique_papers = []
    for p in all_papers:
        if p["url"] not in seen:
            seen.add(p["url"])
            unique_papers.append(p)
            
    # Sort by citations and recency (basic heuristic)
    unique_papers.sort(key=lambda x: (x.get("publication_year") or 0, x.get("cited_by_count") or 0), reverse=True)
    
    print("\n" + "="*60)
    print("MACRO-ECONOMIC RESEARCH INTELLIGENCE")
    print("="*60)
    
    for i, p in enumerate(unique_papers[:10]):
        print(f"\n[{i+1}] {p['title']}")
        print(f"    Year: {p['publication_year']} | Citations: {p['cited_by_count']}")
        print(f"    Link: {p['url']}")
        if p['open_access_pdf']:
            print(f"    PDF:  {p['open_access_pdf']}")
            
    # Save to file
    output_path = "db/macro_research.json"
    import os
    os.makedirs("db", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(unique_papers, f, indent=2)
        
    print(f"\nSaved {len(unique_papers)} papers to {output_path}")

if __name__ == "__main__":
    main()
