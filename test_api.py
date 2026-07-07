"""Quick integration test against the running Flask server."""
import sys, json, urllib.request, urllib.error

def test_upload(pdf_path, label):
    boundary = 'FormBoundary7MA4YWxkTrZu0gW'
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()

    disp = 'Content-Disposition: form-data; name="pdf"; filename="test.pdf"\r\n'
    ctype = 'Content-Type: application/pdf\r\n\r\n'
    header = ('--' + boundary + '\r\n' + disp + ctype).encode()
    footer = ('\r\n--' + boundary + '--\r\n').encode()
    body = header + pdf_bytes + footer

    req = urllib.request.Request(
        'http://localhost:8000/api/quarterly/upload',
        data=body,
        method='POST',
        headers={'Content-Type': 'multipart/form-data; boundary=' + boundary}
    )
    try:
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
            status = data.get('status')
    except urllib.error.HTTPError as e:
        data = json.loads(e.read())
        status = data.get('status', 'error')

    print(f'\n--- {label} ---')
    print(f'  HTTP status: {status}')
    print(f'  Symbol:      {data.get("symbol")}')
    print(f'  Quarter:     {data.get("quarter_label")}')
    c = data.get('computed', {})
    print(f'  EPS TTM:     {c.get("eps_ttm")}')
    print(f'  BVPS:        {c.get("bvps")}')
    y = data.get('yoy', {})
    print(f'  YoY NP:      {y.get("net_profit")}%')
    return status

# Test 1: Upload Q3
s1 = test_upload('d:/Investment/SAHAS/2082-83-Q3.pdf', 'Upload Q3')
assert s1 == 'success', f'Expected success, got {s1}'

# Test 2: Upload Q2
s2 = test_upload('d:/Investment/SAHAS/2082-83-Q2.pdf', 'Upload Q2')
assert s2 == 'success', f'Expected success, got {s2}'

# Test 3: Duplicate detection (re-upload Q3)
s3 = test_upload('d:/Investment/SAHAS/2082-83-Q3.pdf', 'Duplicate Q3 (expect duplicate)')
assert s3 == 'duplicate', f'Expected duplicate, got {s3}'

# Test 4: List endpoint
with urllib.request.urlopen('http://localhost:8000/api/quarterly/list') as r:
    data = json.loads(r.read())
print('\n--- List ---')
for sym in data.get('symbols', []):
    print(f'  {sym["symbol"]}: {sym["quarter_count"]} quarters')

# Test 5: Get SAHAS data
with urllib.request.urlopen('http://localhost:8000/api/quarterly/SAHAS') as r:
    d = json.loads(r.read())
print(f'\n--- SAHAS quarters stored: {d["quarter_count"]} ---')
for q in d.get('quarters', []):
    print(f'  {q["quarter_label"]}  EPS={q["computed"]["eps_ttm"]}  BVPS={q["computed"]["bvps"]}')

print('\n============================')
print('ALL INTEGRATION TESTS PASSED')
