import importlib.util
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def tool_metadata(metadata):
    """decorated used to add json configuration that is used within OpenAI tools call"""
    def decorator(func):
        func.tool_metadata = metadata
        return func
    return decorator

def discover_functions_with_metadata(dir_name: str) -> dict:
    """
    Reads the tools folder for functions decorated with the tool_metadata annotation and loads the json config of each
    of these functions to be used by the OpenAI calls later.
    """
    local_functions_with_metadata = {}
    for root, _, files in os.walk(dir_name):
        #logger.debug(root)
        for file in files:
            if file.endswith("_functions.py"):
                module_path = Path(root) / file
                module_name = f"{root.replace(os.sep, '.')}.{file[:-3]}"

                # Extract tool_type from the file name
                tool_type = file[:-3].split('_functions')[0]
                print(module_name, str(module_path), tool_type)
                discovered_functions = discover_subfolder_functions_with_metadata(module_name,
                                                                                  str(module_path),
                                                                                  tool_type)
                local_functions_with_metadata.update(discovered_functions)
    return local_functions_with_metadata

def discover_subfolder_functions_with_metadata(module_name: str, module_path: str, tool_type: str) -> dict:
    """ extract the functions for each subfolder when a module contains _functions.py files"""
    local_functions_with_metadata = {}
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is not None and spec.loader is not None:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if callable(attr) and hasattr(attr, "tool_metadata"):
                metadata = attr.tool_metadata
                metadata['tool_type'] = tool_type # also add tool type on top of the rest of things
                local_functions_with_metadata[metadata["function"]["name"]] = {
                    'metadata': metadata,
                    'module': module,
                    'tool_type': tool_type
                }
    return local_functions_with_metadata