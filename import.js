const csv = require("csv");
const fs = require("fs");

const { createIssue } = require("./helpers.js");

const importFile = (octokit, file, values) => {
  fs.readFile(file, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file.");
      process.exit(1);
    }
    csv.parse(
      data,
      {
        trim: true,
      },
      (err, csvRows) => {
        if (err) throw err;
        var cols = csvRows[0].map(col => col.toLowerCase());
        csvRows.shift();

        // get indexes of the fields we need
        var indexes = {
          title: cols.indexOf("title"),
          body: cols.indexOf("body"),
          labels: cols.indexOf("labels"),
          milestone: cols.indexOf("milestone"),
          assignee: cols.indexOf("assignee"),
          state: cols.indexOf("state"),
        }
        // for every comment on an issue, a seperate issue was created with only the comment data different
        const commentUserIndex = cols.indexOf("comment.user")
        const commentBodyIndex = cols.indexOf("comment.body")

        if (indexes.title === -1) {
          var newTitleIndex = cols.indexOf("issue.title")
          // get the value in case the nested properties formatted as item.item eg: "issue.title", 
          if (newTitleIndex) {
            // change all indexes to find with prefix of "issue."
            for (key in indexes) {
              indexes[key] = cols.indexOf(`issue.${key}`)
            }
          } else {
            // if still cant find title
            console.error("Title required by GitHub, but not found in CSV.");
            process.exit(1);
          }
        }

        const createPromises = csvRows.map((row) => {
          var sendObj = {
            owner: values.userOrOrganization,
            repo: values.repo,
            title: row[indexes.title],
          };

          if (commentUserIndex > -1 && commentBodyIndex > -1 && row[commentBodyIndex] !== "") {
            // for every comment on an issue, a seperate issue was created with only the comment data different
            sendObj.comment = {
              owner: row[commentUserIndex],
              repo: values.repo,
              issue_number: undefined, // can't control issue number when creating the issue so we must create issue first
              body: row[commentBodyIndex]
            }
          }

          // if we have a body column, pass that.
          if (indexes.body > -1) {
            sendObj.body = row[indexes.body];
          }

          // if we have a labels column, pass that.
          if (indexes.labels > -1 && row[indexes.labels] !== "") {
            sendObj.labels = row[indexes.labels].split(",");
          }

          // if we have a milestone column, pass that.
          if (indexes.milestone > -1 && row[indexes.milestone] !== "") {
            sendObj.milestone = row[indexes.milestone];
          }

          // if we have an assignee column, pass that.
          if (indexes.assignee > -1 && row[indexes.assignee] !== "") {
            sendObj.assignees = row[indexes.assignee].replace(/ /g, "").split(",");
          }

          // console.log("sendObj", sendObj);
          let state = false;
          if (indexes.state > -1 && row[indexes.state] === "closed") {
            state = row[indexes.state];
          }
          return createIssue(octokit, sendObj, state);
        });

        Promise.all(createPromises).then(
          (res) => {
            const successes = res.filter(({ cr }) => {
              return cr.status === 200 || cr.status === 201;
            });
            const fails = res.filter(({ cr }) => {
              return cr.status !== 200 && cr.status !== 201;
            });

            console.log(
              `Created ${successes.length} issues, and had ${fails.length} failures.`
            );
            console.log(
              "❤ ❗ If this project has provided you value, please ⭐ star the repo to show your support: ➡ https://github.com/gavinr/github-csv-tools"
            );

            if (fails.length > 0) {
              console.log(fails);
            }

            process.exit(0);
          },
          (err) => {
            console.error("Error");
            console.error(err);
            process.exit(0);
          }
        );
      }
    );
  });
};

module.exports = { importFile };