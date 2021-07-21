const {
  createIssue,
  updateIssue,
  listAllRepoIssues,
  issueAlreadyExists,
  listAllRepoCommentsForIssues,
  commentAlreadyExists,
} = require("./helpers.js");

const { getComment, defaultExportColumns } = require("./export.js");

// get the comments array of the from repo
const getCommentsArray = async (octokit, values, data, verbose = false) => {
  const commentsArray = [];
  for (let i = 0; i < data.length; i++) {
    const issueObject = data[i];
    if (verbose === true) {
      console.log("getting comments for issue #: ", issueObject.number);
    }
    const commentsData = await getComment(octokit, values, issueObject.number);
    commentsData.forEach((comment) => {
      commentsArray.push({
        // owner always has to be the repo owner
        owner: values.toUserOrOrganization,
        repo: values.toRepo,
        oldIssueNumber: issueObject.number, // this is the issue number of the exported issue
        body: comment.body,
      });
    });
  }
  return commentsArray;
};

// copy and import into the toRepo
const importData = async (octokit, values, filteredData, commentsArray) => {
  // get the issues in the [transfer to] repo
  const existingIssues = await listAllRepoIssues(
    octokit,
    values.toUserOrOrganization,
    values.toRepo
  );

  const issueCreateOrUpdatePromises = filteredData.map((issueObject) => {
    var sendObj = {
      owner: values.toUserOrOrganization,
      repo: values.toRepo,
      title: issueObject.title,
      body: issueObject.body,
      oldIssueNumber: issueObject.number,
    };

    // if we have a labels column, pass that.
    if (issueObject.labels) {
      sendObj.labels = issueObject.labels.split(",");
    }

    // if we have a milestone column, pass that.
    if (issueObject.milestone) {
      sendObj.milestone = issueObject.milestone;
    }
    // if we have an assignee column, pass that.
    if (issueObject.assignee) {
      sendObj.assignees = issueObject.replace(/ /g, "").split(",");
    }

    let state = false;
    if (issueObject.state && issueObject.state === "closed") {
      state = issueObject.state;
    }

    const existingIssue = issueAlreadyExists(existingIssues, sendObj);

    if (existingIssue) {
      sendObj.state = issueObject.state;
      return updateIssue(octokit, sendObj, existingIssue);
    } else {
      return createIssue(octokit, sendObj, state);
    }
  });

  const issuesCreatedOrUpdated = await Promise.all(
    issueCreateOrUpdatePromises
  ).then(
    (res) => {
      const createSuccesses = res.filter(({ cr, isUpdate }) => {
        return !isUpdate && (cr.status === 200 || cr.status === 201);
      });
      const fails = res.filter(({ cr }) => {
        return cr.status !== 200 && cr.status !== 201;
      });
      const updateSuccesses = res.filter(({ cr, isUpdate }) => {
        return isUpdate && (cr.status === 200 || cr.status === 201);
      });

      const compareIssueNumbers = res.map(
        ({ newIssueNumber, oldIssueNumber }) => {
          return { new: newIssueNumber, old: oldIssueNumber };
        }
      );

      console.log(
        `Imported ${createSuccesses.length} issues, ${updateSuccesses.length} updates, and had ${fails.length} failures.`
      );

      if (fails.length > 0) {
        console.log(fails);
      }

      return { res, compareIssueNumbers };
    },
    (err) => {
      console.log("Error in issuesCreatedOrUpdated");
      if (er.status === 404) {
        console.log("If you are transferring issues from one git account to another you need to add the users as collaborators to any private repos")
      }
      console.error(err);
      process.exit(0);
    }
  );

  if (commentsArray && commentsArray.length) {
    // if the -c flag was not used there should be no commentsArray.length
    if (!issuesCreatedOrUpdated.compareIssueNumbers) {
      console.error("no compareIssueNumbers");
      process.exit(0);
    }

    const allComments = await listAllRepoCommentsForIssues(
      octokit,
      values.toUserOrOrganization,
      values.toRepo
    );

    const commentCreateOrUpdatePromises = commentsArray.map((comment) => {
      const compareObject = issuesCreatedOrUpdated.compareIssueNumbers.find(
        (compare) => compare.old === comment.oldIssueNumber
      );
      const issueNumber = compareObject.new;

      if (comment.oldIssueNumber) {
        const existingComment = commentAlreadyExists(
          allComments,
          comment,
          issueNumber
        );

        if (existingComment) {
          // note: not much point in updating a comment because the only way to assume the comment exists is based on comment.user and comment.body
          return octokit.rest.issues
            .updateComment({
              owner: comment.owner,
              repo: comment.repo,
              comment_id: existingComment.id,
              body: comment.body,
            })
            .then((res) => {
              return { cr: res, isUpdate: true };
            })
            .catch((err) => {
              console.log("error caught in update comment");
              return { cr: err, isUpdate: true };
            });
        } else {
          return octokit.issues
            .createComment({
              ...comment,
              issue_number: issueNumber,
            })
            .then((res) => {
              return { cr: res };
            })
            .catch((err) => {
              console.log("error caught it createComment");
              return { cr: err };
            });
        }
      } else {
        console.error(
          `Cannot copy comment: ${comment.title}, no comment.oldIssueNumber`
        );
        return { status: 206 };
      }
    });

    return Promise.all(commentCreateOrUpdatePromises).then(
      (res) => {
        const createSuccesses = res.filter(({ cr, isUpdate }) => {
          return !isUpdate && (cr.status === 200 || cr.status === 201);
        });
        const fails = res.filter(({ cr }) => {
          return cr.status !== 200 && cr.status !== 201;
        });
        const updateSuccesses = res.filter(({ cr, isUpdate }) => {
          return isUpdate && (cr.status === 200 || cr.status === 201);
        });

        console.log(
          `Imported ${createSuccesses.length} comments, ${updateSuccesses.length} updates. and had ${fails.length} failures.`
        );

        if (fails.length > 0) {
          console.log(fails);
        }
        return;
      },
      (err) => {
        console.error("Error");
        console.error(err);
        process.exit(0);
      }
    );
  } else {
    console.log("No comments to copy");
    return;
  }
};

const transferCopy = (octokit, values) => {
  // Getting all the issues:
  const options = octokit.issues.listForRepo.endpoint.merge({
    owner: values.userOrOrganization,
    repo: values.repo,
    state: "all",
  });

  octokit.paginate(options).then(
    async (data) => {
      // default export - columns that are compatible to be imported into GitHub
      let filteredData = defaultExportColumns(data);
      if (values.exportAll) {
        // Just pass "data", it will flatten the JSON object we got from the API and use that (lots of data!)
        filteredData = data;
      } else if (values.exportAttributes) {
        filteredData = specificAttributeColumns(data, values.exportAttributes);
      }

      filteredData = filteredData.reverse();
      let commentsArray;
      // Add on comments, if requested.
      if (values.exportComments === true) {
        if (
          filteredData[0] &&
          Object.prototype.hasOwnProperty.call(filteredData[0], "number")
        ) {
          commentsArray = await getCommentsArray(
            octokit,
            values,
            filteredData,
            values.verbose
          );
        } else {
          console.error(
            "Error: Must include issue number when exporting comments."
          );
          filteredData = false;
        }
      }

      await importData(octokit, values, filteredData, commentsArray);
      console.log(
        "❤ ❗ If this project has provided you value, please ⭐ star the repo to show your support: ➡ https://github.com/gavinr/github-csv-tools"
      );
      process.exit(0);
    },
    (err) => {
      console.log("error", err);
      process.exit(0);
    }
  );
};

module.exports = { transferCopy };
