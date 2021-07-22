const createIssue = (octokit, issueInfo, state = false) => {
  return new Promise((resolve, reject) => {
    octokit.issues.create(issueInfo).then(
      (res) => {
        const issueNumber = res.data.number;
        if (res.status === 200 || res.status === 201) {
          console.log(`Created issue #${issueNumber}`);
          if (state === false) {
            // Success creating the issue and we do not have to close the issue, so we're done.
            resolve({
              cr: res,
              newIssueNumber: issueNumber,
              oldIssueNumber: issueInfo.oldIssueNumber,
              // comment,
            });
          } else {
            // need to close the issue!
            octokit.issues
              .update({
                owner: issueInfo.owner,
                repo: issueInfo.repo,
                issue_number: issueNumber,
                state,
              })
              .then(
                (editRes) => {
                  resolve({
                    cr: editRes,
                    newIssueNumber: issueNumber,
                    oldIssueNumber: issueInfo.oldIssueNumber,
                    // comment,
                  });
                },
                (err) => {
                  reject({ cr: err });
                }
              );
          }
        } else {
          // error creating the issue
          reject({ cr: res });
        }
      },
      (err) => {
        reject({ cr: err });
      }
    );
  });
};

const updateIssue = (octokit, sendObj, existingIssue) => {
  // will only update: title, body, labels, state
  const { owner, repo, title, body, labels, state } = sendObj;

  const getLabels = () => {
    let newLabelArray = [];
    const combineLabels = [
      ...(existingIssue.labels || []),
      ...(sendObj.labels || []),
    ];
    combineLabels.forEach((label) => {
      // labels in sendObj are strings and labels in existingIssue are object
      if (label && typeof label === "string") {
        if (!newLabelArray.includes("label")) {
          newLabelArray.push(label);
        }
      } else {
        if (labels.name && !newLabelArray.includes(labels.name)) {
          newLabelArray.push(label.name);
        }
      }
    });
    return newLabelArray;
  };

  const cleanedUpdateIssue = {
    owner,
    repo,
    issue_number: existingIssue.number,
    title,
    body,
    labels: getLabels(),
    state,
  };

  return new Promise((resolve, reject) => {
    octokit.issues.update(cleanedUpdateIssue).then(
      (res) => {
        // newIssue number is the issue number that will host this issue in the [to repo]'s issues' and will be used for the purpose of updating / creating comments
        // return {cr: res, newIssueNumber: existingIssue.number, oldIssueNumber: sendObj.oldIssueNumber, isUpdate: true}
        if (res.status === 200 || res.status === 201) {
          console.log("updated issue #" + existingIssue.number);
          resolve({
            cr: res,
            newIssueNumber: existingIssue.number,
            oldIssueNumber: sendObj.oldIssueNumber,
            isUpdate: true,
          });
        } else {
          reject({
            cr: res,
            newIssueNumber: existingIssue.number,
            oldIssueNumber: sendObj.oldIssueNumber,
            isUpdate: true,
          });
        }
      },
      (err) => {
        reject({ cr: err, isUpdate: true });
      }
    );
  });
};

const createComment = (octokit, comment) => {
  return new Promise((resolve, reject) => {
    octokit.issues.createComment(comment).then(
      (res) => {
        if (res.status === 200 || res.status === 201) {
          resolve(res);
        } else {
          console.log("error on comment in issue", comment.issue_number);
          reject(res);
        }
      },
      (err) => {
        reject(err);
      }
    );
  });
};

const listAllRepoIssues = (octokit, owner, repo) => {
  return octokit.rest.issues
    .listForRepo({
      owner,
      repo,
    })
    .then((res) => {
      // need to check res status first ?
      return res.data.filter((data) => !data.pull_request);
    })
    .catch((err) => {
      console.error("Error in listAllRepoIssues:", err);
      return [];
    });
};

// returns the existing issue if issue title or body are the same.
// if an issues body and title are edited this will return undefined and a new issue will be created
// note: if there is a way to set an ID or metadata when creating an issue this would be much more accurate
const issueAlreadyExists = (allIssues, issueInQuestion, values) => {
  return allIssues.find(
    // if the existing issue opener (user) is not the same as the issue in question's owner this will create a new issue because you cant update someone elses issue
    (issue) => {
      // even if we indicate the owner when updating or creating, git seems to change this to the current user running the program...?
      // so we cant care if issue.user.login is different that issueInQuestion.owner
      return (
        issue.title === issueInQuestion.title ||
        issue.body === issueInQuestion.body
      ); /*&& issue.user.login === issueInQuestion.owner*/
    }
  );
};

const listAllRepoCommentsForIssues = (octokit, owner, repo) => {
  return octokit.rest.issues
    .listCommentsForRepo({
      owner,
      repo,
    })
    .then((res) => {
      // check status codes?
      return res.data;
    })
    .catch((err) => {
      console.error("Error in listAllRepoCommentsForIssues:", err);
      return [];
    });
};

// edited comments will return undefined (indicates to create a new comment ... )
const commentAlreadyExists = (allComments, commentInQuestion, issueNumber) => {
  // allComments is from the comments in the repo we are trying to transfer to
  // commentInQuestion is from the repo we are transfering from
  const matches = (comment) => {
    let doesMatch = false;
    // listCommentsForRepo method does not return the issue number in the data so we have to extract is from url
    const numberIsAfter = "/issues/";
    const indexOfnumberInUrl = comment.issue_url.lastIndexOf(numberIsAfter);
    const existingCommentIssueNumber = parseInt(
      comment.issue_url.slice(indexOfnumberInUrl + numberIsAfter.length)
    );
    const issueNumbersEqual =
      parseInt(existingCommentIssueNumber) === parseInt(issueNumber);
    const isSameUser = comment.user.login === commentInQuestion.userLogin;

    if (issueNumbersEqual && isSameUser) {
      if (comment.body === commentInQuestion.body) {
        doesMatch = true;
      }
    }
    return doesMatch;
  };
  const matchingComment = allComments.find((comment) => matches(comment));
  return matchingComment;
};

module.exports = {
  createIssue,
  updateIssue,
  createComment,
  listAllRepoIssues,
  issueAlreadyExists,
  listAllRepoCommentsForIssues,
  commentAlreadyExists,
};
