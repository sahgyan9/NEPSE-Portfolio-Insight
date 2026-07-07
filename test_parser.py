import sys
sys.path.insert(0, '.')
from pdf_parser import parse_pdf

PDFS = [
    ('d:/Investment/SAHAS/2082-83-Q3.pdf', 3, '2082-83', 'SAHAS', 34.48, 176.74, 41.78),
    ('d:/Investment/SAHAS/2082-83-Q2.pdf', 2, '2082-83', 'SAHAS', None, None, None),
]

all_pass = True
for pdf_path, expected_q, expected_fy, expected_sym, exp_eps, exp_bvps, exp_yoy_np in PDFS:
    print(f'\n=== Testing {pdf_path} ===')
    try:
        r = parse_pdf(pdf_path)
        sym = r['symbol']
        fy  = r['fy']
        q   = r['quarter']
        cn  = r['company_name']
        eps = r['computed']['eps_ttm']
        bvps = r['computed']['bvps']
        yoy  = r['yoy']['net_profit']
        np_  = r['raw']['net_profit']
        rev  = r['raw']['revenue']
        eq   = r['raw']['total_equity']
        ast  = r['raw']['total_assets']
        shr  = r['raw']['shares']

        print(f'  Symbol:         {sym}   (expected: {expected_sym})')
        print(f'  FY:             {fy}   (expected: {expected_fy})')
        print(f'  Quarter:        Q{q}   (expected: Q{expected_q})')
        print(f'  Company:        {cn}')
        print(f'  EPS TTM:        {eps}   (expected: {exp_eps})')
        print(f'  BVPS:           {bvps}   (expected: {exp_bvps})')
        print(f'  Net Profit YoY: {yoy}%  (expected: {exp_yoy_np}%)')
        print(f'  Raw Net Profit: {np_:,.0f}' if np_ else '  Raw Net Profit: N/A')
        print(f'  Raw Revenue:    {rev:,.0f}' if rev else '  Raw Revenue: N/A')
        print(f'  Raw Equity:     {eq:,.0f}' if eq else '  Raw Equity: N/A')
        print(f'  Raw Assets:     {ast:,.0f}' if ast else '  Raw Assets: N/A')
        print(f'  Shares:         {shr:,.0f}' if shr else '  Shares: N/A')

        assert sym == expected_sym, f'Symbol mismatch: got {sym}'
        assert fy  == expected_fy,  f'FY mismatch: got {fy}'
        assert q   == expected_q,   f'Quarter mismatch: got {q}'
        if exp_eps is not None:
            assert eps is not None and abs(eps - exp_eps) < 1.5, f'EPS mismatch: got {eps}'
        if exp_bvps is not None:
            assert bvps is not None and abs(bvps - exp_bvps) < 2, f'BVPS mismatch: got {bvps}'
        print('  PASS - all assertions OK')
    except AssertionError as e:
        print(f'  ASSERTION FAILED: {e}')
        all_pass = False
    except Exception as e:
        import traceback
        print(f'  ERROR: {e}')
        traceback.print_exc()
        all_pass = False

print()
print('=' * 50)
print('RESULT:', 'ALL TESTS PASSED' if all_pass else 'SOME TESTS FAILED')
