const prettier = require('prettier')
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
github.authenticate({ type: 'oauth', token: GITHUB_AUTH_TOKEN })

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

const filterJavascriptFiles = files =>
  files.filter(({ filename }) => filename.match(/.*(.js|.jsx)$/))

async function downloadFile ({ filename }, sha) {
  return new Promise((resolve, reject) => {
    github.repos.getContent(
      {
        owner: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME,
        path: filename,
        ref: sha
      },
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

async function createBranch () {
  return new Promise((resolve, reject) => {
    github.gitdata.createReference(
      {
        owner: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME,
        sha: latestCommitHash,
        ref: `refs/heads/${latestCommitHash.slice(0, 5)}-lint`
      },
      (error, data) => {
        if (error) {
          console.log(error)
        } else {
          resolve(data)
        }
      }
    )
  })
}

function checkIfBranchExists () {
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
let latestCommitHash = null
let newBranchInfo = null

async function treatPayload (payload) {
  latestCommitHash = payload.after

  const branchToLintExists = await checkIfBranchExists()

  if (branchToLintExists && payload.ref.split('/').pop() === BRANCH_TO_MONITOR) {
    newBranchInfo = await createBranch()

    if (newBranchInfo.meta.status === '201 Created') {
      payload.commits.map(async commit => {
        const { files, sha } = await getFilesFromCommit(commit)

        commitHash = sha

        filterJavascriptFiles(files).map(async file => {
          const { filename, patch, content } = await downloadFile(file, sha)
          console.log(prettier.format(content))
        })
      })
    }
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
