const createIssue = (octokit, issueInfo, state = false) => {
  return new Promise((resolve, reject) => {
    octokit.issues.create(issueInfo).then(
      (res) => {
        // console.log("res", res);
        console.log(`Created issue #${issueNumber}`)
        if (res.status === 201) {
          // need to close the issue!
          const issueNumber = res.data.number;
          if (state === false) {
            // Success creating the issue and we do not have to close the issue, so we're done.
            resolve({cr: res, newIssueNumber: issueNumber, oldIssueNumber: issueInfo.oldIssueNumber});
          } else {

            octokit.issues
              .update({
                owner: issueInfo.owner,
                repo: issueInfo.repo,
                issue_number: issueNumber,
                state,
              })
              .then(
                (editRes) => {
                  resolve({cr: editRes, newIssueNumber: issueNumber, oldIssueNumber: issueInfo.oldIssueNumber});
                },
                (err) => {
                  reject({cr: err});
                }
              );
          }
        } else {
          // error creating the issue
          reject({cr: res});
        }
      },
      (err) => {
        reject({cr: err});
      }
    );
  });
};

const updateIssue = (octokit, sendObj, existingIssue) => {
    // will only update: title, body, labels, state
  const { owner, repo, title, body, labels, state } = sendObj

  const getLabels = () => {
    let newLabelArray = []
    const combineLabels = [...existingIssue.labels || [], ...sendObj.labels || []]
    combineLabels.forEach(label => {
      // labels in sendObj are strings and labels in existingIssue are object
      if (label && typeof(label) === "string") {
        if (!newLabelArray.includes("label")) {
          newLabelArray.push(label)
        }
      } else {
        if (labels.name && !newLabelArray.includes(labels.name)) {
          newLabelArray.push(label.name)
        }
      }
    })
    return newLabelArray
  }

  const cleanedUpdateIssue = {
    owner, 
    repo,
    issue_number: existingIssue.number,
    title,
    body,
    labels: getLabels(),
    state,
  }

  return new Promise((resolve, reject) => {
    console.log("updating issue #" + existingIssue.number)
    octokit.issues.update(cleanedUpdateIssue).then(
      (res) => {
        // newIssue number is the issue number that will host this issue in the [to repo]'s issues' and will be used for the purpose of updating / creating comments
        // return {cr: res, newIssueNumber: existingIssue.number, oldIssueNumber: sendObj.oldIssueNumber, isUpdate: true}
        resolve({cr: res, newIssueNumber: existingIssue.number, oldIssueNumber: sendObj.oldIssueNumber, isUpdate: true})
      }, 
      (err) => {
        reject({cr: err, isUpdate: true});
      }
    )
  })
}

// const updateIssue = (octokit, sendObj, existingIssue) => {
//   // will only update: title, body, labels, state
//   const { owner, repo, title, body, labels, state } = sendObj

//   const getLabels = () => {
//     let newLabelArray = []
//     const combineLabels = [...existingIssue.labels || [], ...sendObj.labels || []]
//     combineLabels.forEach(label => {
//       // labels in sendObj are strings and labels in existingIssue are object
//       if (label && typeof(label) === "string") {
//         if (!newLabelArray.includes("label")) {
//           newLabelArray.push(label)
//         }
//       } else {
//         if (labels.name && !newLabelArray.includes(labels.name)) {
//           newLabelArray.push(label.name)
//         }
//       }
//     })
//     return newLabelArray
//   }

//   const cleanedUpdateIssue = {
//     owner, 
//     repo,
//     issue_number: existingIssue.number,
//     title,
//     body,
//     labels: getLabels(),
//     state,
//   }
//   console.log("cleanedUpdateIssue...", cleanedUpdateIssue)
//   return octokit.issues.update(cleanedUpdateIssue).then((res) => {
//     // newIssue number is the issue number that will host this issue in the [to repo]'s issues' and will be used for the purpose of updating / creating comments
//     return {cr: res, newIssueNumber: existingIssue.number, oldIssueNumber: sendObj.oldIssueNumber, isUpdate: true}
//   }).catch(err => {
//     return err
//   })
// }
const listAllRepoIssues = (octokit, owner, repo) => {
  return octokit.rest.issues.listForRepo({
      owner,
      repo,
    }).then((res) => {
      // need to check res status first
      return res.data.filter(data => !data.pull_request)
    }).catch(err => {
      console.error("Error in listAllRepoCommentsForIssues:", err)
      return []
    })
}

// const listAllRepoIssues = (octokit, owner, repo) => {
//   return new Promise((reject, resolve) => {
//     octokit.rest.issues.listForRepo({
//       owner,
//       repo,
//     }).then(
//       (res) => {
//         // need to check res status first
//         resolve(res.data.filter(data => !data.pull_request))
//       }, 
//       (err) => {
//         reject(err)
//         // console.error("error in listAllRepoIssues", err)
//         // process.exit(0)
//       }
//     )

//   }
// }

// returns the existing issue if issue title or body are the same. 
// if an issues body and title are edited this will return undefined and a new issue will be created
// note: if there is a way to set an ID or metadata when creating an issue this would be much more accurate 
const issueAlreadyExists = (allIssues, issueInQuestion) => {
  return allIssues.find(issue => issue.title === issueInQuestion.title || issue.body === issueInQuestion.body)
}

const listAllRepoCommentsForIssues = (octokit, owner, repo) => {
  return octokit.rest.issues.listCommentsForRepo({
    owner,
    repo,
  }).then((res) => {
    // check status codes?
    return res.data
  }).catch(err => {
    console.error("Error in listAllRepoCommentsForIssues:", err)
    return []
  })
}

// const listAllRepoCommentsForIssues = (octokit, owner, repo) => {
//   return new Promise((reject, resolve) => {
//     octokit.rest.issues.listCommentsForRepo({
//       owner,
//       repo,
//     }).then(
//       (res) => {
//         resolve(res.data)
//       },
//       (err) => {
//         reject(err)
//       }
//     )
//   }
// }

// edited comments will return undefined (indicates to create a new comment ... )
const commentAlreadyExists = (allComments, commentInQuestion, issueNumber) => {
  const matches = (comment) => {
    let doesMatch = false
    // comment.user or comment.owner ?
    if (comment.issue_number === issueNumber && comment.user === commentInQuestion.owner) {
      if (comment.body === commentInQuestion.body) {
        return true
      }
    }
    return doesMatch
  }
  const matchingComment = allComments.find(comment => matches(comment))
  console.log("checking if comment already exists...", allComments, "matchingComment...", matchingComment)
  return matchingComment
}

module.exports = { createIssue, updateIssue, listAllRepoIssues, issueAlreadyExists, listAllRepoCommentsForIssues, commentAlreadyExists };