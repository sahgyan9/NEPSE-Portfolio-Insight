import unittest
import json
import os
import sys

# Add project root to path to import nepse_server
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nepse_server import app

class TestNepseServer(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_health_endpoint(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('status'), 'ok')
        self.assertEqual(data.get('service'), 'nepse-server')

    def test_invalid_stock(self):
        # Invalid symbols should handle gracefully (no crash)
        response = self.client.get('/api/stock/INVALID_XYZ_123')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('symbol'), 'INVALID_XYZ_123')
        # Either has 'error' key or all financial metrics are None
        if 'error' not in data:
            self.assertIsNone(data.get('book_value'))
            self.assertIsNone(data.get('eps'))
            self.assertIsNone(data.get('pe_ratio'))

    def test_all_news(self):
        response = self.client.get('/api/news')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        # Should be a dict (database format)
        self.assertIsInstance(data, dict)

    def test_quarterly_list(self):
        response = self.client.get('/api/quarterly/list')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('symbols', data)
        self.assertIsInstance(data['symbols'], list)

    def test_quarterly_top_performers(self):
        response = self.client.get('/api/quarterly/top-performers')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('periods', data)
        self.assertIn('latestPeriod', data)

    def test_all_stocks_endpoint(self):
        response = self.client.get('/api/nepse/all-stocks')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('stocks', data)
        self.assertIn('count', data)
        self.assertGreater(data.get('count', 0), 0)

    def test_investment_ipos_endpoint(self):
        response = self.client.get('/api/investment/ipos')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('issues', data)
        self.assertIn('count', data)

    def test_high_low_scanner_endpoint(self):
        response = self.client.get('/api/market/high-low-scanner')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('rows', data)
        self.assertIn('count', data)

    def test_nav_niblsf_endpoint(self):
        response = self.client.get('/api/nav/NIBLSF')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('symbol'), 'NIBLSF')
        self.assertIsNotNone(data.get('nav'))
        self.assertGreater(data.get('nav'), 0)

    def test_niblsf_stock_endpoint(self):
        response = self.client.get('/api/stock/NIBLSF')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('symbol'), 'NIBLSF')
        self.assertEqual(data.get('sector'), 'Mutual Fund')
        self.assertIsNotNone(data.get('last_traded_price'))
        self.assertGreater(data.get('last_traded_price'), 0)


if __name__ == '__main__':
    unittest.main()
