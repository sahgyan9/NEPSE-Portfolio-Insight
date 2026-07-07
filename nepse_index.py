"""
NEPSE Live Index Fetcher
========================
A reusable module to fetch live NEPSE index and market data.

Usage:
------
    from nepse_index import get_nepse_index, get_market_status, get_all_indices
    
    # Get main NEPSE index
    index = get_nepse_index()
    print(f"NEPSE: {index['value']} ({index['change_pct']}%)")
    
    # Check if market is open
    status = get_market_status()
    print(f"Market: {status}")
    
    # Get all indices
    all_data = get_all_indices()

Requirements:
-------------
    pip install nepse@git+https://github.com/basic-bgnr/NepseUnofficialApi.git@dev

Author: Generated for educational purposes
Source: Nepal Stock Exchange (Unofficial API)
"""

from nepse import AsyncNepse
import asyncio
from typing import Optional, List, Dict, Any
from dataclasses import dataclass


@dataclass
class IndexData:
    """Data class representing index information"""
    name: str
    current_value: float
    change: float
    change_pct: float
    high: float
    low: float
    previous_close: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'value': self.current_value,
            'change': self.change,
            'change_pct': self.change_pct,
            'high': self.high,
            'low': self.low,
            'previous_close': self.previous_close
        }


class NepseIndexAPI:
    """
    API client for fetching live NEPSE index data
    
    Example:
        api = NepseIndexAPI()
        
        # Get NEPSE index
        nepse = await api.get_nepse_index()
        print(f"NEPSE: {nepse.current_value} ({nepse.change_pct:+.2f}%)")
        
        # Get all main indices
        indices = await api.get_main_indices()
        
        # Get sub-indices (Banking, Hydro, etc.)
        sub = await api.get_sub_indices()
        
        # Check market status
        is_open = await api.is_market_open()
    """
    
    def __init__(self):
        self._nepse = AsyncNepse()
        self._nepse.setTLSVerification(False)
    
    async def get_main_indices(self) -> List[IndexData]:
        """
        Get all main indices (NEPSE, Sensitive, Float)
        
        Returns:
            List of IndexData objects
        """
        raw_data = await self._nepse.getNepseIndex()
        
        indices = []
        for idx in raw_data:
            indices.append(IndexData(
                name=idx.get('index', 'Unknown'),
                current_value=idx.get('currentValue', 0),
                change=idx.get('change', 0),
                change_pct=idx.get('perChange', 0),
                high=idx.get('high', 0),
                low=idx.get('low', 0),
                previous_close=idx.get('previousClose', 0)
            ))
        
        return indices
    
    async def get_nepse_index(self) -> Optional[IndexData]:
        """
        Get only the main NEPSE index
        
        Returns:
            IndexData for NEPSE Index, or None if not found
        """
        indices = await self.get_main_indices()
        for idx in indices:
            if 'NEPSE Index' in idx.name:
                return idx
        return indices[0] if indices else None
    
    async def get_sub_indices(self) -> List[IndexData]:
        """
        Get all sector sub-indices (Banking, Hydro, Insurance, etc.)
        
        Returns:
            List of IndexData objects
        """
        raw_data = await self._nepse.getNepseSubIndices()
        
        indices = []
        for idx in raw_data:
            indices.append(IndexData(
                name=idx.get('index', 'Unknown'),
                current_value=idx.get('currentValue', 0),
                change=idx.get('change', 0),
                change_pct=idx.get('perChange', 0),
                high=idx.get('high', 0),
                low=idx.get('low', 0),
                previous_close=idx.get('previousClose', 0)
            ))
        
        return indices
    
    async def is_market_open(self) -> bool:
        """Check if NEPSE market is currently open"""
        status = await self._nepse.isNepseOpen()
        return status.get('isOpen', '').upper() == 'OPEN'
    
    async def get_market_status(self) -> Dict[str, Any]:
        """
        Get detailed market status
        
        Returns:
            Dictionary with 'is_open', 'status', and 'as_of' fields
        """
        status = await self._nepse.isNepseOpen()
        return {
            'is_open': status.get('isOpen', '').upper() == 'OPEN',
            'status': status.get('isOpen', 'UNKNOWN'),
            'as_of': status.get('asOf', '')
        }
    
    async def get_all_data(self) -> Dict[str, Any]:
        """
        Get all index data in one call
        
        Returns:
            Dictionary with 'nepse_index', 'main_indices', 'sub_indices', 'market_status'
        """
        main_indices = await self.get_main_indices()
        sub_indices = await self.get_sub_indices()
        market_status = await self.get_market_status()
        
        nepse_idx = None
        for idx in main_indices:
            if 'NEPSE Index' in idx.name:
                nepse_idx = idx
                break
        
        return {
            'nepse_index': nepse_idx.to_dict() if nepse_idx else None,
            'main_indices': [i.to_dict() for i in main_indices],
            'sub_indices': [i.to_dict() for i in sub_indices],
            'market_status': market_status
        }
    
    # Synchronous wrappers
    def get_nepse_index_sync(self) -> Optional[IndexData]:
        """Sync wrapper for get_nepse_index"""
        return asyncio.run(self.get_nepse_index())
    
    def get_main_indices_sync(self) -> List[IndexData]:
        """Sync wrapper for get_main_indices"""
        return asyncio.run(self.get_main_indices())
    
    def get_sub_indices_sync(self) -> List[IndexData]:
        """Sync wrapper for get_sub_indices"""
        return asyncio.run(self.get_sub_indices())
    
    def is_market_open_sync(self) -> bool:
        """Sync wrapper for is_market_open"""
        return asyncio.run(self.is_market_open())
    
    def get_all_data_sync(self) -> Dict[str, Any]:
        """Sync wrapper for get_all_data"""
        return asyncio.run(self.get_all_data())


# ============================================================================
# Convenience Functions (for quick usage)
# ============================================================================

def get_nepse_index() -> Dict[str, Any]:
    """
    Quick function to get NEPSE index
    
    Example:
        idx = get_nepse_index()
        print(f"NEPSE: {idx['value']} ({idx['change_pct']:+.2f}%)")
    
    Returns:
        Dictionary with value, change, change_pct, high, low, previous_close
    """
    api = NepseIndexAPI()
    idx = api.get_nepse_index_sync()
    return idx.to_dict() if idx else {}


def get_all_indices() -> Dict[str, Any]:
    """
    Get all indices and market status in one call
    
    Example:
        data = get_all_indices()
        print(f"NEPSE: {data['nepse_index']['value']}")
        print(f"Market Open: {data['market_status']['is_open']}")
    """
    api = NepseIndexAPI()
    return api.get_all_data_sync()


def get_market_status() -> str:
    """
    Quick function to check if market is open
    
    Returns:
        'OPEN' or 'CLOSE'
    """
    api = NepseIndexAPI()
    status = asyncio.run(api.get_market_status())
    return status['status']


def is_market_open() -> bool:
    """Returns True if market is open, False otherwise"""
    api = NepseIndexAPI()
    return api.is_market_open_sync()


def get_sub_indices() -> List[Dict[str, Any]]:
    """Get all sector sub-indices as list of dictionaries"""
    api = NepseIndexAPI()
    indices = api.get_sub_indices_sync()
    return [i.to_dict() for i in indices]


# ============================================================================
# Demo / Test
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("NEPSE Live Index - Demo")
    print("=" * 70)
    
    # Demo 1: Quick functions
    print("\n📈 Demo 1: Quick Functions")
    print("-" * 50)
    
    idx = get_nepse_index()
    print(f"NEPSE Index: {idx['value']:,.2f}")
    print(f"Change: {idx['change']:+.2f} ({idx['change_pct']:+.2f}%)")
    print(f"Range: {idx['low']:,.2f} - {idx['high']:,.2f}")
    print(f"Market Status: {get_market_status()}")
    
    # Demo 2: Using the class
    print("\n📊 Demo 2: Using NepseIndexAPI class")
    print("-" * 50)
    
    async def demo():
        api = NepseIndexAPI()
        
        # Get all main indices
        main = await api.get_main_indices()
        for idx in main:
            indicator = "🟢" if idx.change_pct >= 0 else "🔴"
            print(f"{indicator} {idx.name}: {idx.current_value:,.2f} ({idx.change_pct:+.2f}%)")
        
        # Get top sub-indices
        print("\nSector Sub-Indices:")
        sub = await api.get_sub_indices()
        for idx in sub[:5]:  # Top 5
            indicator = "🟢" if idx.change_pct >= 0 else "🔴"
            print(f"  {indicator} {idx.name}: {idx.current_value:,.2f} ({idx.change_pct:+.2f}%)")
    
    asyncio.run(demo())
    
    # Demo 3: Get everything at once
    print("\n📋 Demo 3: Get All Data")
    print("-" * 50)
    
    all_data = get_all_indices()
    print(f"NEPSE: {all_data['nepse_index']['value']:,.2f}")
    print(f"Main Indices: {len(all_data['main_indices'])}")
    print(f"Sub Indices: {len(all_data['sub_indices'])}")
    print(f"Market Open: {all_data['market_status']['is_open']}")
    
    print("\n" + "=" * 70)
    print("✅ Demo complete!")
    print("=" * 70)
