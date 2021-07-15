#!/usr/bin/env node
/* jshint esversion: 6 */

const program = require("commander");
const co = require("co");
const prompt = require("co-prompt");
const { Octokit } = require("@octokit/rest");
const { throttling } = require("@octokit/plugin-throttling");

const { importFile } = require("./import.js");
const { exportIssues } = require("./export.js");
const { transferCopy } = require("./transfer-copy.js");


program
  .version("2.0.0")
  .arguments("[importFileOrTransfer]")
  .option(
    "-g, --github_enterprise [https://api.github.my-company.com]",
    "Your GitHub Enterprise URL."
  )
  .option(
    "-t, --token [token]",
    "The GitHub token. https://github.com/settings/tokens"
  )
  .option(
    "-o, --organization [organization]",
    "The User or Organization slug that the repo lives under."
  )
  .option("-r, --repository [repository]", "The repository name (slug).")
  .option(
    "-to_g, --to_github_enterprise [https://api.github.my-company.com]",
    "The transfer copy to GitHub Enterprise URL."
  )
  .option(
    "-to_t, --toToken [token]",
    "The transfer copy to GitHub token. https://github.com/settings/tokens"
  )
  .option(
    "-to_o, --toOrganization [organization]",
    "The transfer copy to User or Organization slug that the repo lives under."
  )
  .option("-to_r, --toRepository [repository]", "The transfer copy to repository name (slug).")
  .option(
    "-f, --exportFileName [export.csv]",
    "The name of the CSV you'd like to export to."
  )
  .option(
    "-a, --exportAttributes [attributes]",
    "Comma-separated list of attributes (columns) in the export."
  )
  .option("-c, --exportComments", "Include comments in the export.")
  .option("-e, --exportAll", "Include all data in the export.")
  .option("-v, --verbose", "Include additional logging information.")
  .action(function (importFileOrTransfer, options) {
    co(function* () {
      var retObject = {};
      retObject.githubUrl = 
        options.github_enterprise || "https://api.github.com";
      retObject.token = options.token || "";
      // from
      if (retObject.token === "") {
        retObject.token = yield prompt(
          "token (get from https://github.com/settings/tokens): "
        );
      }
      retObject.exportFileName = options.exportFileName || false;
      retObject.exportAttributes = options.exportAttributes || false;
      if (retObject.exportAttributes) {
        retObject.exportAttributes = retObject.exportAttributes
          .split(",")
          .map((i) => i.trim());
      }
      retObject.exportComments = options.exportComments || false;
      retObject.exportAll = options.exportAll || false;
      retObject.verbose = options.verbose || false;

      // get issues data from
      retObject.userOrOrganization = options.organization || "";
      if (retObject.userOrOrganization === "") {
        retObject.userOrOrganization = yield prompt("user or organization: ");
      }
      // get issues data from
      retObject.repo = options.repository || "";
      if (retObject.repo === "") {
        retObject.repo = yield prompt("repository: ");
      }

      if (importFileOrTransfer === "transfer") {
        // transfer to data
        retObject.toGithubUrl = options.to_github_enterprise || "https://api.github.com";
        retObject.toToken = options.toToken || "";
        if (retObject.toToken === "") {
          retObject.toToken = yield prompt(
            "Transfer to token (get from https://github.com/settings/tokens): "
          );
        }

        retObject.toUserOrOrganization = options.toOrganization || "";
        if (retObject.toUserOrOrganization === "") {
          retObject.toUserOrOrganization = yield prompt("transfer copy to user or organization: ");
        }
        
        retObject.toRepo = options.toRepository || "";
        if (retObject.toRepo === "") {
          retObject.toRepo = yield prompt("transfer copy to repository: ");
        }
      }

      return retObject;
    }).then(
      function (values) {
        const ThrottledOctokit = Octokit.plugin(throttling);
        const octokit = new ThrottledOctokit({
          auth: values.token,
          userAgent: "github-csv-tools",
          baseUrl: values.githubUrl,
          throttle: {
            onRateLimit: (retryAfter, options) => {
              console.warn(
                `Request quota exhausted for request ${options.method} ${options.url}`
              );

              if (options.request.retryCount === 0) {
                // only retries once
                console.log(`Retrying after ${retryAfter} seconds!`);
                return true;
              }
            },
            onAbuseLimit: (retryAfter, options) => {
              // does not retry, only logs a warning
              console.warn(
                `Abuse detected for request ${options.method} ${options.url}`
              );
            },
          },
        });

        if (importFileOrTransfer) {
          // This is a transfer copy!
          if (importFileOrTransfer === "transfer") {
            transferCopy(octokit, values);
          } else {
            // This is an import!
            importFile(octokit, importFileOrTransfer, values);
          }
        } else {
          // this is an export!
          exportIssues(octokit, values);
        }
      },
      function (err) {
        console.error("ERROR", err);
      }
    );
  })
  .parse(process.argv);