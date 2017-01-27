import prettier from 'prettier'
import atob from 'atob'
import express from 'express'
import bodyParser from 'body-parser'
import GitHubApi from 'github'
import _ from 'lodash'

if (process.env.NODE_ENV !== 'production') { require('dotenv').load() }

const { REPOSITORY_OWNER, REPOSITORY_NAME, BRANCH_TO_MONITOR, GITHUB_AUTH_TOKEN } = process.env

const app = express()

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
          const { name, path, sha } = data
          resolve({ name, path, sha, content: atob(data.content) })
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
        sha: latestMasterCommitHash,
        ref: `refs/heads/${latestMasterCommitHash.slice(0, 5)}-lint`
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

async function updateFile (name, path, sha, formatted) {
  return new Promise((resolve, reject) => {
    github.repos.updateFile(
      {
        owner: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME,
        path: path,
        message: `Linting @${author.username}'s code.`,
        content: Buffer.from(formatted).toString('base64'),
        sha: sha,
        branch: `${latestMasterCommitHash.slice(0, 5)}-lint`
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

async function openPR () {
  return new Promise((resolve, reject) => {
    github.pullRequests.create(
      {
        owner: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME,
        title: `Linting fixes for @${author.username}.`,
        head: latestBranchCommitHash,
        base: latestMasterCommitHash
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
          resolve(_.some(data, b => b.ref === `refs/heads/${BRANCH_TO_MONITOR}`))
        }
      }
    )
  })
}

async function getLatestBranchHash () {
  return new Promise((resolve, reject) => {
    github.repos.getBranch(
      { owner: REPOSITORY_OWNER, repo: REPOSITORY_NAME, branch: `${latestMasterCommitHash.slice(0, 5)}-lint` },
      (error, data) => {
        if (error) {
          console.log(error)
        } else {
          console.log(data)
          resolve(data)
        }
      }
    )
  })
}

let author = null
let commitHash = null
let createdBranch = null
let latestMasterCommitHash = null
let latestBranchCommitHash = null

async function treatPayload (payload) {
  author = payload.head_commit.author
  latestMasterCommitHash = payload.after

  const branchToLintExists = await checkIfBranchExists()

  if (branchToLintExists && payload.ref.split('/').pop() === BRANCH_TO_MONITOR) {
    createdBranch = await createBranch()
    latestBranchCommitHash = createdBranch.ref

    if (createdBranch.meta.status === '201 Created') {
      payload.commits.map(async commit => {
        const { files, sha } = await getFilesFromCommit(commit)

        commitHash = sha

        await filterJavascriptFiles(files).map(async file => {
          const { name, path, content, sha } = await downloadFile(file, commitHash)

          const formatted = prettier.format(content)
          const latestBranch = await getLatestBranchHash()

          await updateFile(name, path, sha, formatted)

          latestBranchCommitHash = latestBranch.commit.sha
        })
        await openPR()
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
