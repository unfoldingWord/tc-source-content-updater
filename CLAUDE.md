# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`tc-source-content-updater` is an npm library used by the translationCore desktop app. It queries the Door43 (DCS) catalog for source resources (Bibles, translationNotes, translationWords, translationWords Links, translationAcademy), works out which ones are newer than what the user has locally, then downloads, unzips and converts them into the folder layout translationCore expects.

Node 16 is required (`engines: >=16.14 <18.21`; CI uses 16.20.2). The code is Babel 6 ES modules, built from `src/` into `lib/`, and `lib/` is what gets published (`main: lib/index.js`).

## Commands

- `npm test`: runs eslint on `src/`, then all Jest tests. Results go to `jest-results.json`, not the console.
- `npm run test:showFails`: lint, then Jest with a silent reporter, so only failures are printed.
- `npx jest __tests__/parseHelpers.test.js`: run a single test file.
- `npx jest -t "test name"`: run tests whose name matches.
- `npm run fix`: eslint autofix.
- `npm run build`: deletes `lib/` and transpiles `src/` into it.

Jest is v23 and tests live in both `src/` and `__tests__/` (`*.test.js`).

Use Node 16 for every npm/npx command, including `npm ci`. If the default `node` is newer, put Node 16 first on the PATH, e.g. `export PATH=~/.nvm/versions/node/v16.20.2/bin:$PATH`. If `node_modules` isn't installed, `npx jest` downloads a modern Jest, which fails with `.plugins[0] may only be a two-tuple or three-tuple` because it can't read the Babel 6 `.babelrc`.

To try changes in translationCore without publishing, install the branch there: `npm i translationCoreApps/tc-source-content-updater#<branch>`.

## Architecture

### Public API (`src/index.js`)
`Updater` is a constructor with prototype methods, and it is the default export. An instance caches the remote catalog (`remoteCatalog`) for its whole lifetime to cut down on API calls. Parsers can assume `updateCatalog()` has already run. The main flow is:

1. `updateCatalog(config)` → `apiHelpers.getCatalog`, which merges releases from the legacy `Door43-Catalog` owner with Catalog Next (`/api/v1/catalog/search`) results for the configured `stage`/`topic`/owner.
2. `getLatestResources(localResourceList, config)` → `parseHelpers.getLatestResources`, which compares the remote catalog against local manifests and returns only the resources that need updating.
3. `downloadResources(languageList, resourcesPath)`, `downloadAllResources(...)` or `downloadAndProcessResource(resourceDetails, ...)` → `resourcesDownloadHelpers`.

`STAGE`, `SUBJECT` and `SORT` constants, plus some helper re-exports, are also exported from `index.js`. The `src/index.js` methods are thin wrappers. The README asks that logic go into the helper files rather than the main index.

### Catalog search and stages
`apiHelpers.searchCatalogNext` builds a query to `<DCS_BASE_URL>/api/v1/catalog/search` and pages through the results with `doMultipartQuery`, using the `X-Total-Count` header to know when it has everything. It then normalises each item with `getCompatibleResourceList`, which adds `languageId`, `resourceId` and `version` and turns spaces in the subject into `_`.

- **Stages:** `STAGE` (documented in `src/index.js`) is a fallback hierarchy that returns one entry per repo: `prod` ⊂ `preprod` ⊂ `latest`. Each item's own `stage` field says which version was actually returned.
  - `latest` returns default branches, including repos that were never released, and is the only way to get *all* repos.
  - `draft` is currently rejected by DCS with HTTP 422.
  - `searchCatalogNext` defaults to `latest`. `getCatalog` defaults to `prod`, but always queries the legacy `Door43-Catalog` owner with `latest`.
  - Only `preprod` turns on pre-release mode, in which old versions are not deleted after a download.
- **Fields on each catalog item:**
  - `ref_type` (`branch`/`tag`) and `branch_or_tag_name` give the raw file URL: `https://git.door43.org/<owner>/<repo>/raw/<branch|tag>/<ref>/<path>`.
  - `ingredients[]` lists the books, each with its `path`.
- **Alignment data:**
  - For "Aligned Bible" entries, each book also has an `alignment_count`. A total of 0 reliably means the Bible has no `\zaln` alignment, and many repos with that subject contain only plain text.
  - "Bible" entries don't have `alignment_count` at all, yet a few of them are aligned (e.g. `Door43-Catalog/nag_irv`, `or_irv`). For those, the only way to tell is to check the USFM itself.

### Download/process pipeline
`resourcesDownloadHelpers.downloadAndProcessResource` handles one resource:
- If the version is missing or `master`, it resolves the real release tag from DCS.
- It downloads the zip to `<resourcesPath>/imports/`, unzips it, and calls `resourcesHelpers.processResource`.
- It moves the processed output into its final location and prunes older versions (skipped in pre-release mode). Temp zip and import files are always deleted.
- `config.getCancelState` is checked between stages so the user can cancel.

`resourcesHelpers.processResource` picks a processor based on the catalog **subject** (spaces are replaced with `_`):
- `Translation_Words` / `TSV_Translation_Words_Links` → `translationHelps/twArticleHelpers`
- `TSV_Translation_Notes` → `translationHelps/tnArticleHelpers`
- `Translation_Academy` → `translationHelps/taArticleHelpers`
- `Bible`, `Aligned_Bible`, `Greek_New_Testament`, `Hebrew_Old_Testament` → `packageParseHelpers.parseBiblePackage` (USFM → per-chapter JSON)
- anything else is copied as-is

It then writes `manifest.json` with `version`, `modifiedTime` and `stage`.

Only subjects listed in `parseHelpers.TC_RESOURCES` are recognised. Others in the catalog are ignored.

**Dependency downloads:** processing tN or TWL needs the original-language Bible (UGNT/UHB) and other helps (e.g. tA, tW), so their processors may call back into `downloadAndProcessResource` to fetch missing dependencies (`tnArticleHelpers.getMissingResources`, `getMissingOriginalResource`, `getMissingHelpsResource`). Group data for tN and TWL is produced with `tsv-groupdata-parser`.

### On-disk layout and owners
Resources end up at `<resourcesPath>/<languageId>/<bibles|translationHelps>/<resourceName>/v<version>_<owner>` (see `resourcesHelpers.getActualResourcePath`). Owner is part of the version folder name (`addOwnerToKey`, `OWNER_SEPARATOR = '_'`, `encodeOwnerStr`). Versions are sorted and selected by owner, with `DEFAULT_OWNER = 'Door43-Catalog'` as the fallback. Pre-release state (non-`prod` stage) is tracked in the main resources manifest by `resourcesDownloadHelpers` (`doingPreRelease`, `setResourcesPreReleaseStateFromStage`).

Error message strings are in `src/resources/errors.js`. Bible book and original-language constants are in `src/resources/bible.js`.

## Testing conventions

- `testSetup/global.js` runs before every test. It **auto-mocks** `src/helpers/downloadHelpers` and `src/helpers/zipFileHelpers`, and uses `nock` to persistently stub the Door43 pivoted catalog.
- The mock `download()` (`src/helpers/__mocks__/downloadHelpers.js`) serves files from `__tests__/fixtures/<host>/<path>` based on the URL, so new download tests need matching fixture files there.
- `fs-extra` is mocked with an in-memory file system (`__tests__/__mocks__/fs-extra.js`). Fixtures are loaded into it with helpers such as `fs.__loadFilesIntoMockFs` / `__setMockDirectories`, and real fs is reached via `fs.__actual`. Tests that need the real filesystem call `jest.unmock('fs-extra')`.
- HTTP calls are stubbed with `nock` (`__tests__/__nocks__`). `__tests__/fixtures/catalog.json` is example DCS catalog metadata.
- `__tests__/_apiIntegration.test.js` holds live-network integration tests used during development. They are `describe.skip` by default and write to `./temp`.
- To mock the search API for a test, stub `DCS_BASE_URL` + `/api/v1/catalog/search` with nock and include an `X-Total-Count` reply header. `__tests__/searchAlignedBibles.test.js` is an example that covers paging.
- `temp/` is gitignored. Use it for scratch output and downloaded catalog data.
- `searching/` holds committed one-off catalog analysis.
  - `searching/verifyAligned.mjs <catalog.json> <out.json> [--all-books]` (Node 18+) streams each entry's USFM books, trying `tit` first, and records the first book that contains `\zaln`. With `--all-books` it checks every book and lists all aligned ones in `alignedBooks`.
  - `searching/toTsv.mjs <catalog.json> <results.json> <out.tsv>` turns `--all-books` results into a TSV whose `checked_books` column lists the aligned books in canonical order.
  - The verified results are saved as TSV reports alongside it.

## Lint style

ESLint uses `eslint:recommended` + `google`, with semicolons required (an error). Most other style rules are warnings, and `max-len` and `indent` are off. Lint only covers `src/`.

## Release

`npm publish` runs tests and the build first (`prepublishOnly`). After publishing it tags `v<version>` and pushes the tag (`postpublish`). PRs target `develop`.
