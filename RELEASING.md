# Releasing

Pushing a `v*` tag runs [`.github/workflows/release.yml`](.github/workflows/release.yml). It checks the tag, packages the VSIX, and creates the GitHub release with the VSIX attached and the changelog section as notes. The [VS Code Marketplace](https://marketplace.visualstudio.com) gets that VSIX by hand for now (step 4). The workflow can also publish to the Marketplace once an Azure identity is set up, and to [Open VSX](https://open-vsx.org) (where Cursor, VSCodium, Windsurf and other VS Code forks install from) once that's set up and switched on; see the end.

## Cutting a release

1. In the release PR, set the version in `package.json` (and `package-lock.json`: `npm version 0.2.0 --no-git-tag-version`), and add a `## 0.2.0` section to `CHANGELOG.md`. Its body becomes the release notes; the Marketplace shows the whole file on its Changelog tab. Bumping the pinned `tsquare` goes in the same PR or an earlier one.
2. Merge the PR.
3. Tag `main` and push the tag:

   ```bash
   git fetch origin
   git tag v0.2.0 origin/main
   git push origin v0.2.0
   ```

4. When the run has finished, upload the VSIX to the VS Code Marketplace: download `tsquare-vscode-0.2.0.vsix` from the GitHub release, then on [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage), under the `tsquare-js` publisher, open the extension's **⋯ → Update** and choose the file. (The very first time: **New extension → Visual Studio Code**.) The run's summary has a notice reminding you.

Before publishing, the workflow stops if the tag doesn't match the version in `package.json`, if the tagged commit isn't on `main`, if `CHANGELOG.md` has no section for the version, or if the typecheck or grammar test fails. Run `npm run test:vsix` locally before tagging: CI can't run the integration tests (they need VS Code).

## When a run fails

- **Before publishing:** fix it on `main` and release the next patch version (a store never takes the same version twice).
- **Open VSX fails** (once it's switched on): check its setup (below), then **Re-run failed jobs**. Publishing skips a version that's already there, so **Re-run all jobs** works too. The GitHub release waits for it.

## How publishing is set up

- **GitHub:** the release jobs that publish run in environments limited to `v*` tags: `marketplace-publish`, and `openvsx-publish` for Open VSX.
- **VS Code Marketplace:** publisher `tsquare-js` (the `publisher` in `package.json`). Uploaded by hand: the Marketplace job only publishes when the `marketplace-publish` environment has an `AZURE_CLIENT_ID` secret, and otherwise leaves a notice.
- **Open VSX:** not set up yet. The Open VSX job runs only when the repository variable `OPENVSX_PUBLISH` is `true` (**Settings → Secrets and variables → Actions → Variables**).

### Automating the Marketplace later

The Marketplace takes automated publishes only from a personal access token (global Azure DevOps tokens stopped working on December 1, 2026) or a Microsoft Entra ID identity. The workflow is ready for the second:

- An Azure **user-assigned managed identity** (an Azure resource, so it needs an Azure subscription; the identity itself costs nothing), with a federated credential: scenario GitHub Actions deploying Azure resources, organization `tsquare-js`, repository `tsquare-vscode`, entity **Environment** `marketplace-publish`. Not an app registration: one is reported to sign in and then fail at publishing with `InvalidAccessException` (unconfirmed either way as of October 2026).
- Its **Client ID** and **Tenant ID** as the `marketplace-publish` environment's `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` secrets.
- The identity as a **Contributor** member of the publisher, by the ID the Marketplace knows it by: not its client, tenant or resource ID, but its Azure DevOps profile ID, which the **Marketplace identity** workflow prints (run it while the environment is open to `main`).

### Setting up Open VSX later

- An open-vsx.org account (sign in with GitHub) linked to an Eclipse account, with the Publisher Agreement signed, and the namespace `tsquare-js` (`npx ovsx create-namespace tsquare-js -p <token>`).
- Open VSX takes an extension's first version only with an access token: for that release, put one in the `openvsx-publish` environment's `OVSX_PAT` secret and set `OPENVSX_PUBLISH` to `true`.
- Then switch to trusted publishing (no stored secret): open-vsx.org **Settings → Trusted Publishers**, owner `tsquare-js`, repository `tsquare-vscode`, workflow `release.yml`, environment `openvsx-publish`; delete the `OVSX_PAT` secret (a token, when set, takes precedence over trusted publishing) and revoke the token.
