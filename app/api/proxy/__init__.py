"""Proxy blueprint exports for API proxy routes."""

from .azure import ROOT_PATH_PROXY_AZURE, proxy_azure

__all__ = [
	"ROOT_PATH_PROXY_AZURE",
	"proxy_azure",
]
