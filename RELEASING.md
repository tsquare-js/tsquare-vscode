# Releasing

Pushing a `v*` tag runs [`.github/workflows/release.yml`](.github/workflows/release.yml). It checks the tag, packages the VSIX, publishes it to the [VS Code Marketplace](https://marketplace.visualstudio.com) and [Open VSX](https://open-vsx.org) (Cursor, VSCodium, Windsurf and other VS Code forks install from there), then creates the GitHub release with the VSIX attached and the changelog section as notes. Neither store needs a stored secret once set up: the Marketplace trusts an Azure managed identity and Open VSX a trusted publisher, both through GitHub's OIDC token.

## Cutting a release

1. In the release PR, set the version in `package.json` (and `package-lock.json`: `npm version 0.2.0 --no-git-tag-version`), and add a `## 0.2.0` section to `CHANGELOG.md`. Its body becomes the release notes; the Marketplace shows the whole file on its Changelog tab. Bumping the pinned `tsquare` goes in the same PR or an earlier one.
2. Merge the PR.
3. Tag `main` and push the tag:

   ```bash
   git fetch origin
   git tag v0.2.0 origin/main
   git push origin v0.2.0
   ```

Before publishing, the workflow stops if the tag doesn't match the version in `package.json`, if the tagged commit isn't on `main`, if `CHANGELOG.md` has no section for the version, or if the typecheck or grammar test fails. Run `npm run test:vsix` locally before tagging: CI can't run the integration tests (they need VS Code).

## When a run fails

- **Before publishing:** fix it on `main` and release the next patch version (a store never takes the same version twice).
- **One store fails:** check that store's setup (below), then **Re-run failed jobs**. Both publish steps skip a version that's already there, so **Re-run all jobs** works too. The GitHub release waits for both stores.

## How publishing is set up

Neither store holds a stored secret: both trust GitHub's OIDC token from this workflow.

- **GitHub:** two environments, `marketplace-publish` and `openvsx-publish`, each limited to `v*` tags. The publish jobs run in them.
- **VS Code Marketplace:** publisher `tsquare-js` (the `publisher` in `package.json`). An Azure user-assigned managed identity has a federated credential for this repo's `marketplace-publish` environment, and is a Contributor member of the publisher. Its client and tenant IDs are that environment's `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` secrets; `vsce publish --azure-credential` signs in with it. Things that aren't obvious:
  - The Marketplace knows the identity by its Azure DevOps profile ID, not its client, tenant or resource ID. The **Marketplace identity** workflow prints it (it needs the environment open to the branch it runs from).
  - A managed identity, not an app registration: an app registration is reported to sign in and then fail at publishing with `InvalidAccessException`.
  - Not a personal access token: global Azure DevOps tokens stopped working on December 1, 2026.
- **Open VSX:** namespace `tsquare-js`, with a trusted publisher registered for owner `tsquare-js`, repository `tsquare-vscode`, workflow `release.yml`, environment `openvsx-publish` (open-vsx.org **Settings → Trusted Publishers**). Open VSX took the first version (0.1.0) only with an access token; the workflow still uses an `OVSX_PAT` secret if one is set, and a token, when set, takes precedence over trusted publishing, so there shouldn't be one.
