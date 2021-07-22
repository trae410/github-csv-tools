const csv = require("csv");
const fs = require("fs");

const { createIssue, createComment } = require("./helpers.js");

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
        var cols = csvRows[0].map((col) => col.toLowerCase());
        csvRows.shift();

        // get indexes of the fields we need
        var indexes = {
          title: cols.indexOf("title"),
          number: cols.indexOf("number"),
          body: cols.indexOf("body"),
          labels: cols.indexOf("labels"),
          milestone: cols.indexOf("milestone"),
          assignee: cols.indexOf("assignee"),
          state: cols.indexOf("state"),
        };
        // for every comment on an issue, a seperate issue was created with only the comment data different
        const commentUserIndex = cols.indexOf("comment.user");
        const commentBodyIndex = cols.indexOf("comment.body");

        if (indexes.title === -1) {
          var newTitleIndex = cols.indexOf("issue.title");
          // get the value in case the nested properties formatted as item.item eg: "issue.title",
          if (newTitleIndex) {
            // change all indexes to find with prefix of "issue."
            for (key in indexes) {
              indexes[key] = cols.indexOf(`issue.${key}`);
            }
          } else {
            // if still cant find title
            console.error("Title required by GitHub, but not found in CSV.");
            process.exit(1);
          }
        }

        let createCommentPromises = [];

        const createPromises = csvRows.map((row) => {
          var sendObj = {
            owner: values.userOrOrganization,
            repo: values.repo,
            title: row[indexes.title],
          };

          if (
            commentUserIndex > -1 &&
            commentBodyIndex > -1 &&
            row[commentBodyIndex] !== ""
          ) {
            // need to update the comment right after an issue is updated because we need the issue_number of responnse of successful issue update
            // cant create a comment without the proper issue_number which is auto created by git
            // for every comment on an issue, a seperate issue was created with only the comment data different
            sendObj.comment = {
              // owner: row[commentUserIndex],
              owner: values.userOrOrganization,
              repo: values.repo,
              issue_number: undefined, // can't control issue number when creating the issue so we must create issue first
              body: row[commentBodyIndex],
            };
          }

          // if we have a number column, pass that.
          if (indexes.number > -1) {
            sendObj.oldIssueNumber = row[indexes.number];
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
            sendObj.assignees = row[indexes.assignee]
              .replace(/ /g, "")
              .split(",");
          }

          let state = false;
          if (indexes.state > -1 && row[indexes.state] === "closed") {
            state = row[indexes.state];
          }
          if (sendObj.comment && sendObj.comment.body) {
            return { hasComment: true, sendObj };
          } else {
            return createIssue(octokit, sendObj, state);
          }
        });

        Promise.all(createPromises)
          .then(
            (res) => {
              const commentObjects = res.filter(({ hasComment }) => hasComment);
              const successes = res.filter(({ cr, hasComment }) => {
                if (!hasComment) {
                  return cr.status === 200 || cr.status === 201;
                }
              });
              const fails = res.filter(({ cr, hasComment }) => {
                if (!hasComment) {
                  return cr.status !== 200 && cr.status !== 201;
                }
              });

              console.log(
                `Created ${successes.length} issues, and had ${fails.length} failures.`
              );
              if (fails.length > 0) {
                console.log(fails);
              }

              let commentCreatePromises = [];

              // map through comments, find the corresponding successfully created issue and add the comment to it
              for (let i = 0; i < commentObjects.length; i++) {
                const issueInfo = commentObjects[i].sendObj;

                if (issueInfo) {
                  const comment = issueInfo.comment;
                  // find successfully created issue
                  const parentIssueRes = successes.find((res) => {
                    return (
                      parseInt(res.oldIssueNumber) ===
                      parseInt(issueInfo.oldIssueNumber)
                    );
                  });
                  if (parentIssueRes) {
                    const issueNumber = parentIssueRes.newIssueNumber;
                    if (
                      comment &&
                      comment.body &&
                      comment.owner &&
                      comment.repo
                    ) {
                      commentCreatePromises.push(
                        createComment(octokit, {
                          ...comment,
                          issue_number: issueNumber,
                        })
                      );
                    } else {
                      console.warn(
                        "Can't create comment for new issue #",
                        issueNumber,
                        " Create comment requires properties: owner, repo, issue_number and body"
                      );
                    }
                  } else {
                    console.warn(
                      "Skipping a comment for issue (in csv) #",
                      issueInfo.oldIssueNumber,
                      " because the issue was not created successfully"
                    );
                  }
                } else {
                  console.error;
                }
              }

              if (commentCreatePromises && commentCreatePromises.length) {
                console.log("Creating comments...");
              }

              return Promise.all(commentCreatePromises);
            },
            (err) => {
              console.error("Error");
              console.error(err);
              process.exit(0);
            }
          )
          .then(
            (res) => {
              const successes = res.filter((cr) => {
                return cr.status === 200 || cr.status === 201;
              });
              const fails = res.filter((cr) => {
                return cr.status !== 200 && cr.status !== 201;
              });
              if (successes.length || fails.length) {
                console.log(
                  `Created ${successes.length} comments, and had ${fails.length} failures.`
                );
              }
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
