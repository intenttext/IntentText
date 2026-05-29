export type MigrationVersions = {
  template_version: string;
  renderer_version: string;
  theme_version: string;
};

export type ArtifactMigrationResult = {
  artifact: Record<string, unknown>;
  migration: {
    from: MigrationVersions;
    to: MigrationVersions;
    applied_hooks: string[];
  };
};

export function applyArtifactMigrations(
  inputArtifact: Record<string, unknown>,
): Promise<ArtifactMigrationResult>;
