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
- **One store fails:** fix the setup below, then **Re-run failed jobs**. Both publish steps skip a version that's already there, so **Re-run all jobs** works too. The GitHub release waits for both stores.

## One-time setup

### GitHub

In the repo's **Settings → Environments**, create two environments: `marketplace-publish` and `openvsx-publish`. Leave them open to every branch for now: the Marketplace identity workflow (step 5 below) runs from `main`. Once both stores are set up, restrict them (**Deployment branches and tags → Selected branches and tags**, tag rule `v*`) so only release tags can use their credentials.

### VS Code Marketplace

Global Azure DevOps personal access tokens, the old way to publish, stop working on December 1, 2026. The workflow uses Microsoft Entra ID instead.

1. **Publisher.** Create one at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) with the ID `tsquare-js` (the `publisher` in `package.json`; if you pick another ID, change it there too). Display name: tsquare.
2. **Managed identity.** In the [Azure portal](https://portal.azure.com) (any subscription; the free tier works), search for **Managed Identities** and create a user-assigned one, in any resource group and region. An app registration looks simpler and needs no subscription, but it's reported to sign in fine and then fail at publishing with `InvalidAccessException`.
3. **Federated credential.** In the identity, **Settings → Federated credentials → Add credential**: scenario **GitHub Actions deploying Azure resources**, organization `tsquare-js`, repository `tsquare-vscode`, entity **Environment**, environment `marketplace-publish`. (Not Tag: that trusts one exact tag name.)
4. **Secrets.** From the identity's **Settings → Properties**, copy the **Client ID** and **Tenant ID** into the `marketplace-publish` environment's secrets as `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`.
5. **The identity's Marketplace ID.** Run the **Marketplace identity** workflow (Actions tab → Marketplace identity → Run workflow; it's listed once this file's PR is on `main`, and needs `marketplace-publish` still open to `main`). Its last step prints an ID: that's the one the Marketplace knows the identity by, not the client, tenant or resource ID.
6. **Membership.** In the publisher's **Members**, add that ID with the **Contributor** role.

### Open VSX

Open VSX takes the first version of an extension only with an access token; trusted publishing works from the second.

1. **Account.** Sign in to [open-vsx.org](https://open-vsx.org) with GitHub, create an [Eclipse account](https://accounts.eclipse.org) with the same GitHub username, link it under **Settings**, and sign the **Publisher Agreement** there.
2. **Token and namespace.** Under **Settings → Access Tokens**, create a token, then create the namespace with it: `npx ovsx create-namespace tsquare-js -p <token>`.
3. **First release.** Add the token to the `openvsx-publish` environment's secrets as `OVSX_PAT`. Then restrict both environments to `v*` tags (see GitHub above) and release 0.1.0.
4. **Trusted publishing.** After 0.1.0 is on Open VSX: **Settings → Trusted Publishers**, namespace `tsquare-js`, GitHub, owner `tsquare-js`, repository `tsquare-vscode`, workflow `release.yml`, environment `openvsx-publish`.
5. **Remove the token.** Delete the `OVSX_PAT` secret (a token, when set, takes precedence over trusted publishing) and revoke the token on open-vsx.org.
