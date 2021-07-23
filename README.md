<h1 align="center" style="border-bottom: none;">Fork of GitHub CSV Tools</h1>
<h4 align="center">Added ability to import comments and transfer a copy of all issues and their comments from one repo to another</h4>
<h3 align="center">Import and export GitHub issues via CSV</h3>
<p align="center">
  
  <a href="https://github.com/gavinr/github-csv-tools/actions?query=workflow%3ATest+branch%3Amaster">
    <img alt="Build" src="https://github.com/gavinr/github-csv-tools/workflows/Test/badge.svg">
  </a> 
  <a href="https://github.com/gavinr/github-csv-tools/actions?query=workflow%3ARelease+branch%3Amaster">
    <img alt="Release" src="https://github.com/gavinr/github-csv-tools/workflows/Release/badge.svg">
  </a> 
  <a href="https://www.npmjs.com/package/github-csv-tools">
    <img alt="npm latest version" src="https://img.shields.io/npm/v/github-csv-tools/latest.svg">
  </a>
</p>

## Usage


Prerequisite: [Install Node.js](https://nodejs.org/en/), then run this to install:

```
npm install -g github-csv-tools
```

After install, `githubCsvTools --help` for info on how to use, or see below.

Instructions for exporting, importing or transfering a copy:

### To Import Issues

Currently imports title, body, labels, status (closed or open) and milestones.

```
githubCsvTools myFile.csv
```

### To Export Issues

```
githubCsvTools
```

| Option                 | Default                                                                                               | Notes                                                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| -f, --exportFileName   | YYYY-MM-DD-hh-mm-ss-issues.csv                                                                        | The name of the CSV you'd like to export to.                                                                                                                                                                  |
| -a, --exportAttributes | number, title, labels, state, assignees, milestone, comments, created_at, updated_at, closed_at, body | Comma-separated list of attributes (columns) in the export**.                                                                                                                                                 |
| -c, --exportComments   | n/a                                                                                                   | Include comments in the export. If using in combination with `--exportAttributes`, `id` must be included.                                                                                                     |
| -e, --exportAll        | n/a                                                                                                   | Export all possible values from the GitHub API. If not included, a subset of attributes (see `--exportAttributes` above) that are known to be compatible with GitHub *import* will be included in the export. |

** List of all possible options for `exportAttributes` includes every option in the [GitHub API Export](https://developer.github.com/v3/issues/#response-4). Values in child objects can be referenced using a "dot" - for example, a user's `avatar_url` can be accessed via `user.avatar_url`.


### To Transfer a copy of Issues


Currently imports or updates issues and issue comments (if using -c flag) from one repo to another. Transfer can happen across accounts as long as the repo is public or the users have contributor permissions. Needs more testing.

```
githubCsvTools transfer
```
                                                                                               
### Tokens

For all actions, the tool will ask you to input a GitHub token. To obtain this token:

1. Go to https://github.com/settings/tokens
2. Click "Generate New Token"
3. Check on `repo`
4. Copy/paste the token provided when the tool asks for it.

## Other Options

| Option                         | Notes                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------- |
| -V, --version                  | Output the version number.                                                    |
| -g, --github_enterprise        | GitHub Enterprise URL of the source issues. https://your-internal-githubenterprise.com/api/v3 |
| -t, --token                    | GitHub token of the source issues. https://github.com/settings/tokens         |
| -o, --organization             | The User or Organization slug that the repo lives under.                      |
| -r, --repository               | The repository name (slug).                                                   |
| -to_g, --to_github_enterprise  | The transfer copy to (destination) GitHub Enterprise URL.                     |
| -to_t, --toToken               | The transfer copy to (destination) GitHub token. https://github.com/settings/tokens |
| -to_o, --toOrganization        | The transfer copy to (destination) User or Organization slug that the repo lives under.|
| -to_r, --toRepository          | The transfer copy to (destination) repository name. (slug)                             |
| -v, --verbose                  | Include additional logging information.                                       |
| -h, --help                     | See all the options and help.                                                 |


## Development

1. Clone the repo.
2. Browse to repo, then run `npm install -g`

## Changelog

See [CHANGELOG.md](https://github.com/gavinr/github-csv-tools/blob/master/CHANGELOG.md)

## Thanks

- [octokit/rest.js](https://octokit.github.io/rest.js/)
- [nodeCSV](https://www.npmjs.com/package/csv)
- [commander](https://www.npmjs.com/package/commander)
- [co](https://www.npmjs.com/package/co)
- [Tim Patterson's Post on Atlassian.com](https://developer.atlassian.com/blog/2015/11/scripting-with-node/)
