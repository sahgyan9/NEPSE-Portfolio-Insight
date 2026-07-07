"""
NEPSE Stock Data Scraper
========================
Scrapes fundamental data for all NEPSE-listed companies from Merolagani.com
and generates SQL INSERT statements for Supabase.

Usage:
    python scrape_all_stocks.py

Output:
    - stock_data_insert.sql: SQL file with INSERT statements
    - stock_data.json: JSON file with all scraped data
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import re
import json
from datetime import datetime
import time

# All NEPSE listed companies (272 as of December 2025)
# Source: https://nepalstock.com/company
NEPSE_SYMBOLS = [
    # Commercial Banks (20)
    "ADBL", "BOKL", "CCBL", "CZBIL", "EBL", "GBIME", "HBL", "KBL", "LBL", "MBL",
    "MEGA", "NABIL", "NBL", "NICA", "NIMB", "NMB", "PCBL", "PRVU", "SANIMA", "SBI",
    "SCB", "SBL", 
    
    # Development Banks (17)
    "CORBL", "EDBL", "GBBL", "GRDBL", "JBBL", "KSBBL", "KRBL", "LBBL", "MLBL", 
    "MNBBL", "MDB", "NABBC", "SADBL", "SAPDBL", "SHINE", "SINDU", "SRBL",
    
    # Finance Companies (16)
    "BFC", "CFCL", "GFCL", "GMFIL", "GUFL", "ICFC", "JFL", "MFIL", "MPFL", 
    "NFS", "PFL", "PROFL", "RLFL", "SFCL", "SIFC", "UFL",
    
    # Microfinance (60+)
    "ACLBSL", "ALBSL", "CBBL", "CLBSL", "DDBL", "FMDBL", "FOWAD", "GILB", 
    "GLBSL", "GMFBS", "GBLBS", "ILBS", "JSLBB", "JALPA", "KMCDB", "KLBSL", 
    "LLBS", "MLBSL", "MERO", "MKLB", "MLBS", "MSLB", "NADEP", "NESDO", 
    "NICLBSL", "NLBBL", "NMBMF", "NMFBS", "RSDC", "RMDC", "RULB", "SABSL", 
    "SAMAJ", "SDLBSL", "SKBBL", "SLBSL", "SMATA", "SMFDB", "SMFBS", "SMB", 
    "SPDBL", "SWBBL", "SWMF", "ULBSL", "USLB", "VLBS", "WOMI", "WNLB",
    
    # Life Insurance (19)
    "ALICL", "CLI", "GLICL", "HLI", "ILI", "JLI", "LICN", "NLICL", "NLIC", 
    "PLI", "PLIC", "PMLI", "RNLI", "SLICL", "SNLI", "SLI", "SJLIC", "SULI", "ULI",
    
    # Non-Life Insurance (17)
    "AIL", "EIC", "GIC", "HGI", "IGI", "LGIL", "NICL", "NIL", "NLG", "PBGI", 
    "PICL", "PRIN", "RBCL", "SIC", "SGI", "SGIC", "SIL",
    
    # Reinsurance (2)
    "HRL", "NRN",
    
    # Hydro Power (40+)
    "AHPC", "AHL", "AKJCL", "AKPL", "API", "BARUN", "BHL", "BPCL", "BNHC", 
    "CHCL", "CHL", "DHPL", "GHL", "GLH", "HDHPC", "HPPL", "HURJA", "JOSHI", 
    "KPCL", "KKHC", "LEC", "MAKAR", "MANDU", "MEN", "MHCL", "MHNL", "MKJC", 
    "MLHC", "MSHL", "NGPL", "NHPC", "NHDL", "NYADI", "PPCL", "RADHI", "RIDI", 
    "RHPL", "RURU", "SAHAS", "SGHC", "SHEL", "SHPC", "SIKLES", "SJCL", "SONA", 
    "SSHL", "TPCL", "UMHL", "UMRH", "UNHPL", "UPCL", "UPPER",
    
    # Manufacturing & Processing (10)
    "BNT", "GRU", "HDL", "JSM", "NLO", "SARBTM", "GCIL", "SHIVM", "UNL", "SRS",
    
    # Hotels & Tourism (4)
    "CGH", "OHL", "SHL", "TRH",
    
    # Trading (5)
    "BBC", "NTL", "STC", "NTC",
    
    # Investment (8)
    "CIT", "HIDCL", "NIFRA", "NRN", "NHPC", "CHDC",
    
    # Others (10)
    "NTC", "NRIC", "NEF", "NICGF", "NRM", "NWCL",
    
    # Mutual Funds (30+)
    "CMF1", "CMF2", "GIMES1", "KDBY", "KEF", "LUK", "LEMF", "MEN", "MERO",
    "MMF1", "NBF2", "NBF3", "NBSF", "NICBF", "NICGF", "NIBLPF", "NIBLSF", 
    "NICSF", "NMB50", "NMBHF1", "NMBSBFE", "NSM", "PSF", "SABSL", "SAEF", 
    "SBCF", "SEF", "SFEF", "SIGS2", "SLCF", "TYF", "YOF", "CSY",
]

# Remove duplicates and sort
NEPSE_SYMBOLS = sorted(list(set(NEPSE_SYMBOLS)))


class MerolaganiScraper:
    """Scrapes fundamental data from Merolagani.com"""
    
    def __init__(self):
        self.base_url = "https://merolagani.com/CompanyDetail.aspx"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        self.results = []
        self.errors = []
    
    def extract_value(self, soup, label_text):
        """Extract numeric value from Merolagani table format"""
        try:
            # Try finding by th label
            label = soup.find('th', string=re.compile(label_text, re.I))
            if label:
                value_cell = label.find_next('td')
                if value_cell:
                    text = value_cell.get_text(strip=True)
                    text = text.replace(',', '').replace('%', '').replace('Rs.', '').strip()
                    if text and text != '-' and text != 'N/A':
                        return float(text)
        except (ValueError, AttributeError):
            pass
        return None
    
    def extract_company_name(self, soup, symbol):
        """Extract company name from page"""
        try:
            # Try the company name header (e.g., "Nabil Bank Limited")
            name_elem = soup.find('h1', class_='media-heading')
            if name_elem:
                name = name_elem.get_text(strip=True)
                # Remove symbol in parentheses if present
                name = re.sub(r'\s*\([A-Z0-9]+\)\s*$', '', name).strip()
                if name:
                    return name
            
            # Try finding from the title - extract just the company name
            title = soup.find('title')
            if title:
                text = title.get_text(strip=True)
                # Pattern: "Company Name (SYMBOL) Detail..." or "merolagani - Company Name (SYMBOL)..."
                match = re.search(r'(?:merolagani\s*-\s*)?([^(]+)\s*\(' + symbol + r'\)', text, re.I)
                if match:
                    return match.group(1).strip()
        except:
            pass
        return symbol  # Fallback to symbol if name not found
    
    def extract_sector(self, soup):
        """Extract sector from page"""
        try:
            sector_label = soup.find('th', string=re.compile('Sector', re.I))
            if sector_label:
                sector_cell = sector_label.find_next('td')
                if sector_cell:
                    return sector_cell.get_text(strip=True)
        except:
            pass
        return None
    
    async def fetch_stock(self, client, symbol):
        """Fetch fundamental data for a single stock"""
        url = f"{self.base_url}?symbol={symbol}"
        
        try:
            response = await client.get(url, headers=self.headers, timeout=30.0)
            
            if response.status_code != 200:
                self.errors.append({'symbol': symbol, 'error': f'HTTP {response.status_code}'})
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            company_name = self.extract_company_name(soup, symbol) or symbol
            sector = self.extract_sector(soup)
            
            data = {
                'symbol': symbol.upper(),
                'company_name': company_name,
                'sector': sector,
                'book_value': self.extract_value(soup, 'Book Value'),
                'eps': self.extract_value(soup, r'^EPS$'),  # Exact match for EPS
                'pe_ratio': self.extract_value(soup, 'P/E Ratio'),
                'pb_ratio': self.extract_value(soup, 'Price.*Book|PBV'),
                'roe': self.extract_value(soup, 'ROE'),
                'dividend_yield': self.extract_value(soup, 'Dividend Yield'),
                'market_cap': self.extract_value(soup, 'Market Capitalization'),
                'shares_outstanding': self.extract_value(soup, 'Total Listed Shares|Shares Outstanding'),
                'week_52_high': self.extract_value(soup, '52.*Week.*High'),
                'week_52_low': self.extract_value(soup, '52.*Week.*Low'),
                'current_price': self.extract_value(soup, 'Last Traded Price|LTP'),
            }
            
            print(f"✓ {symbol}: {company_name[:40]}...")
            return data
            
        except Exception as e:
            self.errors.append({'symbol': symbol, 'error': str(e)})
            print(f"✗ {symbol}: {e}")
            return None
    
    async def scrape_all(self, symbols, batch_size=5, delay=1.0):
        """Scrape all symbols with rate limiting"""
        print(f"\n{'='*60}")
        print(f"Starting scrape of {len(symbols)} stocks...")
        print(f"{'='*60}\n")
        
        async with httpx.AsyncClient() as client:
            for i in range(0, len(symbols), batch_size):
                batch = symbols[i:i+batch_size]
                tasks = [self.fetch_stock(client, symbol) for symbol in batch]
                results = await asyncio.gather(*tasks)
                
                for result in results:
                    if result:
                        self.results.append(result)
                
                # Progress update
                done = min(i + batch_size, len(symbols))
                print(f"\nProgress: {done}/{len(symbols)} ({100*done/len(symbols):.1f}%)")
                
                # Rate limiting delay
                if i + batch_size < len(symbols):
                    await asyncio.sleep(delay)
        
        return self.results
    
    def generate_sql(self, output_file='stock_data_insert.sql'):
        """Generate SQL INSERT statements"""
        if not self.results:
            print("No data to generate SQL from!")
            return
        
        sql_lines = [
            "-- Auto-generated stock data for NEPSE companies",
            f"-- Generated on: {datetime.now().isoformat()}",
            f"-- Total companies: {len(self.results)}",
            "",
            "-- Clear existing data (optional - uncomment if needed)",
            "-- TRUNCATE TABLE public.stock_data;",
            "",
            "-- Insert/Update stock data",
            "INSERT INTO public.stock_data (",
            "    symbol, company_name, sector, book_value, eps, pe_ratio, pb_ratio,",
            "    roe, dividend_yield, market_cap, shares_outstanding,",
            "    week_52_high, week_52_low, current_price, is_active, last_fundamentals_update",
            ") VALUES"
        ]
        
        values = []
        for stock in self.results:
            def sql_val(v):
                if v is None:
                    return "NULL"
                if isinstance(v, str):
                    # Escape single quotes
                    return f"'{v.replace(chr(39), chr(39)+chr(39))}'"
                return str(v)
            
            value_line = f"""(
    {sql_val(stock['symbol'])},
    {sql_val(stock['company_name'])},
    {sql_val(stock['sector'])},
    {sql_val(stock['book_value'])},
    {sql_val(stock['eps'])},
    {sql_val(stock['pe_ratio'])},
    {sql_val(stock['pb_ratio'])},
    {sql_val(stock['roe'])},
    {sql_val(stock['dividend_yield'])},
    {sql_val(stock['market_cap'])},
    {sql_val(int(stock['shares_outstanding']) if stock['shares_outstanding'] else None)},
    {sql_val(stock['week_52_high'])},
    {sql_val(stock['week_52_low'])},
    {sql_val(stock['current_price'])},
    true,
    NOW()
)"""
            values.append(value_line)
        
        sql_lines.append(',\n'.join(values))
        sql_lines.append("""
ON CONFLICT (symbol) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    sector = EXCLUDED.sector,
    book_value = EXCLUDED.book_value,
    eps = EXCLUDED.eps,
    pe_ratio = EXCLUDED.pe_ratio,
    pb_ratio = EXCLUDED.pb_ratio,
    roe = EXCLUDED.roe,
    dividend_yield = EXCLUDED.dividend_yield,
    market_cap = EXCLUDED.market_cap,
    shares_outstanding = EXCLUDED.shares_outstanding,
    week_52_high = EXCLUDED.week_52_high,
    week_52_low = EXCLUDED.week_52_low,
    current_price = EXCLUDED.current_price,
    last_fundamentals_update = NOW(),
    last_updated = NOW();
""")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(sql_lines))
        
        print(f"\n✓ SQL file generated: {output_file}")
        return output_file
    
    def save_json(self, output_file='stock_data.json'):
        """Save results to JSON file"""
        output = {
            'generated_at': datetime.now().isoformat(),
            'total_stocks': len(self.results),
            'errors': self.errors,
            'data': self.results
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"✓ JSON file saved: {output_file}")
        return output_file


async def main():
    scraper = MerolaganiScraper()
    
    # Scrape all stocks
    await scraper.scrape_all(NEPSE_SYMBOLS, batch_size=5, delay=1.5)
    
    # Generate outputs
    print(f"\n{'='*60}")
    print("SCRAPING COMPLETE")
    print(f"{'='*60}")
    print(f"✓ Successfully scraped: {len(scraper.results)} stocks")
    print(f"✗ Errors: {len(scraper.errors)} stocks")
    
    if scraper.errors:
        print("\nFailed symbols:")
        for err in scraper.errors:
            print(f"  - {err['symbol']}: {err['error']}")
    
    # Generate files
    scraper.generate_sql('stock_data_insert.sql')
    scraper.save_json('stock_data.json')
    
    print(f"\n{'='*60}")
    print("NEXT STEPS:")
    print("1. Review the generated stock_data_insert.sql file")
    print("2. Go to Supabase Dashboard > SQL Editor")
    print("3. Paste and run the SQL to populate stock_data table")
    print(f"{'='*60}")


if __name__ == '__main__':
    asyncio.run(main())
