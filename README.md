github-fmt-bot
==================

> A simple GitHub bot that'll clean up your messy code and open a PR with the changes.

Writing code is hard and formatting is even harder. Thanks to [James Long's](https://github.com/jlongster) incredible project [prettier](https://github.com/jlongster/prettier), we're one step closer. This is a turn key bot that'll take a GitHub user token, listen to pushes on a specified branch (e.g. `master`) and open a pull-request enforcing any style violations made in the process.

Right now, it's powered by `prettier` and runs as a standalone script. In the future, I want to enable `eslint` option specification and integrate it with CI systems.

## Usage

Just install, either with `yarn` or `npm i`.

To get an access token, grab it [here](https://github.com/settings/tokens) for the user that will be opening the PR. Also required is an outgoing webhook set up on the repository to clean up.

Locally, you can get up and running with `ngrok` and by creating a `.env` (based on `.env.template`)

## v1.0.0 Roadmap

- [x] Lint code against `prettier`
- [x] Open Pull Requests
- [ ] Take in eslint configuration (or auto-detect) to run `eslint --fix`
- [ ] Easy Cmd+V integration to Travis and other CI system

## License

MIT © [Arjun Balaji](http://github.com/arjunblj)
