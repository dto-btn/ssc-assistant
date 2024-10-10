def tool_metadata(metadata):
    def decorator(func):
        func._tool_metadata = metadata
        return func
    return decorator