declare const PLUGIN_FILE_PATH: unique symbol

/**
 * The path of a file inside the plugin folder, relative to that folder, such as
 * `skills/writing-code/languages/kotlin.md`. Built by pluginFilePath alone.
 */
export type PluginFilePath = string & { readonly [PLUGIN_FILE_PATH]: true }

/** `path` as a path inside the plugin folder. Fails for an absolute path or one that leaves it. */
export function pluginFilePath(path: string): PluginFilePath {
  if (!isPluginFilePath(path)) {
    throw new Error(`${path} is not a path inside the plugin folder`)
  }

  return path
}

function isPluginFilePath(path: string): path is PluginFilePath {
  return !path.startsWith('/') && !path.split('/').includes('..')
}
