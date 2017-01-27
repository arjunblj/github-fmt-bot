const atob = require('atob')
const express = require('express')
const bodyParser = require('body-parser')
const GitHubApi = require('github')
const _ = require('lodash')
const app = express()

import {
  GITHUB_USERNAME,
  GITHUB_PASSWORD,
  REPOSITORY_OWNER,
  REPOSITORY_NAME,
  BRANCH_TO_MONITOR,
  GITHUB_AUTH_TOKEN
} from './config'

const github = new GitHubApi({
  version: '3.0.0',
  headers: { 'user-agent': 'prettier-bot' }
})
github.authenticate({
  type: 'oauth',
  token: GITHUB_AUTH_TOKEN
})

async function getFilesFromCommit ({ id: sha }) {
  return new Promise((resolve, reject) => {
    github.repos.getCommit(
      { owner: REPOSITORY_OWNER, repo: REPOSITORY_NAME, sha },
      (error, data) => {
        if (error) {
          console.log(error)
        }
        const { files, sha } = data
        resolve({ files, sha })
      }
    )
  })
}

const filterJavascriptFiles = files => files.filter(({ filename }) => filename.match(/.*(.js|.jsx)$/))

async function downloadFile ({ filename }, sha) {
  return new Promise((resolve, reject) => {
    github.repos.getContent(
      { owner: REPOSITORY_OWNER, repo: REPOSITORY_NAME, path: filename, ref: sha },
      (error, data) => {
        if (error) {
          console.log(error)
        } else {
          const { filename, patch, sha } = data
          resolve({ filename, patch, sha, content: atob(data.content) })
        }
      }
    )
  })
}

function checkIfBranchIsSpecified (branch) {
  return new Promise((resolve, reject) => {
    github.gitdata.getReferences(
      { owner: REPOSITORY_OWNER, repo: REPOSITORY_NAME },
      (error, data) => {
        if (error) {
          console.log(error)
        } else {
          resolve(
            _.some(data, b => b.ref === `refs/heads/${BRANCH_TO_MONITOR}`)
          )
        }
      }
    )
  })
}

let commitHash = null

async function treatPayload (payload) {
  const gitBranchIsSpecified = await checkIfBranchIsSpecified()

  if (gitBranchIsSpecified) {
    payload.commits.map(async (commit) => {
      const { files, sha } = await getFilesFromCommit(commit)

      commitHash = sha

      filterJavascriptFiles(files).map(async (file) => {
        const { filename, patch, content } = await downloadFile(file, sha)
        console.log(content)
      })
    })
  }
}

app.use(bodyParser.json())
app.set('port', process.env.PORT || 5000)

app.post('/', ({ body: payload }, response) => {
  if (payload && payload.commits) {
    treatPayload(payload)
  }
  response.end()
})

app.listen(app.get('port'), () => {
  console.log(`Ready to format your code via port ${app.get('port')}`)
})
