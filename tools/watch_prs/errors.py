class WatchError(Exception):
    """A failure that ends the watcher before it watches. Its message ends with the next step."""
