const HOOKS = [
  {
    id: "artifact-version-camelcase-to-snakecase-v1",
    applies: (artifact) =>
      !artifact.template_version &&
      !artifact.renderer_version &&
      !artifact.theme_version &&
      (artifact.templateVersion ||
        artifact.rendererVersion ||
        artifact.themeVersion),
    run: async (artifact) => ({
      template_version: String(artifact.templateVersion || ""),
      renderer_version: String(artifact.rendererVersion || ""),
      theme_version: String(artifact.themeVersion || ""),
    }),
  },
  {
    id: "artifact-version-defaults-v1",
    applies: (artifact) =>
      !artifact.template_version ||
      !artifact.renderer_version ||
      !artifact.theme_version,
    run: async (artifact) => ({
      template_version: String(artifact.template_version || "template-v1"),
      renderer_version: String(artifact.renderer_version || "renderer-v1"),
      theme_version: String(artifact.theme_version || "theme-v1"),
    }),
  },
];

function snapshotVersions(artifact) {
  return {
    template_version: String(artifact.template_version || ""),
    renderer_version: String(artifact.renderer_version || ""),
    theme_version: String(artifact.theme_version || ""),
  };
}

export async function applyArtifactMigrations(inputArtifact) {
  const artifact = { ...inputArtifact };
  const from = snapshotVersions(artifact);
  const appliedHooks = [];

  for (const hook of HOOKS) {
    if (!hook?.applies || !hook?.run || !hook?.id) continue;
    if (!hook.applies(artifact)) continue;
    const next = await hook.run(artifact);
    if (!next || typeof next !== "object") {
      throw new Error(`Migration hook '${hook.id}' returned invalid artifact.`);
    }
    Object.assign(artifact, next);
    appliedHooks.push(String(hook.id));
  }

  const to = snapshotVersions(artifact);
  return {
    artifact,
    migration: {
      from,
      to,
      applied_hooks: appliedHooks,
    },
  };
}
