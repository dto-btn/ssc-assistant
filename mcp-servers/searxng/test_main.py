import pytest
import requests
from unittest.mock import patch, MagicMock
from main import search

def test_search_success():
    """Test successful search with results."""
    mock_results = {
        "results": [
            {
                "title": "Test Title 1",
                "url": "https://example.com/1",
                "content": "Test Content 1"
            },
            {
                "title": "Test Title 2",
                "url": "https://example.com/2",
                "content": "Test Content 2"
            }
        ]
    }
    
    with patch("requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_results
        mock_get.return_value = mock_response
        
        result = search("test query")
        
        assert "Test Title 1" in result
        assert "https://example.com/1" in result
        assert "Test Content 1" in result
        assert "Test Title 2" in result
        assert "---" in result
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert kwargs["params"]["q"] == "test query"

def test_search_no_results():
    """Test search with no results found."""
    mock_results = {"results": []}
    
    with patch("requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_results
        mock_get.return_value = mock_response
        
        result = search("empty query")
        
        assert result == "No results found."

def test_search_error():
    """Test search when requests fails."""
    with patch("requests.get") as mock_get:
        mock_get.side_effect = requests.exceptions.RequestException("Connection error")
        
        result = search("error query")
        
        assert "Error during search: Connection error" in result
